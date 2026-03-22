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
    gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);
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
    this.currentPath = maps[this.currentMapKey].path.map(p => ({ ...p }));
    this.towerSpots = maps[this.currentMapKey].spots.map(s => ({ x: s.x, y: s.y, tower: null }));
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

  getSellValue(tower) {import { difficulties, maps, towerTypes, enemyTypes } from "./data.js";
import {
  submitScore,
  fetchLeaderboard,
  registerUser,
  loginUser,
  logoutUser,
  watchAuth,
  getCurrentNickname
} from "./firebase.js";
import { Game } from "./game.js";
import {
  loadSave,
  addMetaCoins,
  setStars,
  getStars,
  unlockRequirements,
  achievementList,
  getAchievementProgress,
  getUnlockedAchievements,
  unlockAchievement,
  getBestScore,
  setBestScore
} from "./save.js";

const game = new Game(document.getElementById("gameCanvas"), {
  onUpdate: handleGameUpdate,
  onGameEnd: handleGameEnd
});

const goldText = document.getElementById("goldText");
const livesText = document.getElementById("livesText");
const waveText = document.getElementById("waveText");
const stateText = document.getElementById("stateText");
const skillCdText = document.getElementById("skillCdText");
const scoreText = document.getElementById("scoreText");
const mapText = document.getElementById("mapText");
const logBox = document.getElementById("logBox");
const descBox = document.getElementById("descBox");
const selectedTowerInfo = document.getElementById("selectedTowerInfo");
const wavePreviewBox = document.getElementById("wavePreviewBox");
const mapInfoBox = document.getElementById("mapInfoBox");

const lampBtn = document.getElementById("lampBtn");
const coffeeBtn = document.getElementById("coffeeBtn");
const bookBtn = document.getElementById("bookBtn");
const bombBtn = document.getElementById("bombBtn");
const sniperBtn = document.getElementById("sniperBtn");

const startWaveBtn = document.getElementById("startWaveBtn");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");
const upgradeBtn = document.getElementById("upgradeBtn");
const sellBtn = document.getElementById("sellBtn");
const skillBtn = document.getElementById("skillBtn");
const soundBtn = document.getElementById("soundBtn");

const startOverlay = document.getElementById("startOverlay");
const resultOverlay = document.getElementById("resultOverlay");
const codexOverlay = document.getElementById("codexOverlay");

const startGameBtn = document.getElementById("startGameBtn");
const playAgainBtn = document.getElementById("playAgainBtn");
const backTitleBtn = document.getElementById("backTitleBtn");
const codexBtn = document.getElementById("codexBtn");
const closeCodexBtn = document.getElementById("closeCodexBtn");

const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const difficultyInfo = document.getElementById("difficultyInfo");
const mapSelectInfo = document.getElementById("mapSelectInfo");
const saveSummaryBox = document.getElementById("saveSummaryBox");
const achievementSummaryBox = document.getElementById("achievementSummaryBox");
const difficultyButtons = [...document.querySelectorAll(".difficulty-btn")];
const mapButtons = [...document.querySelectorAll(".map-btn")];
const nicknameInput = document.getElementById("nicknameInput");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const authStatus = document.getElementById("authStatus");
const codexContent = document.getElementById("codexContent");

const leaderboardBox = document.getElementById("leaderboardBox");
const leaderboardStatus = document.getElementById("leaderboardStatus");
const resultLeaderboardBox = document.getElementById("resultLeaderboardBox");
const resultLeaderboardStatus = document.getElementById("resultLeaderboardStatus");

const globalRankTab = document.getElementById("globalRankTab");
const difficultyRankTab = document.getElementById("difficultyRankTab");
const resultGlobalRankTab = document.getElementById("resultGlobalRankTab");
const resultDifficultyRankTab = document.getElementById("resultDifficultyRankTab");

const resultTitle = document.getElementById("resultTitle");
const resultSubtitle = document.getElementById("resultSubtitle");
const resultBox = document.getElementById("resultBox");

let currentDifficulty = "easy";
let currentMap = "dorm";

let playerNickname = "";
let currentUser = null;

let leaderboardCache = [];
let lastSubmittedDocId = null;
let rankMode = "global";
let resultRankMode = "global";
let scoreSubmitted = false;
let lastResult = null;

const DEFAULT_DESC =
`选择一个塔，然后点击地图上的圆形空位放置。

台灯塔：基础输出，便宜。
咖啡塔：伤害较低，但会减速。
书本塔：单发高伤，适合打厚血怪。
范围塔：群体伤害，适合清杂兵。
狙击塔：远距离高伤，适合打精英和Boss。`;

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function validateNickname(name) {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 20;
}

function validateEmail(email) {
  return /\S+@\S+\.\S+/.test(email.trim());
}

function calcStars(result) {
  const maxLives = difficulties[result.difficulty].startLives;
  if (!result.victory) {
    if (result.wave >= result.totalWaves - 1) return 1;
    return 0;
  }

  if (result.lives >= Math.ceil(maxLives * 0.65)) return 3;
  if (result.lives >= 1) return 2;
  return 1;
}

function starText(stars) {
  return "★".repeat(stars) + "☆".repeat(3 - stars);
}

function calcMetaReward(result, stars) {
  return Math.max(
    20,
    Math.round(result.score / 8) + (result.victory ? 60 : result.wave * 8) + stars * 15
  );
}

function sortLeaderboard(list) {
  return [...list].sort((a, b) => {
    if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
    if ((b.wave || 0) !== (a.wave || 0)) return (b.wave || 0) - (a.wave || 0);
    return 0;
  });
}

function getFilteredLeaderboard(mode) {
  let list = sortLeaderboard(leaderboardCache);
  if (mode === "difficulty") {
    list = list.filter(item => item.difficulty === currentDifficulty);
  }
  return list;
}

function getRankInfo(mode, docId) {
  if (!docId) return null;
  const list = getFilteredLeaderboard(mode);
  const index = list.findIndex(item => item.id === docId);
  return index >= 0 ? index + 1 : null;
}

function updateTowerButtons() {
  const save = loadSave();

  const configs = [
    { key: "lamp", el: lampBtn },
    { key: "coffee", el: coffeeBtn },
    { key: "book", el: bookBtn },
    { key: "bomb", el: bombBtn },
    { key: "sniper", el: sniperBtn }
  ];

  for (const item of configs) {
    const tower = towerTypes[item.key];
    const unlocked = !!save.unlocks[item.key];
    const need = unlockRequirements[item.key];

    if (unlocked) {
      item.el.disabled = false;
      item.el.textContent = `${tower.name}（${tower.cost}）`;
    } else {
      item.el.disabled = true;
      item.el.textContent = `${tower.name}（${tower.cost}）🔒${need}`;
    }
  }
}

function updateSaveSummary() {
  const save = loadSave();
  const stars = getStars(currentMap, currentDifficulty);
  const bestScore = getBestScore(currentMap, currentDifficulty);
  const unlocked = Object.entries(save.unlocks)
    .filter(([, v]) => v)
    .map(([k]) => towerTypes[k].name)
    .join("、");

  saveSummaryBox.textContent =
`局外金币：${save.metaCoins}
当前地图星级：${"★".repeat(stars)}${"☆".repeat(3 - stars)}
当前地图最高分：${bestScore}
已解锁防御塔：${unlocked}

解锁条件：
范围塔：${unlockRequirements.bomb} 金币
狙击塔：${unlockRequirements.sniper} 金币`;
}

function updateAchievementSummary() {
  const progress = getAchievementProgress();
  const unlocked = getUnlockedAchievements().map(a => a.title).slice(-3);

  achievementSummaryBox.textContent =
`成就进度：${progress.unlocked} / ${progress.total}
${unlocked.length ? "最近已达成：" + unlocked.join("、") : "还没有达成成就，继续挑战吧。"}`;
}

function buildCodexHTML() {
  const save = loadSave();

  const towerHtml = Object.entries(towerTypes).map(([key, tower]) => {
    const unlocked = !!save.unlocks[key];
    return `
      <div style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
        <div style="font-weight:900;">${tower.name}${unlocked ? "" : "（未解锁）"}</div>
        <div>花费：${tower.cost}</div>
        <div>${tower.description}</div>
      </div>
    `;
  }).join("");

  const enemyHtml = Object.values(enemyTypes).map(enemy => `
    <div style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
      <div style="font-weight:900;">${enemy.name}</div>
      <div>血量：${enemy.hp} ｜ 速度：${enemy.speed}</div>
      <div>${enemy.desc || ""}</div>
    </div>
  `).join("");

  const mapHtml = Object.values(maps).map(map => `
    <div style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
      <div style="font-weight:900;">${map.label}</div>
      <div>${map.desc}</div>
      <div>${map.effectText || ""}</div>
    </div>
  `).join("");

  const achievementHtml = achievementList.map(a => {
    const unlocked = save.achievements[a.key];
    return `
      <div style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
        <div style="font-weight:900;">${a.title}${unlocked ? "（已达成）" : "（未达成）"}</div>
        <div>${a.desc}</div>
      </div>
    `;
  }).join("");

  return `
    <div style="font-weight:900;font-size:18px;margin-bottom:8px;">防御塔</div>
    ${towerHtml}
    <div style="font-weight:900;font-size:18px;margin:18px 0 8px;">敌人</div>
    ${enemyHtml}
    <div style="font-weight:900;font-size:18px;margin:18px 0 8px;">地图效果</div>
    ${mapHtml}
    <div style="font-weight:900;font-size:18px;margin:18px 0 8px;">成就</div>
    ${achievementHtml}
  `;
}

function updateCodex() {
  codexContent.innerHTML = buildCodexHTML();
}

function updateAuthUI(user) {
  currentUser = user;
  playerNickname = user ? (user.displayName || getCurrentNickname()) : "";

  if (user) {
    authStatus.textContent = `已登录：${playerNickname || "未命名用户"}（${user.email || ""}）`;
    if (playerNickname) nicknameInput.value = playerNickname;
    if (user.email) emailInput.value = user.email;
    startGameBtn.disabled = false;
  } else {
    authStatus.textContent = "未登录，请先注册或登录。";
    startGameBtn.disabled = true;
  }
}

function handleGameUpdate(ui) {
  goldText.textContent = ui.gold;
  livesText.textContent = ui.lives;
  waveText.textContent = ui.waveText;
  stateText.textContent = ui.stateText;
  skillCdText.textContent = ui.skillCdText;
  scoreText.textContent = ui.score;
  mapText.textContent = ui.mapLabel;
  logBox.textContent = ui.logText;
  wavePreviewBox.textContent = ui.nextWaveText;
  selectedTowerInfo.textContent = ui.selectedTowerInfoText;
  mapInfoBox.textContent = ui.mapDesc;

  startWaveBtn.disabled = ui.startWaveDisabled;
  pauseBtn.disabled = ui.pauseDisabled;
  pauseBtn.textContent = ui.pauseText;
  skillBtn.disabled = ui.skillDisabled;
  upgradeBtn.disabled = !ui.canUpgrade;
  sellBtn.disabled = !ui.canSell;

  soundBtn.textContent = ui.soundEnabled ? "音效：开启" : "音效：关闭";
  soundBtn.classList.toggle("sound-on", ui.soundEnabled);
  soundBtn.classList.toggle("sound-off", !ui.soundEnabled);

  lampBtn.classList.toggle("active", ui.selectedTowerType === "lamp");
  coffeeBtn.classList.toggle("active", ui.selectedTowerType === "coffee");
  bookBtn.classList.toggle("active", ui.selectedTowerType === "book");
  bombBtn.classList.toggle("active", ui.selectedTowerType === "bomb");
  sniperBtn.classList.toggle("active", ui.selectedTowerType === "sniper");

  if (ui.selectedTowerType && towerTypes[ui.selectedTowerType]) {
    descBox.textContent = towerTypes[ui.selectedTowerType].description;
  } else {
    descBox.textContent = DEFAULT_DESC;
  }

  updateTowerButtons();
}

function setDifficulty(diff) {
  currentDifficulty = diff;
  difficultyButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.difficulty === diff);
  });
  difficultyInfo.textContent = difficulties[diff].desc;
  game.setDifficulty(diff);
  updateSaveSummary();
  renderLeaderboards();
}

