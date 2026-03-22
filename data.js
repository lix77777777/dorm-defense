export const GAME_WIDTH = 900;
export const GAME_HEIGHT = 560;

export const ROAD_OUTER_WIDTH = 44;
export const ROAD_INNER_WIDTH = 18;

export const difficulties = {
  easy: {
    label: "简单",
    startGold: 320,
    startLives: 10,
    enemyHpMul: 0.95,
    enemySpeedMul: 0.96,
    rewardMul: 1.05,
    desc: "简单：适合第一次玩，容错更高。"
  },
  normal: {
    label: "普通",
    startGold: 250,
    startLives: 7,
    enemyHpMul: 1.05,
    enemySpeedMul: 1.04,
    rewardMul: 1.0,
    desc: "普通：有压力，但整体可过。"
  },
  hard: {
    label: "困难",
    startGold: 210,
    startLives: 5,
    enemyHpMul: 1.15,
    enemySpeedMul: 1.10,
    rewardMul: 0.98,
    desc: "困难：需要更合理的布局和升级节奏。"
  }
};

export const maps = {
  dorm: {
    label: "宿舍区",
    desc: "宿舍区：路线平衡，适合标准布局。",
    path: [
      { x: 0, y: 100 },
      { x: 180, y: 100 },
      { x: 180, y: 240 },
      { x: 380, y: 240 },
      { x: 380, y: 420 },
      { x: 650, y: 420 },
      { x: 650, y: 180 },
      { x: 900, y: 180 }
    ],
    spots: [
      { x: 100, y: 45 },
      { x: 105, y: 175 },
      { x: 255, y: 165 },
      { x: 290, y: 320 },
      { x: 450, y: 330 },
      { x: 445, y: 505 },
      { x: 585, y: 330 },
      { x: 735, y: 330 },
      { x: 730, y: 110 },
      { x: 835, y: 255 }
    ]
  },

  library: {
    label: "图书馆",
    desc: "图书馆：路线更长，后半段更适合高伤害塔。",
    path: [
      { x: 0, y: 80 },
      { x: 230, y: 80 },
      { x: 230, y: 200 },
      { x: 100, y: 200 },
      { x: 100, y: 380 },
      { x: 400, y: 380 },
      { x: 400, y: 140 },
      { x: 720, y: 140 },
      { x: 720, y: 470 },
      { x: 900, y: 470 }
    ],
    spots: [
      { x: 120, y: 145 },
      { x: 290, y: 135 },
      { x: 170, y: 285 },
      { x: 250, y: 330 },
      { x: 330, y: 285 },
      { x: 500, y: 225 },
      { x: 610, y: 75 },
      { x: 640, y: 305 },
      { x: 800, y: 245 },
      { x: 820, y: 395 }
    ]
  },

  lab: {
    label: "实验楼",
    desc: "实验楼：转角多，减速塔和交叉火力更重要。",
    path: [
      { x: 0, y: 260 },
      { x: 180, y: 260 },
      { x: 180, y: 80 },
      { x: 360, y: 80 },
      { x: 360, y: 450 },
      { x: 560, y: 450 },
      { x: 560, y: 160 },
      { x: 760, y: 160 },
      { x: 760, y: 320 },
      { x: 900, y: 320 }
    ],
    spots: [
      { x: 70, y: 185 },
      { x: 70, y: 335 },
      { x: 260, y: 160 },
      { x: 260, y: 350 },
      { x: 430, y: 185 },
      { x: 430, y: 500 },
      { x: 640, y: 330 },
      { x: 640, y: 95 },
      { x: 815, y: 220 },
      { x: 815, y: 385 }
    ]
  }
};

