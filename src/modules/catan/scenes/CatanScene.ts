import Phaser from "phaser";
import type { EventBus } from "../../../bus/createEventBus";
import type { BoardOwner, CatanBoardSnapshot, CatanActionTarget } from "../types";
import { sceneKeys } from "../../../phaser/sceneKeys";
import { developmentCardLabels, resourceLabels } from "../config/script";
import {
  catanSceneCopy,
  catanSceneMotion,
  nodePositions,
  ownerColors,
  ownerLabels,
  roadPositions,
  scoreAnchors,
  tileColors,
  tileMeta,
  tilePositions,
} from "../config/presentation";

type CatanBoardChoice = CatanBoardSnapshot["choices"][number];

export class CatanScene extends Phaser.Scene {
  private readonly bus: EventBus;

  private cleanupFns: Array<() => void> = [];
  private titleText?: Phaser.GameObjects.Text;
  private summaryText?: Phaser.GameObjects.Text;
  private actionText?: Phaser.GameObjects.Text;
  private productionText?: Phaser.GameObjects.Text;
  private robberText?: Phaser.GameObjects.Text;
  private developmentEventText?: Phaser.GameObjects.Text;
  private developmentSummaryText?: Phaser.GameObjects.Text;
  private hoverTitleText?: Phaser.GameObjects.Text;
  private hoverBodyText?: Phaser.GameObjects.Text;
  private hoverMetaText?: Phaser.GameObjects.Text;
  private toastText?: Phaser.GameObjects.Text;
  private diceTexts: [Phaser.GameObjects.Text | undefined, Phaser.GameObjects.Text | undefined] = [
    undefined,
    undefined,
  ];
  private diceTotalText?: Phaser.GameObjects.Text;
  private turnBannerBox?: Phaser.GameObjects.Rectangle;
  private turnBannerText?: Phaser.GameObjects.Text;
  private victoryBackdrop?: Phaser.GameObjects.Rectangle;
  private victoryTitleText?: Phaser.GameObjects.Text;
  private victoryBodyText?: Phaser.GameObjects.Text;
  private scoreCardBoxes: Record<BoardOwner, Phaser.GameObjects.Rectangle | undefined> = {
    player: undefined,
    leah: undefined,
    sam: undefined,
  };
  private scoreTexts: Record<BoardOwner, Phaser.GameObjects.Text | undefined> = {
    player: undefined,
    leah: undefined,
    sam: undefined,
  };
  private scoreMetaTexts: Record<BoardOwner, Phaser.GameObjects.Text | undefined> = {
    player: undefined,
    leah: undefined,
    sam: undefined,
  };
  private tileShapes: Phaser.GameObjects.Polygon[] = [];
  private tileLabelTexts: Phaser.GameObjects.Text[] = [];
  private tileNumberBadges: Array<Phaser.GameObjects.Arc | undefined> = [];
  private tileNumberTexts: Array<Phaser.GameObjects.Text | undefined> = [];
  private roadShapes: Phaser.GameObjects.Line[] = [];
  private roadHitAreas: Phaser.GameObjects.Zone[] = [];
  private nodeShapes: Phaser.GameObjects.Container[] = [];
  private nodeHitAreas: Phaser.GameObjects.Zone[] = [];
  private choiceMarkers: Phaser.GameObjects.Container[] = [];
  private logTexts: Phaser.GameObjects.Text[] = [];
  private emptyText?: Phaser.GameObjects.Text;
  private robberToken?: Phaser.GameObjects.Container;
  private latestSnapshot?: CatanBoardSnapshot;
  private recommendedChoiceId: string | null = null;
  private choiceById = new Map<string, CatanBoardChoice>();
  private hoveredChoiceId: string | null = null;

  constructor(bus: EventBus) {
    super(sceneKeys.catan);
    this.bus = bus;
  }

  create() {
    this.cameras.main.setBackgroundColor("#142834");
    this.add.rectangle(480, 270, 960, 540, 0x142834);
    this.add.rectangle(480, 270, 900, 480, 0x183647, 0.92).setStrokeStyle(3, 0x8ab7a5);

    this.titleText = this.add.text(42, 28, catanSceneCopy.title, {
      fontSize: "28px",
      color: "#f8f2dc",
      fontFamily: "Trebuchet MS",
    });
    this.summaryText = this.add.text(42, 64, catanSceneCopy.waitingSummary, {
      fontSize: "18px",
      color: "#d6e9cf",
      fontFamily: "Trebuchet MS",
      wordWrap: { width: 500 },
    });
    this.actionText = this.add.text(42, 124, "", {
      fontSize: "16px",
      color: "#ffd67a",
      fontFamily: "Trebuchet MS",
    });
    this.productionText = this.add.text(42, 146, "", {
      fontSize: "14px",
      color: "#d6e9cf",
      fontFamily: "Trebuchet MS",
      wordWrap: { width: 500 },
      lineSpacing: 4,
    });
    this.robberText = this.add.text(42, 196, "", {
      fontSize: "14px",
      color: "#f38b6b",
      fontFamily: "Trebuchet MS",
      wordWrap: { width: 500 },
      lineSpacing: 4,
    });
    this.developmentEventText = this.add.text(42, 238, "", {
      fontSize: "14px",
      color: "#ffe3a0",
      fontFamily: "Trebuchet MS",
      wordWrap: { width: 500 },
      lineSpacing: 4,
    });
    this.createDicePanel();
    this.createDevelopmentDeck();
    this.createChoicePanel();

    this.createTiles();
    this.createRobberToken();
    this.createRoads();
    this.createNodes();
    this.createScoreCards();
    this.createLogArea();
    this.createStageEffects();

    this.emptyText = this.add.text(480, 300, catanSceneCopy.waitingBoard, {
      fontSize: "20px",
      color: "#f8f2dc",
      fontFamily: "Trebuchet MS",
    });
    this.emptyText.setOrigin(0.5);

    this.cleanupFns.push(
      this.bus.commands.subscribe("catan/show-state", (payload) => {
        this.applySnapshot(payload);
      }),
    );

    this.events.on(Phaser.Scenes.Events.WAKE, this.handleWake, this);
    this.events.on(Phaser.Scenes.Events.SLEEP, this.handleSleep, this);

    this.scene.setVisible(false);
    this.scene.sleep();
  }