function setMap(mapKey) {
  currentMap = mapKey;
  mapButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.map === mapKey);
  });
  mapSelectInfo.textContent = `${maps[mapKey].desc}\n${maps[mapKey].effectText || ""}`;
  game.setMap(mapKey);
  updateSaveSummary();
}

function renderLeaderboardTo(container, mode) {
  let list = getFilteredLeaderboard(mode).slice(0, 20);

  if (!list.length) {
    container.innerHTML = "暂无记录。";
    return;
  }

  container.innerHTML = list.map((item, idx) => `
    <div class="rank-item ${item.id === lastSubmittedDocId ? "self" : ""}">
      <div class="rank-index">#${idx + 1}</div>
      <div>
        <div class="rank-name">${escapeHTML(item.nickname)}${item.id === lastSubmittedDocId ? "（你）" : ""}</div>
        <div class="rank-meta">${difficulties[item.difficulty]?.label || item.difficulty} · 波次 ${item.wave || 0}</div>
      </div>
      <div class="rank-score">${item.score || 0}</div>
    </div>
  `).join("");
}

function renderLeaderboards() {
  renderLeaderboardTo(leaderboardBox, rankMode);
  renderLeaderboardTo(resultLeaderboardBox, resultRankMode);
}

async function refreshLeaderboards() {
  leaderboardStatus.textContent = "正在刷新排行榜...";
  resultLeaderboardStatus.textContent = "正在刷新排行榜...";

  try {
    leaderboardCache = await fetchLeaderboard(200);
    renderLeaderboards();

    const globalRank = getRankInfo("global", lastSubmittedDocId);
    const difficultyRank = getRankInfo("difficulty", lastSubmittedDocId);

    leaderboardStatus.textContent = "全球排行榜已更新。";

    if (lastSubmittedDocId) {
      resultLeaderboardStatus.textContent =
        `你的全球排名：${globalRank ? "#" + globalRank : "200+"} ｜ 当前难度排名：${difficultyRank ? "#" + difficultyRank : "200+"}`;
    } else {
      resultLeaderboardStatus.textContent = "排行榜已更新。";
    }
  } catch (err) {
    console.error(err);
    leaderboardBox.innerHTML = "排行榜读取失败。";
    resultLeaderboardBox.innerHTML = "排行榜读取失败。";
    leaderboardStatus.textContent = "请检查 Firestore 规则、网络，或确认已用 GitHub Pages 打开。";
    resultLeaderboardStatus.textContent = "排行榜读取失败。";
  }
}

