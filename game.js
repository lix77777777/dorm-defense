import {
  GAME_WIDTH,
  GAME_HEIGHT,
  ROAD_OUTER_WIDTH,
  ROAD_INNER_WIDTH,
  maps,
  towerTypes,
  enemyTypes,
  waves,
  difficulties
} from "./data.js";

export class Game {
  constructor(canvas, hooks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hooks = hooks;

    this.currentDifficulty = "easy";
    this.currentMapKey = "dorm";

    this.currentPath = [];
    this.towerSpots = [];
    this.segments = [];
    this.totalPathLength = 0;

    this.soundEnabled = true;
    this.audioCtx = null;

    this.resetCoreState();
    this.applyMapData();
    this.bindEvents();

    this.lastTime = 0;
    requestAnimationFrame(this.loop.bind(this));
  }

  resetCoreState() {
    this.gold = 0;
    this.lives = 0;
    this.waveIndex = -1;
    this.selectedTowerType = null;
    this.selectedPlacedTower = null;
    this.score = 0;

    this.towers = [];
    this.enemies = [];
    this.bullets = [];
    this.particles = [];

    this.gameStarted = false;
    this.gameOver = false;
    this.victory = false;
    this.gamePaused = false;
    this.endNotified = false;

    this.waveActive = false;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.spawnInterval = 0.9;

    this.skillCooldown = 0;
    this.globalSlowTimer = 0;
    this.skillFlashTimer = 0;

    this.enemyIdCounter = 0;
    this.logText = "欢迎来到宿舍保卫战。";

    this.stats = {
      kills: 0,
      towersBuilt: 0,
      towersSold: 0,
      skillsUsed: 0,
      bossKills: 0
    };
  }

  bindEvents() {
    this.canvas.addEventListener("click", this.handleCanvasClick.bind(this));
  }