  shutdown() {
    this.cleanupFns.forEach((cleanup) => cleanup());
    this.cleanupFns = [];
    this.events.off(Phaser.Scenes.Events.WAKE, this.handleWake, this);
    this.events.off(Phaser.Scenes.Events.SLEEP, this.handleSleep, this);
  }

  private handleWake() {
    this.bus.events.emit("catan/request-state", undefined);
  }

  private handleSleep() {
    this.input.setDefaultCursor("default");
  }

  private createTiles() {
    tilePositions.forEach((position, index) => {
      const points = this.createHexPoints(54);
      const tile = this.add.polygon(position.x, position.y, points, tileColors[index], 0.92);
      tile.setStrokeStyle(3, 0x243d43);
      this.tileShapes.push(tile);

      const label = this.add.text(position.x, position.y - 12, tileMeta[index].label, {
        fontSize: "14px",
        color: "#f8f2dc",
        fontFamily: "Trebuchet MS",
      });
      label.setOrigin(0.5);
      this.tileLabelTexts.push(label);

      if (tileMeta[index].number !== null) {
        const badge = this.add.circle(position.x, position.y + 18, 15, 0xf8f2dc, 0.94);
        badge.setStrokeStyle(2, 0x243d43);
        const numberText = this.add.text(position.x, position.y + 18, `${tileMeta[index].number}`, {
          fontSize: "16px",
          color: "#173431",
          fontFamily: "Trebuchet MS",
        });
        numberText.setOrigin(0.5);
        this.tileNumberBadges[index] = badge;
        this.tileNumberTexts[index] = numberText;
      }
    });
  }

  private createDicePanel() {
    this.add.text(600, 32, catanSceneCopy.diceTitle, {
      fontSize: "18px",
      color: "#f8f2dc",
      fontFamily: "Trebuchet MS",
    });

    [0, 1].forEach((index) => {
      const x = 616 + index * 58;
      this.add.rectangle(x, 76, 44, 44, 0x213b43, 0.96).setStrokeStyle(2, 0x8ab7a5);
      this.diceTexts[index] = this.add.text(x, 76, "-", {
        fontSize: "24px",
        color: "#f8f2dc",
        fontFamily: "Trebuchet MS",
      });
      this.diceTexts[index]?.setOrigin(0.5);
    });

    this.diceTotalText = this.add.text(738, 66, "= 0", {
      fontSize: "26px",
      color: "#ffd67a",
      fontFamily: "Trebuchet MS",
    });
  }

  private createRobberToken() {
    const marker = this.add.circle(0, 0, 16, 0x23130f, 0.95).setStrokeStyle(3, 0xf38b6b);
    const text = this.add.text(0, 0, "盗", {
      fontSize: "18px",
      color: "#f8f2dc",
      fontFamily: "Trebuchet MS",
    });
    text.setOrigin(0.5);
    this.robberToken = this.add.container(0, 0, [marker, text]);
    this.robberToken.setVisible(false);
    this.robberToken.setDepth(4);
  }

  private createDevelopmentDeck() {
    const base = this.add.rectangle(770, 304, 160, 54, 0x213b43, 0.92).setStrokeStyle(2, 0x8ab7a5);
    const deck = this.add.rectangle(706, 304, 28, 38, 0xf3d58f, 0.96).setStrokeStyle(2, 0x805c2c);
    const deckShadow = this.add
      .rectangle(711, 309, 28, 38, 0xd4b56f, 0.4)
      .setStrokeStyle(1, 0x805c2c, 0.2);
    const label = this.add.text(728, 286, catanSceneCopy.developmentTitle, {
      fontSize: "16px",
      color: "#f8f2dc",
      fontFamily: "Trebuchet MS",
    });
    const summary = this.add.text(728, 307, "", {
      fontSize: "12px",
      color: "#d6e9cf",
      fontFamily: "Trebuchet MS",
      wordWrap: { width: 92 },
      lineSpacing: 3,
    });

    const developmentDeck = this.add.container(0, 0, [base, deckShadow, deck, label, summary]);
    developmentDeck.setDepth(2);
    this.developmentSummaryText = summary;
  }

  private createChoicePanel() {
    this.add.rectangle(190, 210, 296, 108, 0x1c3240, 0.9).setStrokeStyle(2, 0x7fa796);
    this.hoverTitleText = this.add.text(52, 170, catanSceneCopy.choiceIdleTitle, {
      fontSize: "18px",
      color: "#f8f2dc",
      fontFamily: "Trebuchet MS",
      wordWrap: { width: 260 },
    });
    this.hoverBodyText = this.add.text(52, 198, catanSceneCopy.choiceIdleBody, {
      fontSize: "14px",
      color: "#d6e9cf",
      fontFamily: "Trebuchet MS",
      wordWrap: { width: 260 },
      lineSpacing: 4,
    });
    this.hoverMetaText = this.add.text(52, 248, "", {
      fontSize: "13px",
      color: "#ffe3a0",
      fontFamily: "Trebuchet MS",
      wordWrap: { width: 260 },
    });
    this.toastText = this.add.text(480, 76, "", {
      fontSize: "18px",
      color: "#f8f2dc",
      fontFamily: "Trebuchet MS",
      stroke: "#142834",
      strokeThickness: 4,
    });
    this.toastText.setOrigin(0.5);
    this.toastText.setAlpha(0);
  }