function setRankMode(mode) {
  rankMode = mode;
  globalRankTab.classList.toggle("active", mode === "global");
  difficultyRankTab.classList.toggle("active", mode === "difficulty");
  renderLeaderboards();
}

function setResultRankMode(mode) {
  resultRankMode = mode;
  resultGlobalRankTab.classList.toggle("active", mode === "global");
  resultDifficultyRankTab.classList.toggle("active", mode === "difficulty");
  renderLeaderboards();
}

async function handleGameEnd(result) {
  lastResult = result;
  const stars = calcStars(result);
  const beforeSave = loadSave();
  const reward = calcMetaReward(result, stars);

  setStars(result.map, result.difficulty, stars);
  setBestScore(result.map, result.difficulty, result.score);
  const afterSave = addMetaCoins(reward);

  const newlyUnlocked = [];
  if (!beforeSave.unlocks.bomb && afterSave.unlocks.bomb) newlyUnlocked.push("范围塔");
  if (!beforeSave.unlocks.sniper && afterSave.unlocks.sniper) newlyUnlocked.push("狙击塔");

  const newlyAchievements = [];
  if (result.victory && unlockAchievement("first_win")) newlyAchievements.push("初次胜利");
  if (result.stats.bossKills > 0 && unlockAchievement("boss_slayer")) newlyAchievements.push("Boss 终结者");
  if (result.victory && result.difficulty === "hard" && unlockAchievement("hard_win")) newlyAchievements.push("困难征服者");
  if (result.victory && result.stats.towersSold === 0 && unlockAchievement("no_sell_win")) newlyAchievements.push("稳健经营");
  if (result.victory && result.stats.towersBuilt <= 5 && unlockAchievement("small_team_win")) newlyAchievements.push("精简布阵");

  const newestSave = loadSave();
  if (newestSave.unlocks.bomb && newestSave.unlocks.sniper && unlockAchievement("arsenal_master")) {
    newlyAchievements.push("军火大师");
  }

  resultTitle.textContent = result.victory ? "胜利！" : "失败！";
  resultSubtitle.textContent = result.victory ? "你成功守住了终点。" : "防线被突破了。";

  resultBox.textContent =
`评级：${starText(stars)}
玩家：${playerNickname}
难度：${result.difficultyLabel}
地图：${result.mapLabel}
最终波次：${result.wave} / ${result.totalWaves}
剩余基地血量：${result.lives}
剩余金币：${result.gold}
击杀数：${result.stats.kills}
建塔数：${result.stats.towersBuilt}
卖塔数：${result.stats.towersSold}
技能次数：${result.stats.skillsUsed}
本局分数：${result.score}
获得局外金币：${reward}

${newlyUnlocked.length ? "新解锁：" + newlyUnlocked.join("、") : "本次没有新解锁。"}
${newlyAchievements.length ? "新成就：" + newlyAchievements.join("、") : "本次没有新成就。"}
${result.victory ? "干得漂亮，你守住了最后一波。" : "别灰心，调整塔的位置和升级顺序再试一次。"}`;

  resultOverlay.classList.remove("hidden");
  updateSaveSummary();
  updateAchievementSummary();
  updateTowerButtons();
  updateCodex();

  if (!scoreSubmitted && result.score > 0 && currentUser && playerNickname) {
    scoreSubmitted = true;
    resultLeaderboardStatus.textContent = "正在提交分数...";
    try {
      lastSubmittedDocId = await submitScore({
        nickname: playerNickname,
        score: result.score,
        wave: result.wave,
        difficulty: result.difficulty
      });
    } catch (err) {
      console.error(err);
      resultLeaderboardStatus.textContent = "成绩提交失败，请检查 Firestore 规则或网络。";
    }
  }

  await refreshLeaderboards();
}

function chooseTower(type) {
  const save = loadSave();
  if (!save.unlocks[type]) return;
  game.setSelectedTowerType(type);
  descBox.textContent = towerTypes[type].description;
}

