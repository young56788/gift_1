export const shrimpReward = {
  specialItemId: "grilled_shrimp_plate",
  displayName: "动画烤虾",
};

export const shrimpSceneContent = {
  title: "市场钓虾",
  subtitle: "按 Space 在移动的时机条里收杆，抓住那只最奇怪的虾。",
  idleHint: "等待收杆时机……",
  successTitle: "手感正好，你抓到了一份被故意留给你的礼物。",
  successLine: "你钓上来一盘动画烤虾。它不像刚出水，更像谁提前放在这里等你发现的。",
  retryTitle: "这次时机偏了一点，但水面很给面子。",
  retryLine: "按 Space 再试一次，或者按 Esc 返回地图。",
  overlayFound: "你捞到了一盘会动的烤虾，看起来不像是普通收获。",
  overlayNormal: "今晚的水面很温柔，你满载而归。",
  overlayExit: "今晚的水面先记住了你的脚步，你可以稍后再来。",
};

export const shrimpSceneTuning = {
  catchZoneStartX: 400,
  catchZoneWidth: 110,
  pointerStartX: 240,
  catchThreshold: 58,
  zoneBounds: {
    min: 310,
    max: 650,
  },
  pointerBounds: {
    min: 200,
    max: 760,
  },
  zoneSpeedPerMs: 0.1,
  pointerSpeedPerMs: 0.22,
  normalCatchCount: 4,
};