  private createRoads() {
    roadPositions.forEach((road, index) => {
      const line = this.add.line(
        0,
        0,
        road.x1,
        road.y1,
        road.x2,
        road.y2,
        0x6d7f84,
        1,
      );
      line.setLineWidth(10, 10);
      line.setAlpha(0.34);
      this.roadShapes.push(line);

      const hitArea = this.add.zone(
        (road.x1 + road.x2) / 2,
        (road.y1 + road.y2) / 2,
        Math.abs(road.x2 - road.x1) + 34,
        Math.abs(road.y2 - road.y1) + 34,
      );
      hitArea.setDataEnabled();
      hitArea.data?.set("target", { kind: "road", id: index } satisfies CatanActionTarget);
      this.roadHitAreas.push(hitArea);
    });
  }

  private createNodes() {
    nodePositions.forEach((node, index) => {
      const circle = this.add.circle(0, 0, 16, 0xc2d1c5, 0.25).setStrokeStyle(3, 0x7a8e88);
      const badge = this.add.rectangle(0, 0, 14, 14, 0xffffff, 0);
      const container = this.add.container(node.x, node.y, [circle, badge]);
      this.nodeShapes.push(container);

      const hitArea = this.add.zone(node.x, node.y, 44, 44);
      hitArea.setDataEnabled();
      hitArea.data?.set("target", { kind: "node", id: index } satisfies CatanActionTarget);
      this.nodeHitAreas.push(hitArea);
    });
  }

  private createScoreCards() {
    const cards = [
      { owner: "player" as const, x: 770, y: 88, label: "你" },
      { owner: "leah" as const, x: 770, y: 164, label: "Leah" },
      { owner: "sam" as const, x: 770, y: 240, label: "Sam" },
    ];

    cards.forEach((card) => {
      this.scoreCardBoxes[card.owner] = this.add
        .rectangle(card.x, card.y, 150, 56, 0x213b43, 0.92)
        .setStrokeStyle(2, ownerColors[card.owner]);
      this.add.text(card.x - 56, card.y - 14, card.label, {
        fontSize: "18px",
        color: "#f8f2dc",
        fontFamily: "Trebuchet MS",
      });
      this.scoreTexts[card.owner] = this.add.text(card.x + 28, card.y - 14, "0", {
        fontSize: "24px",
        color: "#f8f2dc",
        fontFamily: "Trebuchet MS",
      });
      this.scoreMetaTexts[card.owner] = this.add.text(card.x - 56, card.y + 8, "", {
        fontSize: "11px",
        color: "#ffd67a",
        fontFamily: "Trebuchet MS",
        wordWrap: { width: 112 },
      });
    });
  }

  private createLogArea() {
    this.add.rectangle(770, 392, 160, 180, 0x1c3240, 0.9).setStrokeStyle(2, 0x7fa796);
    this.add.text(698, 318, catanSceneCopy.logTitle, {
      fontSize: "18px",
      color: "#f8f2dc",
      fontFamily: "Trebuchet MS",
    });

    this.logTexts = [0, 1, 2].map((index) =>
      this.add.text(698, 350 + index * 42, "", {
        fontSize: "15px",
        color: "#d6e9cf",
        fontFamily: "Trebuchet MS",
        wordWrap: { width: 140 },
      }),
    );
  }

  private createStageEffects() {
    this.turnBannerBox = this.add.rectangle(480, 270, 520, 76, 0x0e1d26, 0.84);
    this.turnBannerBox.setStrokeStyle(2, 0xffd67a, 0.9);
    this.turnBannerBox.setAlpha(0);
    this.turnBannerBox.setDepth(7);
    this.turnBannerText = this.add.text(480, 270, "", {
      fontSize: "26px",
      color: "#f8f2dc",
      fontFamily: "Trebuchet MS",
      align: "center",
    });
    this.turnBannerText.setOrigin(0.5);
    this.turnBannerText.setAlpha(0);
    this.turnBannerText.setDepth(8);

    this.victoryBackdrop = this.add.rectangle(480, 270, 960, 540, 0x0b1820, 0.12);
    this.victoryBackdrop.setAlpha(0);
    this.victoryBackdrop.setDepth(7);
    this.victoryTitleText = this.add.text(480, 230, catanSceneCopy.victoryTitle, {
      fontSize: "40px",
      color: "#ffe79a",
      fontFamily: "Trebuchet MS",
      stroke: "#142834",
      strokeThickness: 5,
    });
    this.victoryTitleText.setOrigin(0.5);
    this.victoryTitleText.setAlpha(0);
    this.victoryTitleText.setDepth(8);
    this.victoryBodyText = this.add.text(480, 280, catanSceneCopy.victoryBody, {
      fontSize: "18px",
      color: "#f8f2dc",
      fontFamily: "Trebuchet MS",
      align: "center",
      wordWrap: { width: 520 },
      lineSpacing: 4,
    });
    this.victoryBodyText.setOrigin(0.5);
    this.victoryBodyText.setAlpha(0);
    this.victoryBodyText.setDepth(8);
  }