registerBtn.addEventListener("click", async () => {
  const nickname = nicknameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!validateNickname(nickname)) {
    authStatus.textContent = "注册时请输入 1 到 20 个字符的固定昵称。";
    return;
  }
  if (!validateEmail(email)) {
    authStatus.textContent = "请输入正确的邮箱地址。";
    return;
  }
  if (password.length < 6) {
    authStatus.textContent = "密码至少 6 位。";
    return;
  }

  authStatus.textContent = "注册中...";
  try {
    await registerUser({ email, password, nickname });
    authStatus.textContent = "注册成功，已自动登录。";
  } catch (err) {
    console.error(err);
    authStatus.textContent = `注册失败：${err.code || err.message}`;
  }
});

loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!validateEmail(email)) {
    authStatus.textContent = "请输入正确的邮箱地址。";
    return;
  }
  if (!password) {
    authStatus.textContent = "请输入密码。";
    return;
  }

  authStatus.textContent = "登录中...";
  try {
    await loginUser({ email, password });
    authStatus.textContent = "登录成功。";
  } catch (err) {
    console.error(err);
    authStatus.textContent = `登录失败：${err.code || err.message}`;
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await logoutUser();
    authStatus.textContent = "已退出登录。";
  } catch (err) {
    console.error(err);
    authStatus.textContent = `退出失败：${err.code || err.message}`;
  }
});

lampBtn.addEventListener("click", () => chooseTower("lamp"));
coffeeBtn.addEventListener("click", () => chooseTower("coffee"));
bookBtn.addEventListener("click", () => chooseTower("book"));
bombBtn.addEventListener("click", () => chooseTower("bomb"));
sniperBtn.addEventListener("click", () => chooseTower("sniper"));

startWaveBtn.addEventListener("click", () => game.startNextWave());
pauseBtn.addEventListener("click", () => game.togglePause());
restartBtn.addEventListener("click", () => {
  scoreSubmitted = false;
  lastSubmittedDocId = null;
  lastResult = null;
  game.restartGame();
});
upgradeBtn.addEventListener("click", () => game.upgradeSelectedTower());
sellBtn.addEventListener("click", () => game.sellSelectedTower());
skillBtn.addEventListener("click", () => game.castSkill());
soundBtn.addEventListener("click", () => game.toggleSound());

difficultyButtons.forEach(btn => {
  btn.addEventListener("click", () => setDifficulty(btn.dataset.difficulty));
});

mapButtons.forEach(btn => {
  btn.addEventListener("click", () => setMap(btn.dataset.map));
});

globalRankTab.addEventListener("click", () => setRankMode("global"));
difficultyRankTab.addEventListener("click", () => setRankMode("difficulty"));
resultGlobalRankTab.addEventListener("click", () => setResultRankMode("global"));
resultDifficultyRankTab.addEventListener("click", () => setResultRankMode("difficulty"));

codexBtn.addEventListener("click", () => {
  updateCodex();
  codexOverlay.classList.remove("hidden");
});

closeCodexBtn.addEventListener("click", () => {
  codexOverlay.classList.add("hidden");
});

startGameBtn.addEventListener("click", () => {
  if (!currentUser) {
    authStatus.textContent = "请先注册或登录，再开始游戏。";
    return;
  }

  playerNickname = getCurrentNickname();
  if (!playerNickname) {
    authStatus.textContent = "当前账号没有昵称，请重新注册。";
    return;
  }

  scoreSubmitted = false;
  lastSubmittedDocId = null;
  lastResult = null;

  startOverlay.classList.add("hidden");
  resultOverlay.classList.add("hidden");
  codexOverlay.classList.add("hidden");
  game.startNewGame();
});

playAgainBtn.addEventListener("click", () => {
  if (!currentUser) {
    resultLeaderboardStatus.textContent = "请先登录。";
    return;
  }
  scoreSubmitted = false;
  lastSubmittedDocId = null;
  lastResult = null;
  resultOverlay.classList.add("hidden");
  game.startNewGame();
});

backTitleBtn.addEventListener("click", async () => {
  resultOverlay.classList.add("hidden");
  startOverlay.classList.remove("hidden");
  lastResult = null;
  scoreSubmitted = false;
  updateSaveSummary();
  updateAchievementSummary();
  updateTowerButtons();
  updateCodex();
  await refreshLeaderboards();
});

watchAuth(user => {
  updateAuthUI(user);
});

