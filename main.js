import { difficulties, maps, towerTypes } from "./data.js";
import { submitScore, fetchLeaderboard } from "./firebase.js";
import { Game } from "./game.js";
import { loadSave, addMetaCoins, setStars, getStars, unlockRequirements } from "./save.js";

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
const startGameBtn = document.getElementById("startGameBtn");
const playAgainBtn = document.getElementById("playAgainBtn");
const backTitleBtn = document.getElementById("backTitleBtn");

const difficultyInfo = document.getElementById("difficultyInfo");
const mapSelectInfo = document.getElementById("mapSelectInfo");
const saveSummaryBox = document.getElementById("saveSummaryBox");
const difficultyButtons = [...document.querySelectorAll(".difficulty-btn")];
const mapButtons = [...document.querySelectorAll(".map-btn")];
const nicknameInput = document.getElementById("nicknameInput");

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
  mapSelectInfo.textContent = maps[mapKey].desc;
  game.setMap(mapKey);
  updateSaveSummary();
}

function setTowerButtonActive(type) {
  lampBtn.classList.toggle("active", type === "lamp");
  coffeeBtn.classList.toggle("active", type === "coffee");
  bookBtn.classList.toggle("active", type === "book");
  bombBtn.classList.toggle("active", type === "bomb");
  sniperBtn.classList.toggle("active", type === "sniper");
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
  const unlocked = Object.entries(save.unlocks)
    .filter(([, v]) => v)
    .map(([k]) => towerTypes[k].name)
    .join("、");

  saveSummaryBox.textContent =
`局外金币：${save.metaCoins}
当前地图星级：${"★".repeat(stars)}${"☆".repeat(3 - stars)}
已解锁防御塔：${unlocked}

解锁条件：
范围塔：${unlockRequirements.bomb} 金币
狙击塔：${unlockRequirements.sniper} 金币`;
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

  setTowerButtonActive(ui.selectedTowerType);
  if (ui.selectedTowerType && towerTypes[ui.selectedTowerType]) {
    descBox.textContent = towerTypes[ui.selectedTowerType].description;
  } else {
    descBox.textContent = DEFAULT_DESC;
  }

  updateTowerButtons();
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
  const afterSave = addMetaCoins(reward);

  const unlockedNew = [];
  if (!beforeSave.unlocks.bomb && afterSave.unlocks.bomb) unlockedNew.push("范围塔");
  if (!beforeSave.unlocks.sniper && afterSave.unlocks.sniper) unlockedNew.push("狙击塔");

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
已放置防御塔：${result.towersCount}
本局分数：${result.score}
获得局外金币：${reward}

${unlockedNew.length ? "新解锁：" + unlockedNew.join("、") : "本次没有新解锁。"}
${result.victory ? "干得漂亮，你守住了最后一波。" : "别灰心，调整塔的位置和升级顺序再试一次。"}`;

  resultOverlay.classList.remove("hidden");
  updateSaveSummary();
  updateTowerButtons();

  if (!scoreSubmitted && result.score > 0 && validateNickname(playerNickname)) {
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

startGameBtn.addEventListener("click", () => {
  const name = nicknameInput.value.trim();
  if (!validateNickname(name)) {
    leaderboardStatus.textContent = "请输入 1 到 20 个字符的昵称。";
    return;
  }

  playerNickname = name;
  scoreSubmitted = false;
  lastSubmittedDocId = null;
  lastResult = null;

  startOverlay.classList.add("hidden");
  resultOverlay.classList.add("hidden");
  game.startNewGame();
});

playAgainBtn.addEventListener("click", () => {
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
  updateTowerButtons();
  await refreshLeaderboards();
});

setDifficulty("easy");
setMap("dorm");
setRankMode("global");
setResultRankMode("global");
updateSaveSummary();
updateTowerButtons();
refreshLeaderboards();