  initAudio() {
    if (!this.soundEnabled) return;
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }
    } catch {
      this.soundEnabled = false;
    }
  }

  playTone(freq, duration = 0.08, type = "sine", volume = 0.03) {
    if (!this.soundEnabled) return;
    this.initAudio();
    if (!this.audioCtx) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start();
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      this.audioCtx.currentTime + duration
    );
    osc.stop(this.audioCtx.currentTime + duration);
  }

  setDifficulty(diff) {
    this.currentDifficulty = diff;
    if (!this.gameStarted) {
      this.preparePreviewState();
    }
  }

  setMap(mapKey) {
    this.currentMapKey = mapKey;
    this.applyMapData();
    if (!this.gameStarted) {
      this.preparePreviewState();
    }
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    if (this.soundEnabled) {
      this.playTone(520, 0.08, "triangle", 0.02);
    }
    this.emitUpdate();
  }

  preparePreviewState() {
    const cfg = difficulties[this.currentDifficulty];
    const mapEffect = maps[this.currentMapKey].effect || {};
    this.gold = cfg.startGold + (mapEffect.startGoldBonus || 0);
    this.lives = cfg.startLives;
    this.waveIndex = -1;
    this.score = 0;
    this.logText = `当前预设：${cfg.label} / ${maps[this.currentMapKey].label}`;
    this.emitUpdate();
  }

  applyMapData() {
    this.currentPath = maps[this.currentMapKey].path.map((p) => ({ ...p }));
    this.towerSpots = maps[this.currentMapKey].spots.map((s) => ({
      x: s.x,
      y: s.y,
      tower: null
    }));
    this.buildPathData();
  }

  buildPathData() {
    this.segments = [];
    this.totalPathLength = 0;

    for (let i = 0; i < this.currentPath.length - 1; i++) {
      const a = this.currentPath[i];
      const b = this.currentPath[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);

      this.segments.push({
        ax: a.x,
        ay: a.y,
        bx: b.x,
        by: b.y,
        len,
        start: this.totalPathLength,
        end: this.totalPathLength + len
      });

      this.totalPathLength += len;
    }
  }

  getPositionOnPath(distance) {
    const d = Math.max(0, Math.min(distance, this.totalPathLength));

    for (const seg of this.segments) {
      if (d >= seg.start && d <= seg.end) {
        const t = (d - seg.start) / seg.len;
        return {
          x: seg.ax + (seg.bx - seg.ax) * t,
          y: seg.ay + (seg.by - seg.ay) * t
        };
      }
    }

    const last = this.currentPath[this.currentPath.length - 1];
    return { x: last.x, y: last.y };
  }

  setSelectedTowerType(type) {
    this.selectedTowerType = type;
    this.selectedPlacedTower = null;
    this.emitUpdate();
  }

  startNewGame() {
    const cfg = difficulties[this.currentDifficulty];
    const mapEffect = maps[this.currentMapKey].effect || {};

    this.resetCoreState();
    this.applyMapData();

    this.gold = cfg.startGold + (mapEffect.startGoldBonus || 0);
    this.lives = cfg.startLives;
    this.gameStarted = true;
    this.logText = `开始游戏：${cfg.label} / ${maps[this.currentMapKey].label}`;
    this.emitUpdate();
  }

  restartGame() {
    if (!this.gameStarted) return;
    this.startNewGame();
  }

  startNextWave() {
    if (this.gameOver || this.victory || this.gamePaused || this.waveActive) return;
    if (this.waveIndex >= waves.length - 1) return;

    this.waveIndex++;
    this.spawnQueue = [...waves[this.waveIndex]];
    this.spawnTimer = 0;
    this.waveActive = true;
    this.logText = `第 ${this.waveIndex + 1} 波开始！怪物来了！`;
    this.playTone(360, 0.08, "sawtooth", 0.025);

    if (this.spawnQueue.includes("boss")) {
      this.logText = `第 ${this.waveIndex + 1} 波开始！Boss 来袭！`;
      this.playTone(220, 0.18, "sawtooth", 0.04);
      setTimeout(() => this.playTone(180, 0.18, "sawtooth", 0.04), 180);
    }

    this.emitUpdate();
  }

  togglePause() {
    if (this.gameOver || this.victory || !this.gameStarted) return;
    this.gamePaused = !this.gamePaused;
    this.logText = this.gamePaused ? "游戏已暂停。" : "游戏继续。";
    this.emitUpdate();
  }

  castSkill() {
    if (this.skillCooldown > 0 || this.gameOver || this.victory || !this.gameStarted) return;

    this.skillCooldown = 25;
    this.globalSlowTimer = 3;
    this.skillFlashTimer = 0.35;
    this.stats.skillsUsed += 1;

    for (const enemy of this.enemies) {
      enemy.slowFactor = Math.min(enemy.slowFactor, 0.45);
      enemy.slowTimer = Math.max(enemy.slowTimer, 3);
    }

    for (let i = 0; i < 18; i++) {
      this.spawnParticles(GAME_WIDTH / 2, GAME_HEIGHT / 2, "#7c3aed", 3, 220, 0.55);
    }

    this.playTone(520, 0.08, "sine", 0.025);
    setTimeout(() => this.playTone(440, 0.08, "sine", 0.025), 80);

    this.score += 15;
    this.logText = "已释放技能：全场减速！";
    this.emitUpdate();
  }

  getUpgradeCost(tower) {
    if (tower.level === 1) return Math.round(tower.spent * 0.75);
    if (tower.level === 2) return Math.round(tower.spent * 0.6);
    return 999999;
  }

  getSellValue(tower) {
    return Math.round(tower.spent * 0.65);
  }

  getTowerActionButtons() {
    if (!this.selectedPlacedTower) return null;

    const t = this.selectedPlacedTower;
    return {
      upgrade: {
        x: t.x - 46,
        y: t.y,
        r: 18,
        label: "升"
      },
      sell: {
        x: t.x + 46,
        y: t.y,
        r: 18,
        label: "卖"
      }
    };
  }

  drawTowerActionButtons() {
    if (!this.selectedPlacedTower) return;

    const ctx = this.ctx;
    const buttons = this.getTowerActionButtons();
    const canUpgrade =
      this.selectedPlacedTower.level < 3 &&
      this.gold >= this.getUpgradeCost(this.selectedPlacedTower);

    const drawBtn = (btn, bgColor, textColor) => {
      ctx.beginPath();
      ctx.arc(btn.x, btn.y, btn.r, 0, Math.PI * 2);
      ctx.fillStyle = bgColor;
      ctx.fill();
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = textColor;
      ctx.font = "bold 14px Microsoft YaHei";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(btn.label, btn.x, btn.y + 1);
    };

    drawBtn(
      buttons.upgrade,
      canUpgrade ? "#2563eb" : "#94a3b8",
      "#ffffff"
    );

    drawBtn(
      buttons.sell,
      "#ef4444",
      "#ffffff"
    );

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 11px Microsoft YaHei";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    const upText =
      this.selectedPlacedTower.level >= 3
        ? "满级"
        : `${this.getUpgradeCost(this.selectedPlacedTower)}`;

    ctx.fillText(upText, buttons.upgrade.x, buttons.upgrade.y - 24);
    ctx.fillText(
      `${this.getSellValue(this.selectedPlacedTower)}`,
      buttons.sell.x,
      buttons.sell.y - 24
    );
  }

  upgradeSelectedTower() {
    const tower = this.selectedPlacedTower;
    if (!tower) return;

    if (tower.level >= 3) {
      this.logText = "这个塔已经满级了。";
      this.emitUpdate();
      return;
    }

    const cost = this.getUpgradeCost(tower);
    if (this.gold < cost) {
      this.logText = "金币不足，无法升级。";
      this.emitUpdate();
      return;
    }

    this.gold -= cost;
    tower.spent += cost;
    tower.level += 1;
    tower.damage = Math.round(tower.damage * 1.42);
    tower.range += 12;
    tower.fireRate = Math.max(0.55, tower.fireRate * 0.9);

    if (tower.splashRadius) {
      tower.splashRadius += 5;
    }

    this.score += 20;
    this.spawnParticles(tower.x, tower.y, tower.color, 10, 90, 0.35);
    this.playTone(660, 0.07, "triangle", 0.02);
    this.logText = `${tower.name} 已升级到 Lv.${tower.level}。`;
    this.emitUpdate();
  }

  sellSelectedTower() {
    const tower = this.selectedPlacedTower;
    if (!tower) return;

    const value = this.getSellValue(tower);
    this.gold += value;
    this.stats.towersSold += 1;

    this.towers = this.towers.filter((t) => t !== tower);
    if (tower.spotRef) {
      tower.spotRef.tower = null;
    }

    this.selectedPlacedTower = null;
    this.spawnParticles(tower.x, tower.y, "#94a3b8", 8, 80, 0.3);
    this.playTone(260, 0.08, "triangle", 0.02);
    this.logText = `${tower.name} 已卖出，获得 ${value} 金币。`;
    this.emitUpdate();
  }

  createTower(type, x, y) {
    const t = towerTypes[type];
    const effect = maps[this.currentMapKey].effect || {};

    const tower = {
      type,
      name: t.name,
      x,
      y,
      range: t.range,
      damage: t.damage,
      fireRate: t.fireRate,
      bulletSpeed: t.bulletSpeed,
      color: t.color,
      size: t.size,
      cooldown: 0,
      slow: t.slow,
      slowTime: t.slowTime,
      splashRadius: t.splashRadius || 0,
      splashFactor: t.splashFactor || 0,
      label: t.label,
      level: 1,
      spent: t.cost,
      spotRef: null
    };

    if (type === "lamp" && effect.lampRangeBonus) {
      tower.range += effect.lampRangeBonus;
    }
    if (type === "book" && effect.bookDamageMul) {
      tower.damage = Math.round(tower.damage * effect.bookDamageMul);
    }
    if (type === "sniper" && effect.sniperRangeBonus) {
      tower.range += effect.sniperRangeBonus;
    }
    if (type === "coffee" && effect.coffeeSlowOverride) {
      tower.slow = effect.coffeeSlowOverride;
      tower.slowTime += effect.coffeeSlowTimeBonus || 0;
    }
    if (type === "bomb" && effect.bombSplashBonus) {
      tower.splashRadius += effect.bombSplashBonus;
    }

    return tower;
  }

  createEnemy(typeKey, distance = 0) {
    const t = enemyTypes[typeKey];
    const cfg = difficulties[this.currentDifficulty];

    const enemy = {
      id: this.enemyIdCounter++,
      type: typeKey,
      name: t.name,
      hp: Math.round(t.hp * cfg.enemyHpMul),
      maxHp: Math.round(t.hp * cfg.enemyHpMul),
      speed: t.speed * cfg.enemySpeedMul,
      reward: Math.round(t.reward * cfg.rewardMul),
      color: t.color,
      radius: t.radius,
      label: t.label,
      distance,
      alive: true,
      slowFactor: 1,
      slowTimer: 0,
      shieldHP: 0,
      maxShieldHP: 0,
      enraged: false,
      summon70Done: false,
      summon35Done: false,
      phase2Done: false,
      didSplit: false
    };

    if (typeKey === "shield") {
      enemy.shieldHP = Math.round(38 * cfg.enemyHpMul);
      enemy.maxShieldHP = enemy.shieldHP;
    }

    if (typeKey === "boss") {
      enemy.shieldHP = Math.round(120 * cfg.enemyHpMul);
      enemy.maxShieldHP = enemy.shieldHP;
    }

    const pos = this.getPositionOnPath(distance);
    enemy.x = pos.x;
    enemy.y = pos.y;

    return enemy;
  }

  spawnEnemy(typeKey) {
    this.enemies.push(this.createEnemy(typeKey));
  }

  spawnChildrenAt(distance, types) {
    types.forEach((type, idx) => {
      const d = Math.max(0, distance - (idx + 1) * 16);
      this.enemies.push(this.createEnemy(type, d));
    });
  }

  spawnParticles(x, y, color, count, speed = 120, life = 0.4) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = Math.random() * speed;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life,
        maxLife: life,
        color,
        size: 2 + Math.random() * 3
      });
    }
  }

  findTarget(tower) {
    let best = null;
    let bestDistance = -1;

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const dx = enemy.x - tower.x;
      const dy = enemy.y - tower.y;
      const d = Math.hypot(dx, dy);

      if (d <= tower.range) {
        if (enemy.distance > bestDistance) {
          bestDistance = enemy.distance;
          best = enemy;
        }
      }
    }
    return best;
  }

  killEnemy(enemy) {
    if (!enemy.alive) return;

    enemy.alive = false;
    this.gold += enemy.reward;
    this.score += enemy.reward;
    this.stats.kills += 1;

    if (enemy.type === "boss") {
      this.stats.bossKills += 1;
    }

    this.spawnParticles(
      enemy.x,
      enemy.y,
      enemy.color,
      enemy.type === "boss" ? 28 : 14,
      150,
      0.45
    );
    this.playTone(820, 0.04, "square", 0.012);

    if (enemy.type === "split" && !enemy.didSplit) {
      enemy.didSplit = true;
      this.spawnChildrenAt(enemy.distance, ["rush", "rush"]);
    }
  }

  applyDamage(enemy, damage, slow = 0, slowTime = 0, particleColor = "#ffffff") {
    if (!enemy || !enemy.alive) return;

    let remain = damage;

    if (enemy.shieldHP > 0) {
      const absorbed = Math.min(enemy.shieldHP, remain);
      enemy.shieldHP -= absorbed;
      remain -= absorbed;
      this.spawnParticles(enemy.x, enemy.y, "#38bdf8", 4, 50, 0.18);
    }

    if (remain > 0) {
      enemy.hp -= remain;
      this.spawnParticles(enemy.x, enemy.y, particleColor, 3, 50, 0.18);
    }

    if (slow > 0) {
      enemy.slowFactor = Math.min(enemy.slowFactor, slow);
      enemy.slowTimer = Math.max(enemy.slowTimer, slowTime);
    }

    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
    }
  }

  applySplashDamage(centerEnemy, bullet) {
    const radius = bullet.splashRadius || 0;

    if (radius <= 0) {
      this.applyDamage(
        centerEnemy,
        bullet.damage,
        bullet.slow,
        bullet.slowTime,
        bullet.color
      );
      return;
    }

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const dx = enemy.x - centerEnemy.x;
      const dy = enemy.y - centerEnemy.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= radius) {
        const dmg =
          enemy === centerEnemy
            ? bullet.damage
            : Math.max(
                1,
                Math.round(bullet.damage * (bullet.splashFactor || 0.6))
              );

        this.applyDamage(
          enemy,
          dmg,
          bullet.slow,
          bullet.slowTime,
          bullet.color
        );
      }
    }
  }

  handleBossMechanics(enemy) {
    if (enemy.type !== "boss" || !enemy.alive) return;

    if (!enemy.summon70Done && enemy.hp <= enemy.maxHp * 0.7) {
      enemy.summon70Done = true;
      this.spawnChildrenAt(enemy.distance, ["rush", "fast"]);
      this.logText = "Boss 召唤了第一波增援！";
    }

    if (!enemy.enraged && enemy.hp <= enemy.maxHp * 0.45) {
      enemy.enraged = true;
      enemy.speed *= 1.28;
      this.logText = "Boss 进入狂暴状态！";
      this.spawnParticles(enemy.x, enemy.y, "#f97316", 18, 180, 0.4);
    }

    if (!enemy.phase2Done && enemy.hp <= enemy.maxHp * 0.25) {
      enemy.phase2Done = true;
      enemy.shieldHP = Math.max(
        enemy.shieldHP,
        Math.round(enemy.maxShieldHP * 0.9)
      );
      enemy.speed *= 1.12;
      this.spawnChildrenAt(enemy.distance, ["shield", "split", "rush"]);
      this.logText = "Boss 进入第二阶段，并展开护盾！";
      this.spawnParticles(enemy.x, enemy.y, "#22d3ee", 24, 190, 0.45);
    }

    if (!enemy.summon35Done && enemy.hp <= enemy.maxHp * 0.12) {
      enemy.summon35Done = true;
      this.spawnChildrenAt(enemy.distance, ["elite", "rush"]);
      this.logText = "Boss 发动最后召唤！";
    }
  }

  handleCanvasClick(e) {
    if (!this.gameStarted || this.gameOver || this.victory) return;

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;

    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const actionButtons = this.getTowerActionButtons();
    if (actionButtons) {
      const upDist = Math.hypot(
        mx - actionButtons.upgrade.x,
        my - actionButtons.upgrade.y
      );
      const sellDist = Math.hypot(
        mx - actionButtons.sell.x,
        my - actionButtons.sell.y
      );

      if (upDist <= actionButtons.upgrade.r) {
        this.upgradeSelectedTower();
        return;
      }

      if (sellDist <= actionButtons.sell.r) {
        this.sellSelectedTower();
        return;
      }
    }

    for (const spot of this.towerSpots) {
      const d = Math.hypot(mx - spot.x, my - spot.y);
      if (d <= 20) {
        if (spot.tower) {
          this.selectedPlacedTower = spot.tower;
          this.selectedTowerType = null;
          this.playTone(480, 0.05, "triangle", 0.015);
          this.logText = `已选中 ${spot.tower.name}。`;
          this.emitUpdate();
          return;
        } else {
          this.tryPlaceTower(spot);
          return;
        }
      }
    }

    this.selectedPlacedTower = null;
    this.emitUpdate();
  }

  tryPlaceTower(spot) {
    const type = towerTypes[this.selectedTowerType];
    if (!type) {
      this.logText = "请先选择一个塔。";
      this.emitUpdate();
      return;
    }

    if (spot.tower) {
      this.logText = "这个位置已经有塔了。";
      this.emitUpdate();
      return;
    }

    if (this.gold < type.cost) {
      this.logText = "金币不足，无法放置这个塔。";
      this.emitUpdate();
      return;
    }

    this.gold -= type.cost;
    const tower = this.createTower(this.selectedTowerType, spot.x, spot.y);
    tower.spotRef = spot;
    this.towers.push(tower);
    this.stats.towersBuilt += 1;
    spot.tower = tower;
    this.selectedPlacedTower = tower;

    this.score += 10;
    this.spawnParticles(tower.x, tower.y, tower.color, 8, 80, 0.35);
    this.playTone(560, 0.06, "triangle", 0.018);
    this.logText = `已放置 ${tower.name}。`;
    this.emitUpdate();
  }

  countWaveComposition(wave) {
    const count = {};
    wave.forEach((type) => {
      count[type] = (count[type] || 0) + 1;
    });

    return Object.entries(count)
      .map(([type, n]) => `${enemyTypes[type].name} × ${n}`)
      .join(" / ");
  }

  buildSelectedTowerInfoText() {
    if (!this.selectedPlacedTower) {
      return "当前没有选中任何塔。";
    }

    const t = this.selectedPlacedTower;
    return `${t.name}
等级：${t.level}
伤害：${t.damage}
范围：${Math.round(t.range)}
攻速间隔：${t.fireRate.toFixed(2)} 秒
升级花费：${t.level >= 3 ? "已满级" : this.getUpgradeCost(t)}
卖出价格：${this.getSellValue(t)}`;
  }

  buildUIState() {
    return {
      gold: this.gold,
      lives: this.lives,
      waveText: `${Math.max(this.waveIndex + 1, 0)} / ${waves.length}`,
      stateText: !this.gameStarted
        ? "未开始"
        : this.gameOver
          ? "失败"
          : this.victory
            ? "胜利"
            : this.gamePaused
              ? "暂停"
              : this.waveActive
                ? "战斗中"
                : "准备中",
      skillCdText:
        this.skillCooldown <= 0 ? "就绪" : `${this.skillCooldown.toFixed(1)}s`,
      score: this.score,
      mapLabel: maps[this.currentMapKey].label,
      mapDesc: `${maps[this.currentMapKey].desc}\n${maps[this.currentMapKey].effectText || ""}`,
      logText: this.logText,
      nextWaveText:
        this.waveIndex + 1 >= waves.length
          ? "已经没有下一波了。"
          : `第 ${this.waveIndex + 2} 波预览：${this.countWaveComposition(
              waves[this.waveIndex + 1]
            )}`,
      selectedTowerType: this.selectedTowerType,
      selectedTowerInfoText: this.buildSelectedTowerInfoText(),
      canUpgrade:
        !!this.selectedPlacedTower &&
        this.selectedPlacedTower.level < 3 &&
        this.gold >= this.getUpgradeCost(this.selectedPlacedTower),
      canSell: !!this.selectedPlacedTower,
      startWaveDisabled:
        !this.gameStarted ||
        this.waveActive ||
        this.gameOver ||
        this.victory ||
        this.waveIndex >= waves.length - 1,
      pauseDisabled: !this.gameStarted || this.gameOver || this.victory,
      pauseText: this.gamePaused ? "继续游戏" : "暂停游戏",
      skillDisabled:
        !this.gameStarted ||
        this.gameOver ||
        this.victory ||
        this.skillCooldown > 0,
      soundEnabled: this.soundEnabled
    };
  }

  buildResult() {
    return {
      victory: this.victory,
      score: this.score,
      wave: Math.max(this.waveIndex + 1, 0),
      totalWaves: waves.length,
      lives: this.lives,
      gold: this.gold,
      towersCount: this.towers.length,
      difficulty: this.currentDifficulty,
      difficultyLabel: difficulties[this.currentDifficulty].label,
      map: this.currentMapKey,
      mapLabel: maps[this.currentMapKey].label,
      stats: { ...this.stats }
    };
  }

  emitUpdate() {
    if (this.hooks.onUpdate) {
      this.hooks.onUpdate(this.buildUIState());
    }
  }

  update(dt) {
    if (!this.gameStarted) {
      this.emitUpdate();
      return;
    }

    if (this.gameOver || this.victory) {
      if (!this.endNotified) {
        this.endNotified = true;
        if (this.hooks.onGameEnd) {
          this.hooks.onGameEnd(this.buildResult());
        }
      }
      this.emitUpdate();
      return;
    }

    if (this.gamePaused) {
      this.emitUpdate();
      return;
    }

    if (this.skillCooldown > 0) {
      this.skillCooldown -= dt;
      if (this.skillCooldown < 0) this.skillCooldown = 0;
    }

    if (this.globalSlowTimer > 0) {
      this.globalSlowTimer -= dt;
      if (this.globalSlowTimer < 0) this.globalSlowTimer = 0;
    }

    if (this.skillFlashTimer > 0) {
      this.skillFlashTimer -= dt;
      if (this.skillFlashTimer < 0) this.skillFlashTimer = 0;
    }

    if (this.waveActive) {
      this.spawnTimer += dt;

      if (this.spawnQueue.length > 0 && this.spawnTimer >= this.spawnInterval) {
        this.spawnEnemy(this.spawnQueue.shift());
        this.spawnTimer = 0;
      }

      if (this.spawnQueue.length === 0 && this.enemies.length === 0) {
        this.waveActive = false;
        this.score += 40;

        if (this.waveIndex === waves.length - 1) {
          this.victory = true;
          this.playTone(523, 0.08, "triangle", 0.02);
          setTimeout(() => this.playTone(659, 0.08, "triangle", 0.02), 80);
          setTimeout(() => this.playTone(784, 0.1, "triangle", 0.02), 160);
          this.logText = "恭喜你，守住了终点！你赢了！";
        } else {
          this.logText = `第 ${this.waveIndex + 1} 波结束。准备下一波。`;
        }
      }
    }

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;

      if (enemy.slowTimer > 0) {
        enemy.slowTimer -= dt;
        if (enemy.slowTimer <= 0) {
          enemy.slowFactor = 1;
          enemy.slowTimer = 0;
        }
      }

      this.handleBossMechanics(enemy);

      const globalFactor = this.globalSlowTimer > 0 ? 0.65 : 1;
      enemy.distance += enemy.speed * enemy.slowFactor * globalFactor * dt;

      if (enemy.distance >= this.totalPathLength) {
        enemy.alive = false;
        this.lives--;
        this.score = Math.max(0, this.score - 20);
        this.playTone(180, 0.1, "sawtooth", 0.02);

        if (this.lives <= 0) {
          this.lives = 0;
          this.gameOver = true;
          this.logText = "终点失守了，游戏失败。";
        }
      } else {
        const pos = this.getPositionOnPath(enemy.distance);
        enemy.x = pos.x;
        enemy.y = pos.y;
      }
    }

    this.enemies = this.enemies.filter((e) => e.alive);

    for (const tower of this.towers) {
      tower.cooldown -= dt;

      if (tower.cooldown <= 0) {
        const target = this.findTarget(tower);
        if (target) {
          let damage = tower.damage;

          if (tower.type === "sniper" && Math.random() < 0.28) {
            damage = Math.round(damage * 1.7);
          }

          this.bullets.push({
            x: tower.x,
            y: tower.y,
            target,
            speed: tower.bulletSpeed,
            damage,
            color: tower.color,
            radius: tower.type === "bomb" ? 6 : 5,
            slow: tower.slow,
            slowTime: tower.slowTime,
            splashRadius: tower.splashRadius,
            splashFactor: tower.splashFactor
          });

          tower.cooldown = tower.fireRate;
        }
      }
    }

    for (const bullet of this.bullets) {
      if (!bullet.target || !bullet.target.alive) {
        bullet.dead = true;
        continue;
      }

      const dx = bullet.target.x - bullet.x;
      const dy = bullet.target.y - bullet.y;
      const dist = Math.hypot(dx, dy);
      const move = bullet.speed * dt;

      if (dist <= move || dist < 8) {
        this.applySplashDamage(bullet.target, bullet);
        bullet.dead = true;
      } else {
        bullet.x += (dx / dist) * move;
        bullet.y += (dy / dist) * move;
      }
    }

    this.bullets = this.bullets.filter((b) => !b.dead);

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
    }

    this.particles = this.particles.filter((p) => p.life > 0);

    this.emitUpdate();
  }

  drawPath() {
    const ctx = this.ctx;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = ROAD_OUTER_WIDTH;
    ctx.beginPath();
    ctx.moveTo(this.currentPath[0].x, this.currentPath[0].y);
    for (let i = 1; i < this.currentPath.length; i++) {
      ctx.lineTo(this.currentPath[i].x, this.currentPath[i].y);
    }
    ctx.stroke();

    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = ROAD_INNER_WIDTH;
    ctx.beginPath();
    ctx.moveTo(this.currentPath[0].x, this.currentPath[0].y);
    for (let i = 1; i < this.currentPath.length; i++) {
      ctx.lineTo(this.currentPath[i].x, this.currentPath[i].y);
    }
    ctx.stroke();

    ctx.restore();

    ctx.fillStyle = "#16a34a";
    ctx.beginPath();
    ctx.arc(this.currentPath[0].x + 18, this.currentPath[0].y, 12, 0, Math.PI * 2);
    ctx.fill();

    const end = this.currentPath[this.currentPath.length - 1];
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(end.x - 18, end.y - 24, 18, 48);

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 13px Microsoft YaHei";
    ctx.fillText("起点", this.currentPath[0].x + 4, this.currentPath[0].y - 20);
    ctx.fillText("终点", end.x - 42, end.y - 30);
  }

  drawTowerSpots() {
    const ctx = this.ctx;
    for (const spot of this.towerSpots) {
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, 19, 0, Math.PI * 2);
      ctx.fillStyle = spot.tower
        ? "#94a3b8"
        : this.selectedTowerType
          ? "#bfdbfe"
          : "#e2e8f0";
      ctx.fill();
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  drawSelectedTowerRange() {
    if (!this.selectedPlacedTower) return;

    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.arc(
      this.selectedPlacedTower.x,
      this.selectedPlacedTower.y,
      this.selectedPlacedTower.range,
      0,
      Math.PI * 2
    );
    ctx.strokeStyle = "rgba(37, 99, 235, 0.35)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.restore();
  }

  drawTowers() {
    const ctx = this.ctx;

    for (const tower of this.towers) {
      ctx.fillStyle = tower.color;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, tower.size, 0, Math.PI * 2);
      ctx.fill();

      if (tower === this.selectedPlacedTower) {
        ctx.strokeStyle = "#111827";
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px Microsoft YaHei";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tower.label, tower.x, tower.y + 1);

      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 10px Microsoft YaHei";
      ctx.fillText(`Lv${tower.level}`, tower.x, tower.y - tower.size - 10);
    }
  }

  drawEnemies() {
    const ctx = this.ctx;

    for (const enemy of this.enemies) {
      if (enemy.type === "boss" && enemy.enraged) {
        ctx.strokeStyle = "#f97316";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (enemy.type === "boss" && enemy.phase2Done) {
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 13, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();

      const barWidth = enemy.radius * 2;
      const hpRatio = Math.max(enemy.hp, 0) / enemy.maxHp;

      ctx.fillStyle = "#1f2937";
      ctx.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.radius - 14, barWidth, 5);

      ctx.fillStyle = "#22c55e";
      ctx.fillRect(
        enemy.x - barWidth / 2,
        enemy.y - enemy.radius - 14,
        barWidth * hpRatio,
        5
      );

      if (enemy.maxShieldHP > 0 && enemy.shieldHP > 0) {
        const shieldRatio = enemy.shieldHP / enemy.maxShieldHP;
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(
          enemy.x - barWidth / 2,
          enemy.y - enemy.radius - 22,
          barWidth,
          4
        );
        ctx.fillStyle = "#38bdf8";
        ctx.fillRect(
          enemy.x - barWidth / 2,
          enemy.y - enemy.radius - 22,
          barWidth * shieldRatio,
          4
        );
      }

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px Microsoft YaHei";
      ctx.textAlign = "center";
      ctx.fillText(enemy.label, enemy.x, enemy.y + 1);

      if (enemy.slowTimer > 0 || this.globalSlowTimer > 0) {
        ctx.strokeStyle = "#7c3aed";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  drawBullets() {
    const ctx = this.ctx;

    for (const bullet of this.bullets) {
      ctx.fillStyle = bullet.color;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawParticles() {
    const ctx = this.ctx;

    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  drawPauseOverlay() {
    if (!this.gamePaused || this.gameOver || this.victory || !this.gameStarted) return;

    const ctx = this.ctx;
    ctx.fillStyle = "rgba(15, 23, 42, 0.42)";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 40px Microsoft YaHei";
    ctx.fillText("暂停中", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10);
    ctx.font = "18px Microsoft YaHei";
    ctx.fillText("点击“继续游戏”恢复战斗", GAME_WIDTH / 2, GAME_HEIGHT / 2 + 28);
  }

  drawSkillFlash() {
    if (this.skillFlashTimer <= 0) return;

    const ctx = this.ctx;
    const alpha = this.skillFlashTimer / 0.35;
    ctx.fillStyle = `rgba(124, 58, 237, ${0.18 * alpha})`;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  draw() {
    this.ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.drawPath();
    this.drawTowerSpots();
    this.drawSelectedTowerRange();
    this.drawTowers();
    this.drawTowerActionButtons();
    this.drawEnemies();
    this.drawBullets();
    this.drawParticles();
    this.drawSkillFlash();
    this.drawPauseOverlay();
  }

  loop(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    const dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    this.update(Math.min(dt, 0.033));
    this.draw();

    requestAnimationFrame(this.loop.bind(this));
  }
}