setDifficulty("easy");
setMap("dorm");
setRankMode("global");
setResultRankMode("global");
updateSaveSummary();
updateAchievementSummary();
updateTowerButtons();
updateCodex();
refreshLeaderboards();
    return Math.round(tower.spent * 0.65);
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

    this.towers = this.towers.filter(t => t !== tower);
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
        x, y,
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

    this.spawnParticles(enemy.x, enemy.y, enemy.color, enemy.type === "boss" ? 28 : 14, 150, 0.45);
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
      this.applyDamage(centerEnemy, bullet.damage, bullet.slow, bullet.slowTime, bullet.color);
      return;
    }

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const dx = enemy.x - centerEnemy.x;
      const dy = enemy.y - centerEnemy.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= radius) {
        const dmg = enemy === centerEnemy
          ? bullet.damage
          : Math.max(1, Math.round(bullet.damage * (bullet.splashFactor || 0.6)));
        this.applyDamage(enemy, dmg, bullet.slow, bullet.slowTime, bullet.color);
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
      enemy.shieldHP = Math.max(enemy.shieldHP, Math.round(enemy.maxShieldHP * 0.9));
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

  import { difficulties, maps, towerTypes, enemyTypes } from "./data.js";
import {
  submitScore,
  fetchLeaderboard,
  registerUser,
  loginUser,
  logoutUser,
  watchAuth,
  getCurrentNickname
} from "./firebase.js";
import { Game } from "./game.js";
import {
  loadSave,
  addMetaCoins,
  setStars,
  getStars,
  unlockRequirements,
  achievementList,
  getAchievementProgress,
  getUnlockedAchievements,
  unlockAchievement,
  getBestScore,
  setBestScore
} from "./save.js";

const game = new Game(document.getElementById("gameCanvas"), {
  onUpdate: handleGameUpdate,
  onGameEnd: handleGameEnd
});

const goldText = document.getElementById("goldText");
const livesText = document.getElementById("livesText");
const waveText = document.getElementById("waveText");
const stateText = document.getElementById("stateText");
const skillCdText = document.getElementById("skillCdText");
const scoreText = document.getElementById("scoreText");
const mapText = document.getElementById("mapText");
const logBox = document.getElementById("logBox");
const descBox = document.getElementById("descBox");
const selectedTowerInfo = document.getElementById("selectedTowerInfo");
const wavePreviewBox = document.getElementById("wavePreviewBox");
const mapInfoBox = document.getElementById("mapInfoBox");

const lampBtn = document.getElementById("lampBtn");
const coffeeBtn = document.getElementById("coffeeBtn");
const bookBtn = document.getElementById("bookBtn");
const bombBtn = document.getElementById("bombBtn");
const sniperBtn = document.getElementById("sniperBtn");

const startWaveBtn = document.getElementById("startWaveBtn");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");
const upgradeBtn = document.getElementById("upgradeBtn");
const sellBtn = document.getElementById("sellBtn");
const skillBtn = document.getElementById("skillBtn");
const soundBtn = document.getElementById("soundBtn");

const startOverlay = document.getElementById("startOverlay");
const resultOverlay = document.getElementById("resultOverlay");
const codexOverlay = document.getElementById("codexOverlay");

const startGameBtn = document.getElementById("startGameBtn");
const playAgainBtn = document.getElementById("playAgainBtn");
const backTitleBtn = document.getElementById("backTitleBtn");
const codexBtn = document.getElementById("codexBtn");
const closeCodexBtn = document.getElementById("closeCodexBtn");

const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const difficultyInfo = document.getElementById("difficultyInfo");
const mapSelectInfo = document.getElementById("mapSelectInfo");
const saveSummaryBox = document.getElementById("saveSummaryBox");
const achievementSummaryBox = document.getElementById("achievementSummaryBox");
const difficultyButtons = [...document.querySelectorAll(".difficulty-btn")];
const mapButtons = [...document.querySelectorAll(".map-btn")];
const nicknameInput = document.getElementById("nicknameInput");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const authStatus = document.getElementById("authStatus");
const codexContent = document.getElementById("codexContent");

const leaderboardBox = document.getElementById("leaderboardBox");
const leaderboardStatus = document.getElementById("leaderboardStatus");
const resultLeaderboardBox = document.getElementById("resultLeaderboardBox");
const resultLeaderboardStatus = document.getElementById("resultLeaderboardStatus");

const globalRankTab = document.getElementById("globalRankTab");
const difficultyRankTab = document.getElementById("difficultyRankTab");
const resultGlobalRankTab = document.getElementById("resultGlobalRankTab");
const resultDifficultyRankTab = document.getElementById("resultDifficultyRankTab");

const resultTitle = document.getElementById("resultTitle");
const resultSubtitle = document.getElementById("resultSubtitle");
const resultBox = document.getElementById("resultBox");

let currentDifficulty = "easy";
let currentMap = "dorm";

let playerNickname = "";
let currentUser = null;

let leaderboardCache = [];
let lastSubmittedDocId = null;
let rankMode = "global";
let resultRankMode = "global";
let scoreSubmitted = false;
let lastResult = null;

const DEFAULT_DESC =
`选择一个塔，然后点击地图上的圆形空位放置。

台灯塔：基础输出，便宜。
咖啡塔：伤害较低，但会减速。
书本塔：单发高伤，适合打厚血怪。
范围塔：群体伤害，适合清杂兵。
狙击塔：远距离高伤，适合打精英和Boss。`;

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function validateNickname(name) {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 20;
}

function validateEmail(email) {
  return /\S+@\S+\.\S+/.test(email.trim());
}

function calcStars(result) {
  const maxLives = difficulties[result.difficulty].startLives;
  if (!result.victory) {
    if (result.wave >= result.totalWaves - 1) return 1;
    return 0;
  }

  if (result.lives >= Math.ceil(maxLives * 0.65)) return 3;
  if (result.lives >= 1) return 2;
  return 1;
}

function starText(stars) {
  return "★".repeat(stars) + "☆".repeat(3 - stars);
}

function calcMetaReward(result, stars) {
  return Math.max(
    20,
    Math.round(result.score / 8) + (result.victory ? 60 : result.wave * 8) + stars * 15
  );
}

function sortLeaderboard(list) {
  return [...list].sort((a, b) => {
    if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
    if ((b.wave || 0) !== (a.wave || 0)) return (b.wave || 0) - (a.wave || 0);
    return 0;
  });
}

function getFilteredLeaderboard(mode) {
  let list = sortLeaderboard(leaderboardCache);
  if (mode === "difficulty") {
    list = list.filter(item => item.difficulty === currentDifficulty);
  }
  return list;
}

function getRankInfo(mode, docId) {
  if (!docId) return null;
  const list = getFilteredLeaderboard(mode);
  const index = list.findIndex(item => item.id === docId);
  return index >= 0 ? index + 1 : null;
}

function updateTowerButtons() {
  const save = loadSave();

  const configs = [
    { key: "lamp", el: lampBtn },
    { key: "coffee", el: coffeeBtn },
    { key: "book", el: bookBtn },
    { key: "bomb", el: bombBtn },
    { key: "sniper", el: sniperBtn }
  ];

  for (const item of configs) {
    const tower = towerTypes[item.key];
    const unlocked = !!save.unlocks[item.key];
    const need = unlockRequirements[item.key];

    if (unlocked) {
      item.el.disabled = false;
      item.el.textContent = `${tower.name}（${tower.cost}）`;
    } else {
      item.el.disabled = true;
      item.el.textContent = `${tower.name}（${tower.cost}）🔒${need}`;
    }
  }
}

function updateSaveSummary() {
  const save = loadSave();
  const stars = getStars(currentMap, currentDifficulty);
  const bestScore = getBestScore(currentMap, currentDifficulty);
  const unlocked = Object.entries(save.unlocks)
    .filter(([, v]) => v)
    .map(([k]) => towerTypes[k].name)
    .join("、");

  saveSummaryBox.textContent =
`局外金币：${save.metaCoins}
当前地图星级：${"★".repeat(stars)}${"☆".repeat(3 - stars)}
当前地图最高分：${bestScore}
已解锁防御塔：${unlocked}

解锁条件：
范围塔：${unlockRequirements.bomb} 金币
狙击塔：${unlockRequirements.sniper} 金币`;
}

function updateAchievementSummary() {
  const progress = getAchievementProgress();
  const unlocked = getUnlockedAchievements().map(a => a.title).slice(-3);

  achievementSummaryBox.textContent =
`成就进度：${progress.unlocked} / ${progress.total}
${unlocked.length ? "最近已达成：" + unlocked.join("、") : "还没有达成成就，继续挑战吧。"}`;
}

function buildCodexHTML() {
  const save = loadSave();

  const towerHtml = Object.entries(towerTypes).map(([key, tower]) => {
    const unlocked = !!save.unlocks[key];
    return `
      <div style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
        <div style="font-weight:900;">${tower.name}${unlocked ? "" : "（未解锁）"}</div>
        <div>花费：${tower.cost}</div>
        <div>${tower.description}</div>
      </div>
    `;
  }).join("");

  const enemyHtml = Object.values(enemyTypes).map(enemy => `
    <div style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
      <div style="font-weight:900;">${enemy.name}</div>
      <div>血量：${enemy.hp} ｜ 速度：${enemy.speed}</div>
      <div>${enemy.desc || ""}</div>
    </div>
  `).join("");

  const mapHtml = Object.values(maps).map(map => `
    <div style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
      <div style="font-weight:900;">${map.label}</div>
      <div>${map.desc}</div>
      <div>${map.effectText || ""}</div>
    </div>
  `).join("");

  const achievementHtml = achievementList.map(a => {
    const unlocked = save.achievements[a.key];
    return `
      <div style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
        <div style="font-weight:900;">${a.title}${unlocked ? "（已达成）" : "（未达成）"}</div>
        <div>${a.desc}</div>
      </div>
    `;
  }).join("");

  return `
    <div style="font-weight:900;font-size:18px;margin-bottom:8px;">防御塔</div>
    ${towerHtml}
    <div style="font-weight:900;font-size:18px;margin:18px 0 8px;">敌人</div>
    ${enemyHtml}
    <div style="font-weight:900;font-size:18px;margin:18px 0 8px;">地图效果</div>
    ${mapHtml}
    <div style="font-weight:900;font-size:18px;margin:18px 0 8px;">成就</div>
    ${achievementHtml}
  `;
}

function updateCodex() {
  codexContent.innerHTML = buildCodexHTML();
}

function updateAuthUI(user) {
  currentUser = user;
  playerNickname = user ? (user.displayName || getCurrentNickname()) : "";

  if (user) {
    authStatus.textContent = `已登录：${playerNickname || "未命名用户"}（${user.email || ""}）`;
    if (playerNickname) nicknameInput.value = playerNickname;
    if (user.email) emailInput.value = user.email;
    startGameBtn.disabled = false;
  } else {
    authStatus.textContent = "未登录，请先注册或登录。";
    startGameBtn.disabled = true;
  }
}

function handleGameUpdate(ui) {
  goldText.textContent = ui.gold;
  livesText.textContent = ui.lives;
  waveText.textContent = ui.waveText;
  stateText.textContent = ui.stateText;
  skillCdText.textContent = ui.skillCdText;
  scoreText.textContent = ui.score;
  mapText.textContent = ui.mapLabel;
  logBox.textContent = ui.logText;
  wavePreviewBox.textContent = ui.nextWaveText;
  selectedTowerInfo.textContent = ui.selectedTowerInfoText;
  mapInfoBox.textContent = ui.mapDesc;

  startWaveBtn.disabled = ui.startWaveDisabled;
  pauseBtn.disabled = ui.pauseDisabled;
  pauseBtn.textContent = ui.pauseText;
  skillBtn.disabled = ui.skillDisabled;
  upgradeBtn.disabled = !ui.canUpgrade;
  sellBtn.disabled = !ui.canSell;

  soundBtn.textContent = ui.soundEnabled ? "音效：开启" : "音效：关闭";
  soundBtn.classList.toggle("sound-on", ui.soundEnabled);
  soundBtn.classList.toggle("sound-off", !ui.soundEnabled);

  lampBtn.classList.toggle("active", ui.selectedTowerType === "lamp");
  coffeeBtn.classList.toggle("active", ui.selectedTowerType === "coffee");
  bookBtn.classList.toggle("active", ui.selectedTowerType === "book");
  bombBtn.classList.toggle("active", ui.selectedTowerType === "bomb");
  sniperBtn.classList.toggle("active", ui.selectedTowerType === "sniper");

  if (ui.selectedTowerType && towerTypes[ui.selectedTowerType]) {
    descBox.textContent = towerTypes[ui.selectedTowerType].description;
  } else {
    descBox.textContent = DEFAULT_DESC;
  }

  updateTowerButtons();
}

function setDifficulty(diff) {
  currentDifficulty = diff;
  difficultyButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.difficulty === diff);
  });
  difficultyInfo.textContent = difficulties[diff].desc;
  game.setDifficulty(diff);
  updateSaveSummary();
  renderLeaderboards();
}

