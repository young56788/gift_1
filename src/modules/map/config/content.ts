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
    subtitle: "生日宴会",
  },
] as const;

export const mapStatusLabels = {
  available: "可进入",
  completed: "已完成",
  unlocked: "已解锁",
  locked: "未解锁",
};

export const mapSceneContent = {
  title: "夜晚小镇地图",
  subtitle: "方向键 / WASD 移动，靠近后按 E 进入",
  idlePrompt: "去市场和小岛看看吧。",
  festivalLockedPrompt: "广场还在准备中，需要先完成前两个小游戏。",
  prompts: {
    shrimp: "按 E 进入市场，开始钓虾。",
    catan: "按 E 前往小岛，开始一场会先压你再让你翻盘的卡坦。",
    festival: "按 E 进入广场，参加生日宴会。",
  },
  labels: {
    shrimpCompleted: "市场\n已完成",
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
  },
  overlays: {
    festivalLocked: "广场还在准备中，先去市场和小岛看看吧。",
    catanCompleted: "小岛上的局势已经被你翻过来了，广场的灯也跟着亮了。",
  },
};
