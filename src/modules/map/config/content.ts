export type MapCollisionBlocker = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FestivalCrowdCue = "left" | "right" | "center" | "all";

export type FestivalCelebrationStep = {
  speaker: string;
  line: string;
  crowdCue?: FestivalCrowdCue;
};

export const mapLocations = [
  {
    id: "shrimp",
    title: "市场",
    subtitle: "去钓虾",
  },
  {
    id: "catan",
    title: "小岛",
    subtitle: "卡坦对局",
  },
  {
    id: "festival",
    title: "广场",
    subtitle: "生日彩蛋",
  },
] as const;

export const mapCollisionBlockers: MapCollisionBlocker[] = [
  { id: "tree-left-trunk", x: 94, y: 292, width: 46, height: 50 },
  { id: "tree-right-trunk", x: 902, y: 280, width: 48, height: 50 },
  { id: "lake-core", x: 232, y: 142, width: 296, height: 184 },
  { id: "lake-center-extension", x: 220, y: 186, width: 324, height: 112 },
  { id: "lake-left-inner", x: 208, y: 206, width: 30, height: 70 },
  { id: "lake-right-inner", x: 528, y: 212, width: 28, height: 66 },
  { id: "lake-top-left-notch", x: 282, y: 126, width: 52, height: 16 },
  { id: "lake-top-right-notch", x: 424, y: 126, width: 52, height: 16 },
];

export const mapStatusLabels = {
  available: "可进入",
  completed: "已完成",
  unlocked: "已解锁",
  locked: "未解锁",
};

export const mapSceneContent = {
  title: "夜晚小镇地图",
  subtitle: "方向键 / WASD 移动，靠近建筑门口后按 E 进入",
  idlePrompt: "去市场和小岛看看吧。",
  festivalLockedPrompt: "广场还在准备中，需要先完成前两个小游戏。",
  festivalReadyPrompt: "靠近广场入口，按 E 触发生日晚会。",
  festivalCompletedPrompt: "广场晚会彩蛋已完成。",
  festivalCelebratingPrompt: "生日晚会进行中…",
  festivalGiftLocatePrompt: "礼物在广场中央，靠近后按 E 打开。",
  festivalGiftPrompt: "靠近礼物按 E 打开生日礼物。",
  festivalGiftOpenedPrompt: "礼物已打开，烟花还在夜空绽放。",
  prompts: {
    shrimp: "靠近市场门口，按 E 进入钓虾。",
    catan: "靠近小岛入口，按 E 开始卡坦。",
    festival: "靠近广场入口，按 E 开始晚会。",
  },
  labels: {
    shrimpCompleted: "市场\n已完成",
    catanCompleted: "小岛\n已完成",
    festivalReady: "广场\n彩蛋待触发",
    festivalCompleted: "广场\n彩蛋完成",
  },
  festivalCelebration: {
    title: "生日彩蛋晚会",
    steps: [
      {
        speaker: "旁白",
        line: "广场的灯一盏盏亮起，镇上的人都朝你围了过来。",
        crowdCue: "all",
      },
      {
        speaker: "Emily",
        line: "生日快乐，愿你每次回到这里，都有人等你。",
        crowdCue: "left",
      },
      {
        speaker: "Abigail",
        line: "今晚你就是主角，愿望会和烟花一起升空。",
        crowdCue: "right",
      },
      {
        speaker: "Leah",
        line: "愿你喜欢的日子，都能被认真庆祝。",
        crowdCue: "center",
      },
      {
        speaker: "圆葱",
        line: "今天是你的生日，敢不开心打歪你，记得去找找你的礼物。",
        crowdCue: "right",
      },
      {
        speaker: "大家",
        line: "生日快乐！",
        crowdCue: "all",
      },
    ] satisfies FestivalCelebrationStep[],
    continueAction: "继续",
    finishAction: "收下祝福",
    skipAction: "跳过",
  },
};

export const appShellContent = {
  hud: {
    title: "Birthday Gift Game",
    subtitle: "星露谷风格生日小游戏",
    dynamicTitle: "动态栏",
    dynamicFallback: "去市场和小岛看看吧。",
    specialItemLabel: "特别道具",
    specialItemMissing: "尚未获得",
    shrimpStatusLabel: "市场",
    catanStatusLabel: "小岛",
    festivalStatusLabel: "广场",
  },
  panels: {
    phaserTitle: "Phaser 舞台",
    phaserSubtitle: "地图和小游戏在这里运行",
    phaserIdle: "当前场景不需要 Phaser。进入地图或钓虾时，再按需加载地图运行时。",
    progressTitle: "全局进度",
    progressSubtitle: "React 侧唯一业务真相源",
    controlsTitle: "控制台",
    controlsSubtitle: "用来切换壳层场景和占位模块",
    introTitle: "入口页",
    introSubtitle: "当前先做文字引导占位",
    introBody: "夜晚已经降临，小镇的灯一点点亮起来。去市场钓虾，再去小岛看看，广场还在准备中。",
  },
  actions: {
    goHome: "回到首页",
    goMap: "前往地图",
    openCatan: "打开卡坦对局",
    openFestival: "打开生日宴会",
    enterMap: "进入地图",
    previewFestival: "开发预览宴会",
  },
  overlays: {
    festivalLocked: "广场还在准备中，先去市场和小岛看看吧。",
    catanCompleted: "小岛上的局势已经被你翻过来了，广场的灯也跟着亮了。",
    festivalCompleted: "生日晚会彩蛋已完成，广场重新恢复了平静。",
    festivalGiftOpened: "你打开了礼物，大家的祝福和烟花一起点亮了夜晚。",
  },
};