function setMap(mapKey) {
  currentMap = mapKey;
  mapButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.map === mapKey);
  });
  mapSelectInfo.textContent = `${maps[mapKey].desc}\n${maps[mapKey].effectText || ""}`;
  game.setMap(mapKey);
  updateSaveSummary();
}

function renderLeaderboardTo(container, mode) {
  let list = getFilteredLeaderboard(mode).slice(0, 20);

  if (!list.length) {
    container.innerHTML = "暂无记录。";
    return;
  }

  container.innerHTML = list.map((item, idx) => `
    <div class="rank-item ${item.id === lastSubmittedDocId ? "self" : ""}">
      <div class="rank-index">#${idx + 1}</div>
      <div>
        <div class="rank-name">${escapeHTML(item.nickname)}${item.id === lastSubmittedDocId ? "（你）" : ""}</div>
        <div class="rank-meta">${difficulties[item.difficulty]?.label || item.difficulty} · 波次 ${item.wave || 0}</div>
      </div>
      <div class="rank-score">${item.score || 0}</div>
    </div>
  `).join("");
}

function renderLeaderboards() {
  renderLeaderboardTo(leaderboardBox, rankMode);
  renderLeaderboardTo(resultLeaderboardBox, resultRankMode);
}

async function refreshLeaderboards() {
  leaderboardStatus.textContent = "正在刷新排行榜...";
  resultLeaderboardStatus.textContent = "正在刷新排行榜...";

  try {
    leaderboardCache = await fetchLeaderboard(200);
    renderLeaderboards();

    const globalRank = getRankInfo("global", lastSubmittedDocId);
    const difficultyRank = getRankInfo("difficulty", lastSubmittedDocId);

    leaderboardStatus.textContent = "全球排行榜已更新。";

    if (lastSubmittedDocId) {
      resultLeaderboardStatus.textContent =
        `你的全球排名：${globalRank ? "#" + globalRank : "200+"} ｜ 当前难度排名：${difficultyRank ? "#" + difficultyRank : "200+"}`;
    } else {
      resultLeaderboardStatus.textContent = "排行榜已更新。";
    }
  } catch (err) {
    console.error(err);
    leaderboardBox.innerHTML = "排行榜读取失败。";
    resultLeaderboardBox.innerHTML = "排行榜读取失败。";
    leaderboardStatus.textContent = "请检查 Firestore 规则、网络，或确认已用 GitHub Pages 打开。";
    resultLeaderboardStatus.textContent = "排行榜读取失败。";
  }
}