  private applySnapshot(snapshot: CatanBoardSnapshot) {
    const previousSnapshot = this.latestSnapshot;
    this.latestSnapshot = snapshot;
    this.emptyText?.setVisible(false);
    this.titleText?.setText(`第 ${snapshot.turn} 轮 · ${snapshot.title}`);
    this.summaryText?.setText(snapshot.summary);
    this.productionText?.setText(snapshot.production.note);
    this.robberText?.setText(`强盗位置: ${snapshot.robber.note}`);
    this.developmentEventText?.setText(
      snapshot.recentDevelopmentEvent
        ? `发展卡: ${snapshot.recentDevelopmentEvent.note}`
        : catanSceneCopy.developmentIdle,
    );
    this.developmentSummaryText?.setText(
      [
        `骑士 ${snapshot.developmentCards.knight}`,
        `丰收 ${snapshot.developmentCards.harvest}`,
        `道路 ${snapshot.developmentCards.roadBuilding}`,
      ].join("\n"),
    );
    this.actionText?.setText(
      snapshot.completed
        ? catanSceneCopy.completedAction
        : snapshot.activeActionLabel
          ? `当前选择: ${snapshot.activeActionLabel}${this.getRecommendedTargetLabel(snapshot) ? ` · 点 ${this.getRecommendedTargetLabel(snapshot)}` : ""}`
          : `阶段: ${snapshot.phase}`,
    );
    this.diceTexts[0]?.setText(`${snapshot.dice.left}`);
    this.diceTexts[1]?.setText(`${snapshot.dice.right}`);
    this.diceTotalText?.setText(`= ${snapshot.dice.total}`);

    this.scoreTexts.player?.setText(`${snapshot.playerPoints}`);
    this.scoreTexts.leah?.setText(`${snapshot.opponents.leah}`);
    this.scoreTexts.sam?.setText(`${snapshot.opponents.sam}`);
    this.scoreMetaTexts.player?.setText(
      [
        snapshot.awards.longestRoadOwner === "player" ? "最长道路" : null,
        snapshot.awards.largestArmyOwner === "player" ? "最大骑士" : null,
      ]
        .filter(Boolean)
        .join(" / "),
    );
    this.scoreMetaTexts.leah?.setText(
      [
        snapshot.awards.longestRoadOwner === "leah" ? "最长道路" : null,
        snapshot.awards.largestArmyOwner === "leah" ? "最大骑士" : null,
      ]
        .filter(Boolean)
        .join(" / "),
    );
    this.scoreMetaTexts.sam?.setText(
      [
        snapshot.awards.longestRoadOwner === "sam" ? "最长道路" : null,
        snapshot.awards.largestArmyOwner === "sam" ? "最大骑士" : null,
      ]
        .filter(Boolean)
        .join(" / "),
    );

    this.choiceById = new Map(snapshot.choices.map((choice) => [choice.id, choice]));
    this.recommendedChoiceId =
      snapshot.choices.find((choice) => choice.recommended && !choice.disabled)?.id ?? null;
    this.hoveredChoiceId = null;
    this.updateChoicePanel();

    this.tileShapes.forEach((tile, index) => {
      const isRobberTile = snapshot.robberTileId === index;
      tile.setStrokeStyle(3, isRobberTile ? 0x1f1310 : 0x243d43);
      tile.setAlpha(isRobberTile ? 0.58 : 0.92);
      this.tileLabelTexts[index]?.setAlpha(isRobberTile ? 0.7 : 1);
      this.tileNumberBadges[index]?.setAlpha(isRobberTile ? 0.52 : 0.94);
      this.tileNumberTexts[index]?.setAlpha(isRobberTile ? 0.64 : 1);
      this.tweens.add({
        targets: tile,
        scale: isRobberTile ? 0.96 : 1,
        duration: 180,
      });
    });

    this.roadShapes.forEach((road, index) => {
      const state = snapshot.roads.find((item) => item.id === index);
      road.setLineWidth(10, 10);
      road.setStrokeStyle(
        10,
        state ? ownerColors[state.owner] : 0x6d7f84,
        state ? 0.95 : 0.28,
      );
      road.setAlpha(state ? 1 : 0.34);

      if (state?.emphasis) {
        this.tweens.add({
          targets: road,
          alpha: { from: 0.55, to: 1 },
          duration: 260,
        });
      }
    });

    this.nodeShapes.forEach((container, index) => {
      const state = snapshot.nodes.find((item) => item.id === index);
      const circle = container.list[0] as Phaser.GameObjects.Arc;
      const badge = container.list[1] as Phaser.GameObjects.Rectangle;

      container.setScale(1);
      circle.setFillStyle(state ? ownerColors[state.owner] : 0xc2d1c5, state ? 1 : 0.25);
      circle.setStrokeStyle(3, state ? 0xf8f2dc : 0x7a8e88);
      badge.setFillStyle(0xf8f2dc, state?.level === "city" ? 1 : 0);
      badge.setVisible(Boolean(state && state.level === "city"));

      if (state) {
        this.tweens.add({
          targets: container,
          scale: { from: 0.9, to: 1 },
          duration: 220,
        });
      }
    });

    this.resetChoiceHitAreas();
    this.renderChoiceMarkers(snapshot.choices.filter((choice) => !choice.disabled));
    snapshot.choices.forEach((choice) => {
      if (!choice.disabled) {
        this.applyChoiceHitArea(choice);
      }
    });
    this.refreshChoiceHighlights();

    this.logTexts.forEach((logText, index) => {
      logText.setText(snapshot.latestLog[index] ?? "");
    });

    this.updateRobberToken(snapshot, previousSnapshot);
    this.playSnapshotFeedback(snapshot, previousSnapshot);
  }

