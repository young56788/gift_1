export const catanTurnNarrative = [
  {
    title: "开局被盯上",
    mood: "Leah 把强盗先压到你附近，Sam 还抢走了最顺手的路口。",
    sceneLine: "气氛一上来就不太公平，你刚坐下就知道今晚得自己杀出来。",
    robberNote: "Leah 把强盗压在你的草地旁，9 点这轮直接被她封住。",
    productionNote:
      "6 点落在山地，你摸到 1 张矿石，但 Leah 也跟着涨了资源，桌面主动权还在她那边。",
    actions: {
      "steady-harvest": {
        label: "稳住资源",
        description: "先把手牌补起来，顶住这一轮针对。",
        playerLine: "你先不硬碰，稳稳把资源抓在手里。",
        npcLine: "Leah 还是顺手拿走了你一张木材，两个 NPC 都各自涨了 1 点。",
      },
      "force-settlement": {
        label: "顶着压力落点",
        description: "直接拍下一个定居点，证明你不会被开局带走。",
        playerLine: "你硬是把第一个落点放下去了，桌上的气势瞬间不一样。",
        npcLine: "Sam 赶紧补位，但这回只抢到节奏，没有完全卡住你。",
      },
    },
  },
  {
    title: "继续压制",
    mood: "NPC 还在联手压缩你的空间，轮到你时总感觉刚好差一口气。",
    sceneLine: "这种不爽感要刚好够明显，但还不能把人打退场。",
    robberNote: "强盗又被挪到你的农田边，Leah 明摆着不想让你轻松吃到 8 点。",
    productionNote:
      "8 点终于落在你的农田旁，你拿到 1 张小麦，但 Leah 也顺着这波补到了牌。",
    actions: {
      "careful-setup": {
        label: "补第二手资源",
        description: "补足矿石和小麦，为反打做准备。",
        playerLine: "你把下一轮翻盘要用的牌默默攒齐。",
        npcLine: "Leah 又顺手摸走一张小麦，Sam 再拿 1 分，压制感拉满。",
      },
      "hold-the-road": {
        label: "守住道路",
        description: "不让对手完全封死你的小路。",
        playerLine: "你用一条路把节奏接住了，桌上第一次有人开始回头看你。",
        npcLine: "Sam 还想继续堵，但这次只拿到一点边角收益。",
      },
    },
  },
  {
    title: "转折出现",
    mood: "这一轮骰子终于偏向你，8 点一落下，局面开始松动。",
    sceneLine: "你不再只是挨打，而是第一次有了主动组织资源的空间。",
    robberNote: "牌桌终于松动，你趁机把强盗赶去了 Sam 的丘陵，第一次不是你在挨打。",
    productionNote: "9 点点亮了草地，你的羊毛终于开始顺手，这一轮第一次不像在硬撑。",
    actions: {
      "harbor-trade": {
        label: "切港口节奏",
        description: "把前面攒的牌换成真正能赢的结构。",
        playerLine: "你把港口交易连了起来，资源结构一下变顺了。",
        npcLine: "Leah 和 Sam 这回没跟上节奏，桌面第一次安静了一拍。",
      },
      "counter-expand": {
        label: "反手扩张",
        description: "趁空档直接再放一个定居点。",
        playerLine: "你连续扩张，原本被卡的位置忽然变成自己的连线。",
        npcLine: "Sam 想补刀却晚了一步，转折点已经过去。",
      },
    },
  },
  {
    title: "你开始滚起雪球",
    mood: "NPC 的压制开始松掉，甚至出现了不该有的失误。",
    sceneLine: "这时候要给玩家很明确的感受: 我真的开始赢了。",
    robberNote: "你继续把强盗压在 Leah 的森林上，她这轮只能眼看着你的节奏滚起来。",
    productionNote:
      "10 点砸在丘陵上，砖块直接进手，你这轮终于能把扩张节奏接成连续动作。",
    actions: {
      "upgrade-city": {
        label: "升级城镇",
        description: "把前面的布局变成稳定得分点。",
        playerLine: "你的城镇升级成功，得分开始真正往上跳。",
        npcLine: "Leah 选错了交换时机，只能看着你把差距拉近。",
      },
      "development-chain": {
        label: "发展卡连锁",
        description: "用一波牌效把桌面气势彻底扭过来。",
        playerLine: "你连着翻出两张发展卡，整桌气氛一下子倒向你这边。",
        npcLine: "Sam 想追分，却因为资源分散什么都没做成。",
      },
    },
  },
  {
    title: "进入收官",
    mood: "现在已经不是你会不会赢，而是你会赢得多漂亮。",
    sceneLine: "对手的动作还在继续，但更多只是陪衬你的收官气势。",
    robberNote: "强盗继续留在对手一侧，这局的压制权已经慢慢转到你手里。",
    productionNote: "5 点落回森林，木材到手，你离最长道路只差把最后几段连起来。",
    actions: {
      "longest-road": {
        label: "拿下最长道路",
        description: "把气势转成桌面上最直观的领先。",
        playerLine: "你把最长道路一口气拿下，领先终于写在桌面上。",
        npcLine: "Leah 想争回来，却因为少一张砖只能作罢。",
      },
      "grand-harvest": {
        label: "吃满这一轮丰收",
        description: "再吃一轮大资源，把终局手牌补齐。",
        playerLine: "你把最后一轮关键资源全部摸齐，下一步就是终结比赛。",
        npcLine: "Sam 这回甚至掷错了方向，完全没形成威胁。",
      },
    },
  },
  {
    title: "终局一手",
    mood: "全桌已经意识到比赛要结束了，只剩下你怎么按下最后一下。",
    sceneLine: "这一轮应该给出明确的爽感兑现，不再制造额外阻力。",
    robberNote: "最后一轮连强盗都站在你这边，桌面上已经没人能再卡住你的终局。",
    productionNote:
      "4 点再给你补上一张木材，整桌已经看得出来，这轮资源只是在为你的终结服务。",
    actions: {
      "final-toast": {
        label: "一手点亮全场",
        description: "把所有准备过的东西一起兑现成胜利。",
        playerLine: "你把最后一手稳稳拍下，10 分线被你自己亲手点亮。",
        npcLine: "Leah 和 Sam 这下只能笑着认输，整场对局彻底倒向你。",
      },
      "victory-parade": {
        label: "带着优势收官",
        description: "不给对面任何翻身窗口，直接结束比赛。",
        playerLine: "你没有给桌面留任何悬念，直接把整局比赛收掉。",
        npcLine: "对手最后只剩下鼓掌，这盘已经是你写好的结尾。",
      },
    },
  },
] as const;
