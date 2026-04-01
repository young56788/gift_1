export type FestivalActorId =
  | "emily"
  | "abigail"
  | "leah"
  | "sam"
  | "player"
  | "all"
  | "narrator";

export type FestivalFocusTarget = "crowd" | "gift" | "player" | "cake";
export type FestivalEnterMotion = "fade" | "lift" | "spotlight";

export type FestivalDialogueStep = {
  speakerId: FestivalActorId;
  speakerLabel: string;
  line: string;
  phase: "gathering" | "reveal" | "entrance" | "closing";
  focusTarget: FestivalFocusTarget;
  enterMotion: FestivalEnterMotion;
  autoEnterMs?: number;
  beat?: string;
  focusLabel?: string;
};

export type FestivalCastMember = {
  id: Extract<FestivalActorId, "emily" | "abigail" | "leah" | "sam" | "player">;
  label: string;
  spritePath: string;
};

export const festivalContent = {
  title: "夜色中的生日宴会",
  stageSubtitle: "广场的灯已经为你亮起",
  cast: [
    {
      id: "emily",
      label: "Emily",
      spritePath: "/festival/npc/emily.png",
    },
    {
      id: "abigail",
      label: "Abigail",
      spritePath: "/festival/npc/abigail.png",
    },
    {
      id: "leah",
      label: "Leah",
      spritePath: "/festival/npc/leah.png",
    },
    {
      id: "sam",
      label: "Sam",
      spritePath: "/festival/npc/sam.png",
    },
    {
      id: "player",
      label: "你",
      spritePath: "/festival/npc/player.png",
    },
  ] satisfies FestivalCastMember[],
  introLines: [
    {
      speakerId: "emily",
      speakerLabel: "Emily",
      line: "今天是个特别的日子，所以大家都比平时更晚离开广场。",
      phase: "gathering",
      focusTarget: "crowd",
      enterMotion: "fade",
      autoEnterMs: 520,
      beat: "灯光渐亮，镇上的人都已经在这里等你。",
    },
    {
      speakerId: "abigail",
      speakerLabel: "Abigail",
      line: "我们等你很久了。前面那两段路，都是为了把你带到这里。",
      phase: "gathering",
      focusTarget: "crowd",
      enterMotion: "fade",
      autoEnterMs: 520,
      beat: "大家没有催你，只是把广场留成了今晚最亮的地方。",
    },
  ] satisfies FestivalDialogueStep[],
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
      speakerId: "all",
      speakerLabel: "大家",
      line: specialItemFound
        ? festivalContent.reveal.foundSpecialItem
        : festivalContent.reveal.missedSpecialItem,
      phase: "reveal",
      focusTarget: "gift",
      enterMotion: "lift",
      autoEnterMs: 560,
      beat: "桌上的小礼物被重新点亮，前面的伏笔在这里回到你眼前。",
      focusLabel: specialItemFound ? "彩蛋礼物" : "桌上的留白",
    },
    {
      speakerId: "player",
      speakerLabel: "你",
      line: festivalContent.personalLines.confessionTemplate.replace("{playerName}", playerName),
      phase: "entrance",
      focusTarget: "player",
      enterMotion: "spotlight",
      autoEnterMs: 620,
      beat: "人群安静了一拍，所有灯光像是同时朝向了你。",
    },
    {
      speakerId: "narrator",
      speakerLabel: "我",
      line: festivalContent.personalLines.entrance,
      phase: "entrance",
      focusTarget: "player",
      enterMotion: "spotlight",
      autoEnterMs: 560,
      beat: "这一次不是镇上的谁在说话，而是我终于走到了你面前。",
    },
    {
      speakerId: "narrator",
      speakerLabel: "我",
      line: festivalContent.personalLines.closing,
      phase: "closing",
      focusTarget: "cake",
      enterMotion: "lift",
      autoEnterMs: 560,
      beat: "风很轻，灯光也很轻，这句话应该被慢一点留下来。",
      focusLabel: "生日蛋糕",
    },
  ] satisfies FestivalDialogueStep[];
}