  private resetChoiceHitAreas() {
    [...this.roadHitAreas, ...this.nodeHitAreas].forEach((zone) => {
      zone.disableInteractive();
      zone.removeAllListeners();
    });

    this.choiceMarkers.forEach((marker) => marker.destroy());
    this.choiceMarkers = [];

    this.input.setDefaultCursor("default");
  }

  private renderChoiceMarkers(choices: CatanBoardChoice[]) {
    choices.forEach((choice, index) => {
      const position = this.getChoiceTargetPosition(choice.target);
      const isRecommended = choice.recommended && !choice.disabled;
      const bubble = this.add
        .circle(0, 0, 14, isRecommended ? 0xffd67a : 0x8ab7a5, 0.96)
        .setStrokeStyle(2, 0x173431);
      const numberText = this.add.text(0, 0, `${index + 1}`, {
        fontSize: "14px",
        color: "#173431",
        fontFamily: "Trebuchet MS",
      });
      numberText.setOrigin(0.5);
      const tag = this.add.text(0, -24, isRecommended ? "点这里" : "可选", {
        fontSize: "12px",
        color: isRecommended ? "#ffe9af" : "#d6e9cf",
        fontFamily: "Trebuchet MS",
        backgroundColor: isRecommended ? "#6b4f17" : "#1c3240",
        padding: { left: 6, right: 6, top: 3, bottom: 3 },
      });
      tag.setOrigin(0.5);
      const marker = this.add.container(position.x, position.y - 24, [tag, bubble, numberText]);
      marker.setDepth(6);
      this.choiceMarkers.push(marker);

      this.tweens.add({
        targets: marker,
        y: position.y - 30,
        duration: catanSceneMotion.choicePulseDuration,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });
  }

  private applyChoiceHitArea(choice: CatanBoardChoice) {
    const zone =
      choice.target.kind === "road"
        ? this.roadHitAreas[choice.target.id]
        : this.nodeHitAreas[choice.target.id];

    if (!zone) {
      return;
    }

    zone.setInteractive({ cursor: "pointer" });
    zone.on("pointerover", () => {
      this.input.setDefaultCursor("pointer");
      this.hoveredChoiceId = choice.id;
      this.updateChoicePanel(choice);
      this.refreshChoiceHighlights();
    });
    zone.on("pointerout", () => {
      this.input.setDefaultCursor("default");
      this.hoveredChoiceId = null;
      this.updateChoicePanel();
      this.refreshChoiceHighlights();
    });
    zone.on("pointerdown", () => {
      this.playSelectionFeedback(choice);
      this.bus.events.emit("catan/action-selected", { actionId: choice.id });
    });
  }

  private updateChoicePanel(choice?: CatanBoardChoice) {
    const activeChoice =
      choice ??
      (this.hoveredChoiceId ? this.choiceById.get(this.hoveredChoiceId) : undefined) ??
      (this.recommendedChoiceId ? this.choiceById.get(this.recommendedChoiceId) : undefined);

    if (!activeChoice) {
      this.hoverTitleText?.setText(catanSceneCopy.choiceWaitingTitle);
      this.hoverBodyText?.setText(catanSceneCopy.choiceWaitingBody);
      this.hoverMetaText?.setText("");
      return;
    }

    this.hoverTitleText?.setText(
      activeChoice.recommended ? `${activeChoice.label} · 推荐` : activeChoice.label,
    );
    this.hoverBodyText?.setText(activeChoice.description);
    this.hoverMetaText?.setText(
      [`位置: ${activeChoice.targetLabel}`, activeChoice.preview ?? "这一步主要用于调整牌桌节奏。"]
        .filter(Boolean)
        .join("\n"),
    );
  }

  private getRecommendedTargetLabel(snapshot: CatanBoardSnapshot) {
    return (
      snapshot.choices.find((choice) => choice.recommended && !choice.disabled)?.targetLabel ??
      snapshot.choices.find((choice) => !choice.disabled)?.targetLabel ??
      null
    );
  }

  private updateRobberToken(
    snapshot: CatanBoardSnapshot,
    previousSnapshot?: CatanBoardSnapshot,
  ) {
    const nextPosition = tilePositions[snapshot.robber.tileId];

    if (!this.robberToken || !nextPosition) {
      return;
    }

    if (!previousSnapshot) {
      this.robberToken.setPosition(nextPosition.x + 42, nextPosition.y - 28);
      this.robberToken.setVisible(true);
      return;
    }

    const changedTile = previousSnapshot.robber.tileId !== snapshot.robber.tileId;

    if (!this.robberToken.visible) {
      this.robberToken.setPosition(nextPosition.x + 42, nextPosition.y - 28);
      this.robberToken.setVisible(true);
    }

    if (!changedTile) {
      return;
    }

    this.robberToken.setVisible(true);
    this.tweens.killTweensOf(this.robberToken);
    this.tweens.add({
      targets: this.robberToken,
      x: nextPosition.x + 42,
      y: nextPosition.y - 28,
      duration: catanSceneMotion.robberMoveDuration,
      ease: "Sine.easeInOut",
    });
    this.showToast(`强盗移向${tileMeta[snapshot.robber.tileId]?.label ?? "地块"}`);
  }

  private playSnapshotFeedback(snapshot: CatanBoardSnapshot, previousSnapshot?: CatanBoardSnapshot) {
    if (!previousSnapshot) {
      this.animateDice(snapshot);
      this.playResourceDistribution(snapshot);
      this.playTurnTransition(snapshot, false);
      if (this.recommendedChoiceId) {
        this.pulseChoiceById(this.recommendedChoiceId);
      }
      return;
    }

    if (snapshot.turn !== previousSnapshot.turn) {
      this.playTurnTransition(snapshot, true);
      this.animateDice(snapshot);
      this.playResourceDistribution(snapshot);
    }

    if (
      snapshot.awards.longestRoadOwner &&
      snapshot.awards.longestRoadOwner !== previousSnapshot.awards.longestRoadOwner
    ) {
      this.pulseScoreCard(snapshot.awards.longestRoadOwner, false);
      this.showToast(
        `${ownerLabels[snapshot.awards.longestRoadOwner]}拿下最长道路`,
      );
    }

    if (
      snapshot.awards.largestArmyOwner &&
      snapshot.awards.largestArmyOwner !== previousSnapshot.awards.largestArmyOwner
    ) {
      this.pulseScoreCard(snapshot.awards.largestArmyOwner, false);
      this.showToast(
        `${ownerLabels[snapshot.awards.largestArmyOwner]}拿下最大骑士`,
      );
    }

    if (
      snapshot.recentSteal &&
      (previousSnapshot.recentSteal?.resource !== snapshot.recentSteal.resource ||
        previousSnapshot.recentSteal?.thief !== snapshot.recentSteal.thief ||
        previousSnapshot.recentSteal?.victim !== snapshot.recentSteal.victim)
    ) {
      this.playStealFeedback(snapshot);
    }

    const hasDevelopmentFeedback =
      !!snapshot.recentDevelopmentEvent &&
      (previousSnapshot.recentDevelopmentEvent?.note !== snapshot.recentDevelopmentEvent.note ||
        previousSnapshot.recentDevelopmentEvent?.used !== snapshot.recentDevelopmentEvent.used);

    if (
      snapshot.recentDevelopmentEvent &&
      hasDevelopmentFeedback
    ) {
      this.playDevelopmentFeedback(snapshot);
    }

    if (snapshot.completed && !previousSnapshot.completed) {
      this.playVictorySequence(snapshot);
      return;
    }

    const pointDelta = snapshot.playerPoints - previousSnapshot.playerPoints;

    if (pointDelta > 0 && !hasDevelopmentFeedback) {
      this.pulseScoreCard("player", false);
      this.showToast(`你推进了 +${pointDelta} 分`);
    } else if (snapshot.turn !== previousSnapshot.turn && !hasDevelopmentFeedback) {
      this.showToast(`进入第 ${snapshot.turn} 轮`);
    }

    if (this.recommendedChoiceId) {
      this.pulseChoiceById(this.recommendedChoiceId);
    }
  }

  private playStealFeedback(snapshot: CatanBoardSnapshot) {
    const steal = snapshot.recentSteal;

    if (!steal) {
      return;
    }

    this.showToast(
      `${ownerLabels[steal.thief]}拿走了${ownerLabels[steal.victim]}的1张${resourceLabels[steal.resource]}`,
    );
    this.spawnStealText(steal);
  }

  private playDevelopmentFeedback(snapshot: CatanBoardSnapshot) {
    const developmentEvent = snapshot.recentDevelopmentEvent;

    if (!developmentEvent) {
      return;
    }

    this.showToast(developmentEvent.note);

    const gainedEntries = Object.entries(developmentEvent.gained).filter(([, count]) => Boolean(count));
    gainedEntries.forEach(([card, count], index) => {
      this.spawnDevelopmentCardGain(
        card as keyof typeof developmentCardLabels,
        count ?? 0,
        index,
      );
    });

    if (developmentEvent.used) {
      this.spawnDevelopmentCardUse(developmentEvent.used, developmentEvent.target);
    }
  }

  private playTurnTransition(snapshot: CatanBoardSnapshot, withCameraKick: boolean) {
    const banner = `${catanSceneCopy.turnBannerPrefix}\n第 ${snapshot.turn} 轮 · ${snapshot.title}`;

    this.turnBannerText?.setText(banner);
    this.turnBannerText?.setScale(0.92);
    this.turnBannerBox?.setAlpha(0);
    this.turnBannerText?.setAlpha(0);

    if (this.turnBannerBox) {
      this.tweens.killTweensOf(this.turnBannerBox);
      this.tweens.add({
        targets: this.turnBannerBox,
        alpha: { from: 0, to: 1 },
        duration: catanSceneMotion.turnBannerDuration,
        yoyo: true,
      });
    }

    if (this.turnBannerText) {
      this.tweens.killTweensOf(this.turnBannerText);
      this.tweens.add({
        targets: this.turnBannerText,
        alpha: { from: 0, to: 1 },
        scale: { from: 0.92, to: 1 },
        duration: catanSceneMotion.turnBannerDuration,
        yoyo: true,
      });
    }

    if (withCameraKick) {
      this.cameras.main.flash(180, 255, 231, 154, false);
      this.tweens.add({
        targets: this.cameras.main,
        zoom: { from: 1.02, to: 1 },
        duration: catanSceneMotion.turnBannerDuration,
        ease: "Sine.easeOut",
      });
    }
  }

  private playVictorySequence(snapshot: CatanBoardSnapshot) {
    this.showToast(catanSceneCopy.victoryTitle);
    this.actionText?.setText(catanSceneCopy.completedAction);
    this.summaryText?.setText(snapshot.summary);
    this.victoryBackdrop?.setAlpha(0);
    this.victoryTitleText?.setAlpha(0);
    this.victoryBodyText?.setAlpha(0);

    if (this.victoryBackdrop) {
      this.tweens.killTweensOf(this.victoryBackdrop);
      this.tweens.add({
        targets: this.victoryBackdrop,
        alpha: 0.6,
        duration: catanSceneMotion.victoryFadeDuration,
        ease: "Quad.easeOut",
      });
    }

    if (this.victoryTitleText) {
      this.tweens.killTweensOf(this.victoryTitleText);
      this.tweens.add({
        targets: this.victoryTitleText,
        alpha: 1,
        scale: { from: 0.92, to: 1.04 },
        duration: catanSceneMotion.victoryFadeDuration,
        yoyo: true,
      });
    }

    if (this.victoryBodyText) {
      this.tweens.killTweensOf(this.victoryBodyText);
      this.tweens.add({
        targets: this.victoryBodyText,
        alpha: 1,
        y: { from: 294, to: 280 },
        duration: catanSceneMotion.victoryFadeDuration,
        ease: "Quad.easeOut",
      });
    }

    this.cameras.main.flash(240, 255, 231, 154, false);
    this.tweens.add({
      targets: this.cameras.main,
      zoom: { from: 1, to: 1.05 },
      duration: 260,
      yoyo: true,
    });
    this.pulseScoreCard("player", true);
  }

  private animateDice(snapshot: CatanBoardSnapshot) {
    this.diceTexts.forEach((diceText) => {
      if (!diceText) {
        return;
      }

      diceText.setScale(0.84);
      this.tweens.killTweensOf(diceText);
      this.tweens.add({
        targets: diceText,
        scale: 1,
        duration: catanSceneMotion.badgePulseDuration,
        ease: "Back.easeOut",
      });
    });

    if (this.diceTotalText) {
      this.diceTotalText.setScale(0.9);
      this.tweens.killTweensOf(this.diceTotalText);
      this.tweens.add({
        targets: this.diceTotalText,
        scale: 1,
        duration: catanSceneMotion.tilePulseDuration,
        ease: "Back.easeOut",
      });
    }
  }

  private playResourceDistribution(snapshot: CatanBoardSnapshot) {
    snapshot.production.activatedTileIds.forEach((tileId) => {
      const tile = this.tileShapes[tileId];
      const badge = this.tileNumberBadges[tileId];
      const numberText = this.tileNumberTexts[tileId];

      if (tile) {
        this.tweens.add({
          targets: tile,
          alpha: { from: 0.62, to: 1 },
          scale: { from: 0.94, to: 1.05 },
          duration: catanSceneMotion.tilePulseDuration,
          yoyo: true,
        });
      }

      if (badge) {
        this.tweens.add({
          targets: [badge, numberText].filter(Boolean),
          scale: { from: 0.92, to: 1.12 },
          duration: catanSceneMotion.badgePulseDuration,
          yoyo: true,
        });
      }
    });

    this.spawnProductionTexts(snapshot.production.activatedTileIds, snapshot.production.player, "player");
    Object.entries(snapshot.production.opponents).forEach(([owner, delta]) => {
      if (delta) {
        this.spawnProductionTexts(
          snapshot.production.activatedTileIds,
          delta,
          owner as Exclude<BoardOwner, "player">,
        );
      }
    });
  }

  private spawnProductionTexts(
    tileIds: number[],
    delta: CatanBoardSnapshot["production"]["player"],
    owner: BoardOwner,
  ) {
    const startTileId = tileIds[0] ?? 0;
    const start = tilePositions[startTileId] ?? { x: 480, y: 270 };
    const target = scoreAnchors[owner];

    Object.entries(delta).forEach(([resource, count], index) => {
      if (!count) {
        return;
      }

      const floater = this.add.text(
        start.x,
        start.y - 22 - index * 18,
        `+${resourceLabels[resource as keyof typeof resourceLabels]} ${count}`,
        {
          fontSize: "14px",
          color: Phaser.Display.Color.IntegerToColor(ownerColors[owner]).rgba,
          fontFamily: "Trebuchet MS",
          stroke: "#142834",
          strokeThickness: 4,
        },
      );
      floater.setOrigin(0.5);

      this.tweens.add({
        targets: floater,
        x: target.x - 10,
        y: target.y - 12 + index * 10,
        alpha: 0,
        duration: 700,
        ease: "Quad.easeOut",
        onComplete: () => floater.destroy(),
      });
    });
  }

  private spawnStealText(steal: NonNullable<CatanBoardSnapshot["recentSteal"]>) {
    const from = scoreAnchors[steal.victim];
    const to = scoreAnchors[steal.thief];
    const floater = this.add.text(from.x - 10, from.y - 16, `-${resourceLabels[steal.resource]}`, {
      fontSize: "14px",
      color: "#f38b6b",
      fontFamily: "Trebuchet MS",
      stroke: "#142834",
      strokeThickness: 4,
    });
    floater.setOrigin(0.5);

    this.tweens.add({
      targets: floater,
      x: to.x - 10,
      y: to.y - 14,
      alpha: 0,
      duration: 780,
      ease: "Quad.easeOut",
      onComplete: () => floater.destroy(),
    });
  }

  private spawnDevelopmentCardGain(
    card: keyof typeof developmentCardLabels,
    count: number,
    index: number,
  ) {
    const floater = this.createDevelopmentCardBadge(
      706,
      304 - index * 18,
      `+${developmentCardLabels[card]} ${count}`,
      0xf3d58f,
    );

    this.tweens.add({
      targets: floater,
      x: 760,
      y: 88 + index * 12,
      alpha: 0,
      duration: 820,
      ease: "Quad.easeOut",
      onComplete: () => floater.destroy(),
    });
  }

  private spawnDevelopmentCardUse(
    card: keyof typeof developmentCardLabels,
    target: CatanActionTarget | null,
  ) {
    const anchor = target ? this.getChoiceTargetPosition(target) : { x: 520, y: 260 };
    const floater = this.createDevelopmentCardBadge(760, 88, developmentCardLabels[card], 0xffd67a);

    this.tweens.add({
      targets: floater,
      x: anchor.x,
      y: anchor.y - 18,
      alpha: 0,
      duration: 780,
      ease: "Quad.easeOut",
      onComplete: () => floater.destroy(),
    });

    if (target) {
      this.bumpChoiceTarget(target, false);
    }

    if (card === "knight" && this.robberToken) {
      this.tweens.add({
        targets: this.robberToken,
        scale: { from: 1, to: 1.14 },
        duration: 180,
        yoyo: true,
        repeat: 1,
      });
    }
  }

  private createDevelopmentCardBadge(x: number, y: number, label: string, fill: number) {
    const background = this.add.rectangle(0, 0, 74, 28, fill, 0.96).setStrokeStyle(2, 0x805c2c);
    const text = this.add.text(0, 0, label, {
      fontSize: "12px",
      color: "#173431",
      fontFamily: "Trebuchet MS",
      align: "center",
    });
    text.setOrigin(0.5);
    const container = this.add.container(x, y, [background, text]);
    container.setDepth(6);

    return container;
  }

  private pulseScoreCard(owner: BoardOwner, dramatic: boolean) {
    const card = this.scoreCardBoxes[owner];

    if (!card) {
      return;
    }

    this.tweens.killTweensOf(card);
    this.tweens.add({
      targets: card,
      scaleX: dramatic ? { from: 1, to: 1.08 } : { from: 1, to: 1.04 },
      scaleY: dramatic ? { from: 1, to: 1.08 } : { from: 1, to: 1.04 },
      duration: dramatic ? 220 : 180,
      yoyo: true,
      repeat: dramatic ? 1 : 0,
    });
  }

  private showToast(message: string) {
    if (!this.toastText) {
      return;
    }

    this.toastText.setText(message);
    this.toastText.setY(92);
    this.toastText.setAlpha(1);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({
      targets: this.toastText,
      y: 76,
      alpha: 0,
      duration: catanSceneMotion.toastDuration,
      ease: "Quad.easeOut",
    });
  }

  private playSelectionFeedback(choice: CatanBoardChoice) {
    this.actionText?.setText(`已选择: ${choice.label}，正在结算这一手…`);
    this.showToast(`落子: ${choice.label}`);
    this.bumpChoiceTarget(choice.target, false);
  }

  private pulseChoiceById(choiceId: string) {
    const choice = this.choiceById.get(choiceId);

    if (!choice) {
      return;
    }

    this.bumpChoiceTarget(choice.target, true);
  }

  private refreshChoiceHighlights() {
    this.choiceById.forEach((choice) => {
      const active =
        choice.id === this.hoveredChoiceId ||
        (!this.hoveredChoiceId && choice.id === this.recommendedChoiceId);
      this.highlightChoiceTarget(choice.target, active);
    });
  }

  private bumpChoiceTarget(target: CatanActionTarget, gentle: boolean) {
    if (target.kind === "road") {
      const road = this.roadShapes[target.id];

      if (!road) {
        return;
      }

      this.tweens.killTweensOf(road);
      this.tweens.add({
        targets: road,
        alpha: { from: gentle ? 0.72 : 0.92, to: 1 },
        duration: gentle ? catanSceneMotion.choicePulseDuration : catanSceneMotion.choiceBumpDuration,
        yoyo: !gentle,
        repeat: gentle ? 0 : 1,
      });
      return;
    }

    const node = this.nodeShapes[target.id];

    if (!node) {
      return;
    }

    this.tweens.killTweensOf(node);
    this.tweens.add({
      targets: node,
      scale: gentle ? { from: 1, to: 1.08 } : { from: 1, to: 1.16 },
      duration: gentle ? catanSceneMotion.choicePulseDuration : catanSceneMotion.choiceBumpDuration,
      yoyo: true,
      repeat: gentle ? 0 : 1,
    });
  }

  private highlightChoiceTarget(target: CatanActionTarget, active: boolean) {
    if (target.kind === "road") {
      const road = this.roadShapes[target.id];

      if (!road) {
        return;
      }

      road.setLineWidth(active ? 14 : 10, active ? 14 : 10);
      road.setAlpha(active ? 1 : 0.84);
      return;
    }

    const node = this.nodeShapes[target.id];

    if (!node) {
      return;
    }

    node.setScale(active ? 1.08 : 1);
  }

  private getChoiceTargetPosition(target: CatanActionTarget) {
    if (target.kind === "road") {
      const road = roadPositions[target.id];

      if (!road) {
        return { x: 520, y: 260 };
      }

      return {
        x: (road.x1 + road.x2) / 2,
        y: (road.y1 + road.y2) / 2,
      };
    }

    return nodePositions[target.id] ?? { x: 520, y: 260 };
  }

  private createHexPoints(radius: number) {
    const points: number[] = [];

    for (let index = 0; index < 6; index += 1) {
      const angle = Phaser.Math.DegToRad(60 * index - 30);
      points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }

    return points;
  }
}
