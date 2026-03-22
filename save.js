const SAVE_KEY = "dorm-defense-save-v1";

const DEFAULT_SAVE = {
  metaCoins: 0,
  unlocks: {
    lamp: true,
    coffee: true,
    book: true,
    bomb: false,
    sniper: false
  },
  stars: {}
};

export const unlockRequirements = {
  bomb: 150,
  sniper: 320
};

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
