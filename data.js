export const GAME_WIDTH = 900;
export const GAME_HEIGHT = 560;

export const ROAD_OUTER_WIDTH = 44;
export const ROAD_INNER_WIDTH = 18;

export const difficulties = {
  easy: {
    label: "简单",
    startGold: 280,
    startLives: 9,
    enemyHpMul: 1.0,
    enemySpeedMul: 1.0,
    rewardMul: 1.0,
    desc: "简单：仍然需要认真放塔，但容错更高。"
  },
  normal: {
    label: "普通",
    startGold: 220,
    startLives: 7,
    enemyHpMul: 1.12,
    enemySpeedMul: 1.08,
    rewardMul: 0.98,
    desc: "普通：难度比之前更高，前期资源更紧。"
  },
  hard: {
    label: "困难",
    startGold: 180,
    startLives: 5,
    enemyHpMul: 1.25,
    enemySpeedMul: 1.14,
    rewardMul: 0.95,
    desc: "困难：敌人更快更硬，站位和升级节奏都要更精准。"
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
      { x: 105, y: 45 },
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
    desc: "图书馆：路线更长，后半段更适合放置高伤害塔。",
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
    desc: "实验楼：转角多，减速塔和范围覆盖更重要。",
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
      { x: 95, y: 180 },
      { x: 95, y: 340 },
      { x: 280, y: 160 },
      { x: 280, y: 360 },
      { x: 455, y: 185 },
      { x: 455, y: 510 },
      { x: 650, y: 350 },
      { x: 650, y: 85 },
      { x: 835, y: 220 },
      { x: 835, y: 395 }
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
    description: "书本塔：单发高伤，适合处理厚血怪。",
    label: "书"
  }
};

export const enemyTypes = {
  normal: {
    name: "拖延怪",
    hp: 48,
    speed: 86,
    reward: 18,
    color: "#3b82f6",
    radius: 14,
    label: "拖"
  },
  fast: {
    name: "熬夜怪",
    hp: 34,
    speed: 138,
    reward: 16,
    color: "#f59e0b",
    radius: 12,
    label: "夜"
  },
  tank: {
    name: "截止日怪",
    hp: 118,
    speed: 62,
    reward: 32,
    color: "#ef4444",
    radius: 17,
    label: "截"
  },
  rush: {
    name: "冲刺怪",
    hp: 24,
    speed: 182,
    reward: 14,
    color: "#8b5cf6",
    radius: 10,
    label: "冲"
  },
  elite: {
    name: "精英怪",
    hp: 155,
    speed: 78,
    reward: 44,
    color: "#111827",
    radius: 18,
    label: "精"
  }
};

export const waves = [
  ["normal", "normal", "rush", "rush", "fast", "normal"],
  ["normal", "fast", "rush", "fast", "normal", "rush", "fast"],
  ["normal", "fast", "tank", "rush", "rush", "normal", "fast"],
  ["tank", "normal", "fast", "elite", "rush", "normal", "fast"],
  ["tank", "fast", "tank", "rush", "elite", "fast", "tank"],
  ["tank", "elite", "fast", "rush", "tank", "fast", "normal", "rush"],
  ["elite", "tank", "rush", "fast", "elite", "normal", "fast", "tank"],
  ["elite", "tank", "elite", "rush", "fast", "tank", "rush", "fast", "elite"]
];