function setRankMode(mode) {
  rankMode = mode;
  globalRankTab.classList.toggle("active", mode === "global");
  difficultyRankTab.classList.toggle("active", mode === "difficulty");
  renderLeaderboards();
}

function setResultRankMode(mode) {
  resultRankMode = mode;
  resultGlobalRankTab.classList.toggle("active", mode === "global");
  resultDifficultyRankTab.classList.toggle("active", mode === "difficulty");
  renderLeaderboards();
}

async function handleGameEnd(result) {
  lastResult = result;
  const stars = calcStars(result);
  const beforeSave = loadSave();
  const reward = calcMetaReward(result, stars);

  setStars(result.map, result.difficulty, stars);
  setBestScore(result.map, result.difficulty, result.score);
  const afterSave = addMetaCoins(reward);

  const newlyUnlocked = [];
  if (!beforeSave.unlocks.bomb && afterSave.unlocks.bomb) newlyUnlocked.push("范围塔");
  if (!beforeSave.unlocks.sniper && afterSave.unlocks.sniper) newlyUnlocked.push("狙击塔");

  const newlyAchievements = [];
  if (result.victory && unlockAchievement("first_win")) newlyAchievements.push("初次胜利");
  if (result.stats.bossKills > 0 && unlockAchievement("boss_slayer")) newlyAchievements.push("Boss 终结者");
  if (result.victory && result.difficulty === "hard" && unlockAchievement("hard_win")) newlyAchievements.push("困难征服者");
  if (result.victory && result.stats.towersSold === 0 && unlockAchievement("no_sell_win")) newlyAchievements.push("稳健经营");
  if (result.victory && result.stats.towersBuilt <= 5 && unlockAchievement("small_team_win")) newlyAchievements.push("精简布阵");

  const newestSave = loadSave();
  if (newestSave.unlocks.bomb && newestSave.unlocks.sniper && unlockAchievement("arsenal_master")) {
    newlyAchievements.push("军火大师");
  }

  resultTitle.textContent = result.victory ? "胜利！" : "失败！";
  resultSubtitle.textContent = result.victory ? "你成功守住了终点。" : "防线被突破了。";

  resultBox.textContent =
`评级：${starText(stars)}
玩家：${playerNickname}
难度：${result.difficultyLabel}
地图：${result.mapLabel}
最终波次：${result.wave} / ${result.totalWaves}
剩余基地血量：${result.lives}
剩余金币：${result.gold}
击杀数：${result.stats.kills}
建塔数：${result.stats.towersBuilt}
卖塔数：${result.stats.towersSold}
技能次数：${result.stats.skillsUsed}
本局分数：${result.score}
获得局外金币：${reward}

${newlyUnlocked.length ? "新解锁：" + newlyUnlocked.join("、") : "本次没有新解锁。"}
${newlyAchievements.length ? "新成就：" + newlyAchievements.join("、") : "本次没有新成就。"}
${result.victory ? "干得漂亮，你守住了最后一波。" : "别灰心，调整塔的位置和升级顺序再试一次。"}`;

  resultOverlay.classList.remove("hidden");
  updateSaveSummary();
  updateAchievementSummary();
  updateTowerButtons();
  updateCodex();

  if (!scoreSubmitted && result.score > 0 && currentUser && playerNickname) {
    scoreSubmitted = true;
    resultLeaderboardStatus.textContent = "正在提交分数...";
    try {
      lastSubmittedDocId = await submitScore({
        nickname: playerNickname,
        score: result.score,
        wave: result.wave,
        difficulty: result.difficulty
      });
    } catch (err) {
      console.error(err);
      resultLeaderboardStatus.textContent = "成绩提交失败，请检查 Firestore 规则或网络。";
    }
  }

  await refreshLeaderboards();
}

function chooseTower(type) {
  const save = loadSave();
  if (!save.unlocks[type]) return;
  game.setSelectedTowerType(type);
  descBox.textContent = towerTypes[type].description;
}

registerBtn.addEventListener("click", async () => {
  const nickname = nicknameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!validateNickname(nickname)) {
    authStatus.textContent = "注册时请输入 1 到 20 个字符的固定昵称。";
    return;
  }
  if (!validateEmail(email)) {
    authStatus.textContent = "请输入正确的邮箱地址。";
    return;
  }
  if (password.length < 6) {
    authStatus.textContent = "密码至少 6 位。";
    return;
  }

  authStatus.textContent = "注册中...";
  try {
    await registerUser({ email, password, nickname });
    authStatus.textContent = "注册成功，已自动登录。";
  } catch (err) {
    console.error(err);
    authStatus.textContent = `注册失败：${err.code || err.message}`;
  }
});

loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!validateEmail(email)) {
    authStatus.textContent = "请输入正确的邮箱地址。";
    return;
  }
  if (!password) {
    authStatus.textContent = "请输入密码。";
    return;
  }

  authStatus.textContent = "登录中...";
  try {
    await loginUser({ email, password });
    authStatus.textContent = "登录成功。";
  } catch (err) {
    console.error(err);
    authStatus.textContent = `登录失败：${err.code || err.message}`;
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await logoutUser();
    authStatus.textContent = "已退出登录。";
  } catch (err) {
    console.error(err);
    authStatus.textContent = `退出失败：${err.code || err.message}`;
  }
});

lampBtn.addEventListener("click", () => chooseTower("lamp"));
coffeeBtn.addEventListener("click", () => chooseTower("coffee"));
bookBtn.addEventListener("click", () => chooseTower("book"));
bombBtn.addEventListener("click", () => chooseTower("bomb"));
sniperBtn.addEventListener("click", () => chooseTower("sniper"));

startWaveBtn.addEventListener("click", () => game.startNextWave());
pauseBtn.addEventListener("click", () => game.togglePause());
restartBtn.addEventListener("click", () => {
  scoreSubmitted = false;
  lastSubmittedDocId = null;
  lastResult = null;
  game.restartGame();
});
upgradeBtn.addEventListener("click", () => game.upgradeSelectedTower());
sellBtn.addEventListener("click", () => game.sellSelectedTower());
skillBtn.addEventListener("click", () => game.castSkill());
soundBtn.addEventListener("click", () => game.toggleSound());

difficultyButtons.forEach(btn => {
  btn.addEventListener("click", () => setDifficulty(btn.dataset.difficulty));
});

mapButtons.forEach(btn => {
  btn.addEventListener("click", () => setMap(btn.dataset.map));
});

globalRankTab.addEventListener("click", () => setRankMode("global"));
difficultyRankTab.addEventListener("click", () => setRankMode("difficulty"));
resultGlobalRankTab.addEventListener("click", () => setResultRankMode("global"));
resultDifficultyRankTab.addEventListener("click", () => setResultRankMode("difficulty"));

codexBtn.addEventListener("click", () => {
  updateCodex();
  codexOverlay.classList.remove("hidden");
});

closeCodexBtn.addEventListener("click", () => {
  codexOverlay.classList.add("hidden");
});

startGameBtn.addEventListener("click", () => {
  if (!currentUser) {
    authStatus.textContent = "请先注册或登录，再开始游戏。";
    return;
  }

  playerNickname = getCurrentNickname();
  if (!playerNickname) {
    authStatus.textContent = "当前账号没有昵称，请重新注册。";
    return;
  }

  scoreSubmitted = false;
  lastSubmittedDocId = null;
  lastResult = null;

  startOverlay.classList.add("hidden");
  resultOverlay.classList.add("hidden");
  codexOverlay.classList.add("hidden");
  game.startNewGame();
});

playAgainBtn.addEventListener("click", () => {
  if (!currentUser) {
    resultLeaderboardStatus.textContent = "请先登录。";
    return;
  }
  scoreSubmitted = false;
  lastSubmittedDocId = null;
  lastResult = null;
  resultOverlay.classList.add("hidden");
  game.startNewGame();
});

backTitleBtn.addEventListener("click", async () => {
  resultOverlay.classList.add("hidden");
  startOverlay.classList.remove("hidden");
  lastResult = null;
  scoreSubmitted = false;
  updateSaveSummary();
  updateAchievementSummary();
  updateTowerButtons();
  updateCodex();
  await refreshLeaderboards();
});

watchAuth(user => {
  updateAuthUI(user);
});

setDifficulty("easy");
setMap("dorm");
setRankMode("global");
setResultRankMode("global");
updateSaveSummary();
updateAchievementSummary();
updateTowerButtons();
updateCodex();
refreshLeaderboards();

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
    wave.forEach(type => {
      count[type] = (count[type] || 0) + 1;
    });

    return Object.entries(count).map(([type, n]) => `${enemyTypes[type].name} × ${n}`).join(" / ");
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
      stateText: !this.gameStarted ? "未开始" : this.gameOver ? "失败" : this.victory ? "胜利" : this.gamePaused ? "暂停" : this.waveActive ? "战斗中" : "准备中",
      skillCdText: this.skillCooldown <= 0 ? "就绪" : `${this.skillCooldown.toFixed(1)}s`,
      score: this.score,
      mapLabel: maps[this.currentMapKey].label,
      mapDesc: `${maps[this.currentMapKey].desc}\n${maps[this.currentMapKey].effectText || ""}`,
      logText: this.logText,
      nextWaveText: this.waveIndex + 1 >= waves.length ? "已经没有下一波了。" : `第 ${this.waveIndex + 2} 波预览：${this.countWaveComposition(waves[this.waveIndex + 1])}`,
      selectedTowerType: this.selectedTowerType,
      selectedTowerInfoText: this.buildSelectedTowerInfoText(),
      canUpgrade: !!this.selectedPlacedTower && this.selectedPlacedTower.level < 3 && this.gold >= this.getUpgradeCost(this.selectedPlacedTower),
      canSell: !!this.selectedPlacedTower,
      startWaveDisabled: !this.gameStarted || this.waveActive || this.gameOver || this.victory || this.waveIndex >= waves.length - 1,
      pauseDisabled: !this.gameStarted || this.gameOver || this.victory,
      pauseText: this.gamePaused ? "继续游戏" : "暂停游戏",
      skillDisabled: !this.gameStarted || this.gameOver || this.victory || this.skillCooldown > 0,
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

    this.enemies = this.enemies.filter(e => e.alive);

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

    this.bullets = this.bullets.filter(b => !b.dead);

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);

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
      ctx.fillStyle = spot.tower ? "#94a3b8" : (this.selectedTowerType ? "#bfdbfe" : "#e2e8f0");
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
    ctx.arc(this.selectedPlacedTower.x, this.selectedPlacedTower.y, this.selectedPlacedTower.range, 0, Math.PI * 2);
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
      ctx.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.radius - 14, barWidth * hpRatio, 5);

      if (enemy.maxShieldHP > 0 && enemy.shieldHP > 0) {
        const shieldRatio = enemy.shieldHP / enemy.maxShieldHP;
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.radius - 22, barWidth, 4);
        ctx.fillStyle = "#38bdf8";
        ctx.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.radius - 22, barWidth * shieldRatio, 4);
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
