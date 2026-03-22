const SAVE_KEY = "dorm-defense-save-v2";

const DEFAULT_SAVE = {
  metaCoins: 0,
  unlocks: {
    lamp: true,
    coffee: true,
    book: true,
    bomb: false,
    sniper: false
  },
  stars: {},
  bestScores: {},
  achievements: {}
};

export const unlockRequirements = {
  bomb: 150,
  sniper: 320
};

export const achievementList = [
  { key: "first_win", title: "初次胜利", desc: "第一次成功通关任意地图。" },
  { key: "boss_slayer", title: "Boss 终结者", desc: "击败院长怪。" },
  { key: "hard_win", title: "困难征服者", desc: "在困难模式下通关。" },
  { key: "no_sell_win", title: "稳健经营", desc: "通关时全程没有卖塔。" },
  { key: "small_team_win", title: "精简布阵", desc: "用不超过 5 座塔通关。" },
  { key: "arsenal_master", title: "军火大师", desc: "解锁范围塔和狙击塔。" }
];

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function mergeSave(raw) {
  const save = deepClone(DEFAULT_SAVE);

  if (raw && typeof raw === "object") {
    if (typeof raw.metaCoins === "number") {
      save.metaCoins = raw.metaCoins;
    }
    if (raw.unlocks && typeof raw.unlocks === "object") {
      save.unlocks = { ...save.unlocks, ...raw.unlocks };
    }
    if (raw.stars && typeof raw.stars === "object") {
      save.stars = { ...raw.stars };
    }
    if (raw.bestScores && typeof raw.bestScores === "object") {
      save.bestScores = { ...raw.bestScores };
    }
    if (raw.achievements && typeof raw.achievements === "object") {
      save.achievements = { ...raw.achievements };
    }
  }

  applyUnlocks(save);
  return save;
}

export function loadSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    return mergeSave(raw);
  } catch {
    return deepClone(DEFAULT_SAVE);
  }
}

export function writeSave(save) {
  const merged = mergeSave(save);
  localStorage.setItem(SAVE_KEY, JSON.stringify(merged));
  return merged;
}

export function applyUnlocks(save) {
  if (save.metaCoins >= unlockRequirements.bomb) {
    save.unlocks.bomb = true;
  }
  if (save.metaCoins >= unlockRequirements.sniper) {
    save.unlocks.sniper = true;
  }
  return save;
}

export function addMetaCoins(amount) {
  const save = loadSave();
  save.metaCoins += Math.max(0, Math.round(amount));
  applyUnlocks(save);
  return writeSave(save);
}

export function getStarsKey(mapKey, difficulty) {
  return `${mapKey}_${difficulty}`;
}

export function getStars(mapKey, difficulty) {
  const save = loadSave();
  const key = getStarsKey(mapKey, difficulty);
  return save.stars[key] || 0;
}

export function setStars(mapKey, difficulty, stars) {
  const save = loadSave();
  const key = getStarsKey(mapKey, difficulty);
  save.stars[key] = Math.max(save.stars[key] || 0, stars);
  return writeSave(save);
}

export function getBestScoreKey(mapKey, difficulty) {
  return `${mapKey}_${difficulty}`;
}

export function getBestScore(mapKey, difficulty) {
  const save = loadSave();
  const key = getBestScoreKey(mapKey, difficulty);
  return save.bestScores[key] || 0;
}

export function setBestScore(mapKey, difficulty, score) {
  const save = loadSave();
  const key = getBestScoreKey(mapKey, difficulty);
  save.bestScores[key] = Math.max(save.bestScores[key] || 0, Math.round(score));
  return writeSave(save);
}

export function unlockAchievement(key) {
  const save = loadSave();
  const wasUnlocked = !!save.achievements[key];
  if (!wasUnlocked) {
    save.achievements[key] = true;
    writeSave(save);
  }
  return !wasUnlocked;
}

export function isAchievementUnlocked(key) {
  const save = loadSave();
  return !!save.achievements[key];
}

export function getAchievementProgress() {
  const save = loadSave();
  const unlocked = achievementList.filter(a => save.achievements[a.key]).length;
  return {
    unlocked,
    total: achievementList.length
  };
}

export function getUnlockedAchievements() {
  const save = loadSave();
  return achievementList.filter(a => save.achievements[a.key]);
}
