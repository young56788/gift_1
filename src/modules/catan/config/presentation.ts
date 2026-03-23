import type { BoardOwner } from "../types";

export const ownerColors: Record<BoardOwner, number> = {
  player: 0xffd67a,
  leah: 0x80d0a8,
  sam: 0xf38b6b,
};

export const ownerLabels: Record<BoardOwner, string> = {
  player: "你",
  leah: "Leah",
  sam: "Sam",
};

export const tileColors = [0xb88954, 0x9dbb5d, 0xc7764f, 0xb4c3cf, 0xd6b261, 0x6e9ea3, 0xa47955];

export const tileMeta = [
  { label: "森林", number: 5 },
  { label: "农田", number: 8 },
  { label: "丘陵", number: 10 },
  { label: "山地", number: 6 },
  { label: "草地", number: 9 },
  { label: "森林", number: 4 },
  { label: "沙漠", number: null },
] as const;

export const tilePositions = [
  { x: 360, y: 170 },
  { x: 480, y: 170 },
  { x: 600, y: 170 },
  { x: 420, y: 270 },
  { x: 540, y: 270 },
  { x: 360, y: 370 },
  { x: 480, y: 370 },
];

export const nodePositions = [
  { x: 300, y: 210 },
  { x: 450, y: 120 },
  { x: 630, y: 210 },
  { x: 330, y: 350 },
  { x: 540, y: 410 },
  { x: 675, y: 330 },
];

export const roadPositions = [
  { x1: 340, y1: 170, x2: 430, y2: 125 },
  { x1: 530, y1: 125, x2: 620, y2: 170 },
  { x1: 305, y1: 245, x2: 340, y2: 325 },
  { x1: 620, y1: 245, x2: 660, y2: 320 },
  { x1: 365, y1: 205, x2: 455, y2: 205 },
  { x1: 470, y1: 205, x2: 560, y2: 205 },
  { x1: 360, y1: 355, x2: 515, y2: 395 },
  { x1: 410, y1: 300, x2: 540, y2: 300 },
];

export const scoreAnchors: Record<BoardOwner, { x: number; y: number }> = {
  player: { x: 770, y: 88 },
  leah: { x: 770, y: 164 },
  sam: { x: 770, y: 240 },
};

export const catanSceneCopy = {
  title: "卡坦岛棋盘",
  waitingSummary: "正在等候 React 规则层同步战局。",
  waitingBoard: "棋盘正在等待本回合数据…",
  diceTitle: "本轮骰子",
  developmentTitle: "发展卡",
  choiceIdleTitle: "高亮点位可操作",
  choiceIdleBody: "把鼠标移到发光的道路或据点上，会看到这一手的说明。",
  choiceWaitingTitle: "棋盘等待下一步",
  choiceWaitingBody: "当前没有可执行动作，继续等 React 规则层同步下一轮状态。",
  developmentIdle: "发展卡: 这轮没有额外牌效触发。",
  completedAction: "终局已经锁定，广场那边也亮起灯了。",
  logTitle: "牌桌气氛",
  turnBannerPrefix: "回合推进",
  victoryTitle: "胜势锁定",
  victoryBody: "这盘对局已经收住了，接下来该带着赢下来的气势回广场。",
};

export const catanSceneMotion = {
  robberMoveDuration: 420,
  tilePulseDuration: 240,
  badgePulseDuration: 220,
  choicePulseDuration: 420,
  choiceBumpDuration: 180,
  toastDuration: 900,
  turnBannerDuration: 1100,
  victoryFadeDuration: 1500,
};