export const towerTypes = {
  lamp: {
    name: "台灯塔",
    cost: 100,
    range: 118,
    damage: 13,
    fireRate: 0.95,
    bulletSpeed: 320,
    color: "#2563eb",
    size: 16,
    slow: 0,
    slowTime: 0,
    splashRadius: 0,
    splashFactor: 0,
    description: "台灯塔：便宜、稳定、适合前期铺场。",
    label: "灯"
  },
  coffee: {
    name: "咖啡塔",
    cost: 120,
    range: 110,
    damage: 7,
    fireRate: 1.08,
    bulletSpeed: 300,
    color: "#16a34a",
    size: 16,
    slow: 0.55,
    slowTime: 1.6,
    splashRadius: 0,
    splashFactor: 0,
    description: "咖啡塔：伤害较低，但能明显减速敌人。",
    label: "咖"
  },
  book: {
    name: "书本塔",
    cost: 150,
    range: 102,
    damage: 30,
    fireRate: 1.7,
    bulletSpeed: 360,
    color: "#ea580c",
    size: 17,
    slow: 0,
    slowTime: 0,
    splashRadius: 0,
    splashFactor: 0,
    description: "书本塔：单发高伤，适合处理厚血怪。",
    label: "书"
  },
  bomb: {
    name: "范围塔",
    cost: 180,
    range: 115,
    damage: 18,
    fireRate: 1.8,
    bulletSpeed: 260,
    color: "#9333ea",
    size: 17,
    slow: 0,
    slowTime: 0,
    splashRadius: 64,
    splashFactor: 0.65,
    description: "范围塔：群体伤害，适合清杂兵。",
    label: "爆"
  },
  sniper: {
    name: "狙击塔",
    cost: 220,
    range: 220,
    damage: 72,
    fireRate: 2.4,
    bulletSpeed: 520,
    color: "#0f172a",
    size: 16,
    slow: 0,
    slowTime: 0,
    splashRadius: 0,
    splashFactor: 0,
    description: "狙击塔：远距离高伤，适合打精英和Boss。",
    label: "狙"
  }
};

export const enemyTypes = {
  normal: {
    name: "拖延怪",
    hp: 42,
    speed: 82,
    reward: 20,
    color: "#3b82f6",
    radius: 14,
    label: "拖"
  },
  fast: {
    name: "熬夜怪",
    hp: 30,
    speed: 128,
    reward: 18,
    color: "#f59e0b",
    radius: 12,
    label: "夜"
  },
  tank: {
    name: "截止日怪",
    hp: 102,
    speed: 58,
    reward: 34,
    color: "#ef4444",
    radius: 17,
    label: "截"
  },
  rush: {
    name: "冲刺怪",
    hp: 20,
    speed: 165,
    reward: 16,
    color: "#8b5cf6",
    radius: 10,
    label: "冲"
  },
  elite: {
    name: "精英怪",
    hp: 135,
    speed: 72,
    reward: 46,
    color: "#111827",
    radius: 18,
    label: "精"
  },
  shield: {
    name: "护盾怪",
    hp: 46,
    speed: 88,
    reward: 24,
    color: "#0891b2",
    radius: 14,
    label: "盾"
  },
  split: {
    name: "分裂怪",
    hp: 40,
    speed: 102,
    reward: 26,
    color: "#db2777",
    radius: 14,
    label: "裂"
  },
  boss: {
    name: "院长怪",
    hp: 300,
    speed: 50,
    reward: 110,
    color: "#7c2d12",
    radius: 24,
    label: "王"
  }
};

export const waves = [
  ["normal", "normal", "rush", "fast", "normal"],
  ["normal", "fast", "rush", "fast", "normal", "normal"],
  ["normal", "fast", "tank", "rush", "normal", "shield"],
  ["tank", "normal", "fast", "elite", "rush", "split"],
  ["tank", "fast", "tank", "rush", "elite", "fast", "shield"],
  ["tank", "elite", "fast", "rush", "tank", "normal", "split"],
  ["elite", "tank", "rush", "fast", "elite", "normal", "tank", "shield"],
  ["boss", "fast", "tank", "elite", "rush", "split"]
];
