export type FestivalDialogueStep = {
  speaker: string;
  line: string;
};

export const festivalContent = {
  title: "夜色中的生日宴会",
  stageSubtitle: "React 驱动的剧情演出",
  progressLabels: ["市场", "小岛", "广场", "你"],
  introLines: [
    {
      speaker: "Emily",
      line: "今天是个特别的日子，所以大家都比平时更晚离开广场。",
    },
    {
      speaker: "Abigail",
      line: "我们等你很久了。前面那两段路，都是为了把你带到这里。",
    },
  ],
  reveal: {
    foundSpecialItem:
      "你在市场里钓到的那盘会动的烤虾，不是什么随机事件，而是今晚故意留给你的伏笔。",
    missedSpecialItem:
      "今晚原本还给你留了一个小彩蛋，只是它没有先一步找到你。",
  },
  personalLines: {
    confessionTemplate: "{playerName}，其实这些，都是我准备的。",
    entrance: "其实这些灯、这些安排、这些被悄悄设计好的转折，都是我准备的。",
    closing:
      "今天不是婚礼，但如果以后真的有那一天，我还是想把这个世界也一起留给你。生日快乐。",
  },
  actions: {
    advance: "继续",
    backToMap: "带着宴会回地图",
  },
};

export function buildFestivalSteps(
  playerName: string,
  specialItemFound: boolean,
): FestivalDialogueStep[] {
  return [
    ...festivalContent.introLines,
    {
      speaker: "大家",
      line: specialItemFound
        ? festivalContent.reveal.foundSpecialItem
        : festivalContent.reveal.missedSpecialItem,
    },
    {
      speaker: "你",
      line: festivalContent.personalLines.confessionTemplate.replace("{playerName}", playerName),
    },
    {
      speaker: "我",
      line: festivalContent.personalLines.entrance,
    },
    {
      speaker: "我",
      line: festivalContent.personalLines.closing,
    },
  ];
}
