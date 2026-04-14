import Phaser from "phaser";
import type { EventBus } from "../../../bus/createEventBus";
import { sceneKeys } from "../../../phaser/sceneKeys";
import type { FestivalCrowdCue } from "../config/content";
import {
  mapCollisionBlockers,
  mapLocations,
  mapSceneContent,
} from "../config/content";

type MapTarget = "shrimp" | "catan" | "festival";
type FestivalMode = "idle" | "prelude" | "celebrating" | "settled";

type MapProgressState = {
  shrimpCompleted: boolean;
  catanCompleted: boolean;
  festivalUnlocked: boolean;
  festivalSeen: boolean;
  fishingChestEligible: boolean;
  reservoirChestOpened: boolean;
  playerCoins: number;
};

type BuildingEntrance = {
  target: MapTarget;
  centerX: number;
  centerY: number;
  triggerRect: Phaser.Geom.Rectangle;
  doorPad: Phaser.GameObjects.Rectangle;
  signPlate: Phaser.GameObjects.Rectangle;
  signText: Phaser.GameObjects.Text;
  keyHintPlate: Phaser.GameObjects.Arc;
  keyHintText: Phaser.GameObjects.Text;
  aura: Phaser.GameObjects.Ellipse;
  beacons: Phaser.GameObjects.Arc[];
  ornaments: Phaser.GameObjects.Image[];
  markerDot: Phaser.GameObjects.Arc;
  markerLabel: Phaser.GameObjects.Text;
};

type CrowdNpc = {
  sprite: Phaser.GameObjects.Image;
  group: FestivalCrowdCue;
  baseX: number;
  baseY: number;
  baseScale: number;
  roamRadiusX: number;
  roamRadiusY: number;
};

type CrowdMotionConfig = {
  amplitude: number;
  durationBase: number;
  pauseMinMs: number;
  pauseMaxMs: number;
  scalePulse: number;
  roamSpreadX: number;
  roamSpreadY: number;
  angleRange: number;
  durationJitterMin: number;
  durationJitterMax: number;
};

type FireworkLaunchConfig = {
  launchX: number;
  peakY: number;
  particleCount: number;
  radius: number;
  colors: number[];
  travelMs?: number;
  ringBurst?: boolean;
  doubleBurst?: boolean;
};

const mapAssetKeys = {
  town: "map-town",
  houseA: "map-house-a",
  houseB: "map-house-b",
  tree: "map-tree",
  rock: "map-rock",
  well: "map-well",
  table: "map-table",
  cake: "map-cake",
  gift: "map-gift",
  lights: "map-lights",
  flowers: "map-flowers",
  chest: "map-chest",
  player: "map-player",
  emily: "map-npc-emily",
  abigail: "map-npc-abigail",
  leah: "map-npc-leah",
  sam: "map-npc-sam",
  crowdGirl: "map-npc-crowd-girl",
  crowdWoman: "map-npc-crowd-woman",
  crowdOldWoman: "map-npc-crowd-old-woman",
  crowdKid: "map-npc-crowd-kid",
  crowdCap: "map-npc-crowd-cap",
  crowdMiner: "map-npc-crowd-miner",
  crowdSage: "map-npc-crowd-sage",
} as const;

const crowdSpritePool = [
  mapAssetKeys.emily,
  mapAssetKeys.abigail,
  mapAssetKeys.leah,
  mapAssetKeys.sam,
  mapAssetKeys.crowdGirl,
  mapAssetKeys.crowdWoman,
  mapAssetKeys.crowdOldWoman,
  mapAssetKeys.crowdKid,
  mapAssetKeys.crowdCap,
  mapAssetKeys.crowdMiner,
  mapAssetKeys.crowdSage,
] as const;

const crowdTintPalette = [0xffffff, 0xf8f7e2, 0xf2ffe4, 0xfff0dd] as const;
const mapPlayerSpawnPoint = { x: 486, y: 432 } as const;
const festivalGiftInteractPoint = { x: 804, y: 430 } as const;
const festivalGiftInteractRadius = 124;
const reservoirChestPoint = { x: 564, y: 354 } as const;
const reservoirChestInteractRadius = 76;
const playerHitboxSize = { width: 20, height: 14 } as const;

export class MapScene extends Phaser.Scene {
  private readonly bus: EventBus;
  private readonly textureFallbackReported = new Set<string>();
  private fatalErrorShown = false;

  private player?: Phaser.GameObjects.Image;
  private cursorKeys?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys?: Record<"W" | "A" | "S" | "D" | "E", Phaser.Input.Keyboard.Key>;
  private statusText?: Phaser.GameObjects.Text;
  private progressText?: Phaser.GameObjects.Text;

  private entrances: BuildingEntrance[] = [];
  private collisionRects: Phaser.Geom.Rectangle[] = mapCollisionBlockers.map(
    (blocker) =>
      new Phaser.Geom.Rectangle(
        blocker.x,
        blocker.y,
        blocker.width,
        blocker.height,
      ),
  );
  private activeTarget: MapTarget | null = null;
  private locationStatus: MapProgressState = {
    shrimpCompleted: false,
    catanCompleted: false,
    festivalUnlocked: false,
    festivalSeen: false,
    fishingChestEligible: false,
    reservoirChestOpened: false,
    playerCoins: 0,
  };
  private festivalMode: FestivalMode = "idle";
  private festivalAutoTriggered = false;

  private festivalGlow?: Phaser.GameObjects.Ellipse;
  private festivalTable?: Phaser.GameObjects.Image;
  private festivalCake?: Phaser.GameObjects.Image;
  private festivalGift?: Phaser.GameObjects.Image;
  private festivalGiftMarker?: Phaser.GameObjects.Ellipse;
  private festivalGiftHintText?: Phaser.GameObjects.Text;
  private reservoirChest?: Phaser.GameObjects.Image;
  private reservoirChestHalo?: Phaser.GameObjects.Ellipse;
  private reservoirChestHintText?: Phaser.GameObjects.Text;
  private playerSpotlight?: Phaser.GameObjects.Ellipse;
  private playerHalo?: Phaser.GameObjects.Ellipse;
  private playerCrown?: Phaser.GameObjects.Text;
  private playerTitle?: Phaser.GameObjects.Text;
  private festivalLanterns: Phaser.GameObjects.Image[] = [];
  private festivalBulbs: Phaser.GameObjects.Arc[] = [];
  private festivalSparkles: Phaser.GameObjects.Arc[] = [];
  private festivalHosts: Phaser.GameObjects.Image[] = [];
  private festivalCrowd: CrowdNpc[] = [];
  private festivalGiftOpened = false;

  private lanternPulseTweens: Phaser.Tweens.Tween[] = [];
  private crowdIdleTweens: Phaser.Tweens.Tween[] = [];
  private crowdWalkTimers: Phaser.Time.TimerEvent[] = [];
  private crowdWaveTimer?: Phaser.Time.TimerEvent;
  private playerHighlightTweens: Phaser.Tweens.Tween[] = [];

  private fireworkShowRunning = false;
  private fireworkTimers: Phaser.Time.TimerEvent[] = [];
  private fireworkObjects: Phaser.GameObjects.GameObject[] = [];

  private cleanupFns: Array<() => void> = [];

  constructor(bus: EventBus) {
    super(sceneKeys.map);
    this.bus = bus;
  }

  preload() {
    this.load.image(mapAssetKeys.town, "/festival/background/pix-quest-example-1.png");
    this.load.image(mapAssetKeys.houseA, "/festival/buildings/pixelwood/house-1.png");
    this.load.image(mapAssetKeys.houseB, "/festival/buildings/pixelwood/house-6.png");
    this.load.image(mapAssetKeys.tree, "/festival/environment/pixelwood/tree-1.png");
    this.load.image(mapAssetKeys.rock, "/festival/environment/pixelwood/rock-1.png");
    this.load.image(mapAssetKeys.well, "/festival/props/pixelwood/well-1.png");
    this.load.image(mapAssetKeys.table, "/festival/props/table.png");
    this.load.image(mapAssetKeys.cake, "/festival/props/cake.png");
    this.load.image(mapAssetKeys.gift, "/festival/props/gift.png");
    this.load.image(mapAssetKeys.lights, "/festival/props/lights.png");
    this.load.image(mapAssetKeys.flowers, "/festival/props/flowers.png");
    this.load.image(mapAssetKeys.chest, "/festival/props/pixelwood/chest-1.png");
    this.load.image(mapAssetKeys.player, "/festival/npc/player.png");
    this.load.image(mapAssetKeys.emily, "/festival/npc/emily.png");
    this.load.image(mapAssetKeys.abigail, "/festival/npc/abigail.png");
    this.load.image(mapAssetKeys.leah, "/festival/npc/leah.png");
    this.load.image(mapAssetKeys.sam, "/festival/npc/sam.png");
    this.load.image(mapAssetKeys.crowdGirl, "/festival/npc/crowd/girl-2.png");
    this.load.image(mapAssetKeys.crowdWoman, "/festival/npc/crowd/woman-1.png");
    this.load.image(mapAssetKeys.crowdOldWoman, "/festival/npc/crowd/old-woman-1.png");
    this.load.image(mapAssetKeys.crowdKid, "/festival/npc/crowd/kid-1.png");
    this.load.image(mapAssetKeys.crowdCap, "/festival/npc/crowd/cap-1.png");
    this.load.image(mapAssetKeys.crowdMiner, "/festival/npc/crowd/miner-1.png");
    this.load.image(mapAssetKeys.crowdSage, "/festival/npc/crowd/sage-1.png");
  }

  create() {
    try {
      this.createMapBackdrop();
      this.createTownScenery();
      this.createFestivalDecor();
      this.createReservoirChestDecor();
      this.createEntrances();
      this.createPlayer();
      this.createHudTexts();

      this.cursorKeys = this.input.keyboard?.createCursorKeys();
      this.wasdKeys = this.input.keyboard?.addKeys("W,A,S,D,E") as Record<
        "W" | "A" | "S" | "D" | "E",
        Phaser.Input.Keyboard.Key
      >;

      this.cleanupFns.push(
        this.bus.commands.subscribe("map/show-state", (payload) => {
          this.locationStatus = payload;
          if (payload.festivalSeen) {
            this.festivalAutoTriggered = true;
          }

          this.refreshEntranceDecor();
          this.applyFestivalVisualState(false);
          this.updatePrompt();
        }),
        this.bus.commands.subscribe("map/festival-mode", ({ mode }) => {
          this.setFestivalMode(mode);
        }),
        this.bus.commands.subscribe("map/festival-crowd-cue", ({ cue }) => {
          this.playCrowdCue(cue, false);
        }),
      );

      this.refreshEntranceDecor();
      this.applyFestivalVisualState(true);
      this.updatePrompt();
    } catch (error) {
      this.renderFatalError("地图场景初始化失败", error);
      this.bus.events.emit("system/error", {
        source: "map/scene-create",
        message: error instanceof Error ? error.message : String(error),
        code: "map_scene_create_failed",
      });
    }
  }

  update(_time: number, delta: number) {
    if (this.fatalErrorShown) {
      return;
    }

    try {
      if (!this.player || !this.cursorKeys || !this.wasdKeys) {
        return;
      }

      const direction = new Phaser.Math.Vector2(
        Number(this.cursorKeys.right.isDown || this.wasdKeys.D.isDown) -
          Number(this.cursorKeys.left.isDown || this.wasdKeys.A.isDown),
        Number(this.cursorKeys.down.isDown || this.wasdKeys.S.isDown) -
          Number(this.cursorKeys.up.isDown || this.wasdKeys.W.isDown),
      );

      if (direction.lengthSq() > 0) {
        direction.normalize();
      }

      const speed =
        this.festivalMode === "celebrating"
          ? 152
          : this.festivalMode === "settled"
            ? 156
            : 172;
      const step = (speed * delta) / 1000;

      this.tryMovePlayer(direction.x * step, 0);
      this.tryMovePlayer(0, direction.y * step);

      if (direction.x !== 0) {
        this.player.setFlipX(direction.x < 0);
      }

      this.player.setDepth(12 + this.player.y / 1000);
      this.syncPlayerSignatureDecor();
      this.updateActiveTarget();
      const interactPressed = Phaser.Input.Keyboard.JustDown(this.wasdKeys.E);
      const fallbackTarget =
        interactPressed && !this.activeTarget
          ? this.getNearbyEntranceTarget(178)
          : null;

      if (interactPressed && this.canOpenFestivalGift()) {
        this.openFestivalGift();
        this.updatePrompt();
        return;
      }

      if (interactPressed && this.canOpenReservoirChest()) {
        this.openReservoirChest();
        this.updatePrompt();
        return;
      }

      if (
        (this.activeTarget || fallbackTarget) &&
        interactPressed &&
        this.canEnterTarget(this.activeTarget ?? fallbackTarget!)
      ) {
        this.bus.events.emit("map/enter-request", { target: this.activeTarget ?? fallbackTarget! });
      }

      this.updatePrompt();
    } catch (error) {
      this.renderFatalError("地图场景运行失败", error);
      this.bus.events.emit("system/error", {
        source: "map/scene-update",
        message: error instanceof Error ? error.message : String(error),
        code: "map_scene_update_failed",
      });
    }
  }

  shutdown() {
    this.cleanupFns.forEach((cleanup) => cleanup());
    this.cleanupFns = [];
    this.stopLanternPulse();
    this.stopCrowdIdleMotion();
    this.stopCrowdWaveLoop();
    this.stopPlayerHighlightPulse();
    this.stopFireworkShow(true);
  }

  private createMapBackdrop() {
    this.cameras.main.setBackgroundColor("#111d26");
    const backdropKey = this.resolveTextureKey(mapAssetKeys.town, 0x1b3040, 64, 48);

    this.add
      .image(480, 270, backdropKey)
      .setDisplaySize(960, 540)
      .setDepth(0);

    this.add
      .rectangle(480, 270, 960, 540, 0x0a131b, 0.12)
      .setDepth(0.4);
  }

  private createTownScenery() {
    const wellKey = this.resolveTextureKey(mapAssetKeys.well, 0x4f5f66, 28, 36);
    const treeKey = this.resolveTextureKey(mapAssetKeys.tree, 0x2e7a3f, 24, 24);
    const flowerKey = this.resolveTextureKey(mapAssetKeys.flowers, 0xe0b6d9, 12, 12);

    this.add
      .image(632, 280, wellKey)
      .setOrigin(0.5, 1)
      .setScale(1.56)
      .setDepth(5);

    [
      { x: 118, y: 338, scale: 1.56 },
      { x: 926, y: 324, scale: 1.52 },
    ].forEach((tree) => {
      this.add
        .image(tree.x, tree.y, treeKey)
        .setOrigin(0.5, 1)
        .setScale(tree.scale)
        .setDepth(5);
    });

    [
      { x: 258, y: 436, scale: 1.5 },
      { x: 846, y: 432, scale: 1.44 },
    ].forEach((flower) => {
      this.add
        .image(flower.x, flower.y, flowerKey)
        .setOrigin(0.5, 1)
        .setScale(flower.scale)
        .setDepth(6.2);
    });
  }

  private createFestivalDecor() {
    const tableKey = this.resolveTextureKey(mapAssetKeys.table, 0x8d6f52, 28, 18);
    const cakeKey = this.resolveTextureKey(mapAssetKeys.cake, 0xf2dfb2, 28, 12);
    const giftKey = this.resolveTextureKey(mapAssetKeys.gift, 0xe7d8c5, 20, 20);
    const lightsKey = this.resolveTextureKey(mapAssetKeys.lights, 0xffd58a, 10, 24);

    this.festivalGlow = this.add
      .ellipse(806, 332, 326, 186, 0xffd58a, 0.38)
      .setAlpha(0)
      .setDepth(6.6)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.festivalTable = this.add
      .image(804, 384, tableKey)
      .setOrigin(0.5, 1)
      .setScale(2.9)
      .setAlpha(0.28)
      .setDepth(8);

    this.festivalCake = this.add
      .image(832, 353, cakeKey)
      .setOrigin(0.5, 1)
      .setScale(0.65)
      .setAlpha(0)
      .setDepth(8.6);

    this.festivalGift = this.add
      .image(804, 422, giftKey)
      .setOrigin(0.5, 1)
      .setScale(1.38)
      .setAlpha(0)
      .setDepth(8.9);

    this.festivalGiftMarker = this.add
      .ellipse(804, 430, 88, 44, 0xffe7a8, 0.28)
      .setDepth(8.7)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.festivalGiftHintText = this.add
      .text(804, 384, "礼物(E)", {
        fontFamily: "Trebuchet MS",
        fontSize: "14px",
        color: "#fff0c7",
        stroke: "#13202a",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(9.1)
      .setAlpha(0);

    [680, 716, 752, 788, 824, 860, 896, 932].forEach((x, index) => {
      const lantern = this.add
        .image(x, 258 + ((index + 1) % 2) * 7, lightsKey)
        .setOrigin(0.5, 1)
        .setScale(2.06)
        .setAlpha(0)
        .setDepth(7.1);

      const bulb = this.add
        .circle(x, 226 + ((index + 1) % 2) * 7, 7, 0xfff0ab, 0)
        .setDepth(7.3)
        .setBlendMode(Phaser.BlendModes.ADD);

      this.festivalLanterns.push(lantern);
      this.festivalBulbs.push(bulb);
    });

    [
      { x: 734, y: 424, key: mapAssetKeys.emily },
      { x: 770, y: 410, key: mapAssetKeys.abigail },
      { x: 874, y: 410, key: mapAssetKeys.leah },
      { x: 910, y: 424, key: mapAssetKeys.sam },
    ].forEach((host) => {
      const hostKey = this.resolveTextureKey(host.key, 0xd4d7db, 16, 16);
      this.festivalHosts.push(
        this.add
          .image(host.x, host.y, hostKey)
          .setOrigin(0.5, 1)
          .setScale(2.02)
          .setAlpha(0)
          .setDepth(10.4 + host.y / 1000),
      );
    });

    [
      { x: 724, y: 296, radius: 3 },
      { x: 758, y: 282, radius: 4 },
      { x: 804, y: 268, radius: 3 },
      { x: 850, y: 282, radius: 4 },
      { x: 884, y: 296, radius: 3 },
    ].forEach((sparkle) => {
      this.festivalSparkles.push(
        this.add
          .circle(sparkle.x, sparkle.y, sparkle.radius, 0xfff4c2, 0)
          .setDepth(9.4)
          .setBlendMode(Phaser.BlendModes.ADD),
      );
    });

    const crowdRows = [
      {
        y: 326,
        scale: 1.64,
        xValues: [112, 166, 220, 274, 334, 402, 478, 554, 630, 706, 782, 858, 918],
      },
      {
        y: 356,
        scale: 1.76,
        xValues: [96, 154, 212, 270, 332, 404, 486, 568, 650, 732, 814, 896],
      },
      {
        y: 392,
        scale: 1.9,
        xValues: [126, 190, 256, 324, 398, 476, 554, 632, 710, 788, 866],
      },
      {
        y: 430,
        scale: 2.02,
        xValues: [156, 224, 296, 372, 450, 528, 606, 684, 762, 840],
      },
      {
        y: 468,
        scale: 2.1,
        xValues: [210, 286, 362, 438, 514, 590, 666, 742, 818],
      },
    ] as const;

    let crowdIndex = 0;
    crowdRows.forEach((row) => {
      row.xValues.forEach((xValue) => {
        const spriteKey = crowdSpritePool[crowdIndex % crowdSpritePool.length];
        const resolvedSpriteKey = this.resolveTextureKey(spriteKey, 0xd7dde2, 16, 16);
        const tint = crowdTintPalette[crowdIndex % crowdTintPalette.length];
        const group: FestivalCrowdCue =
          xValue < 330 ? "left" : xValue > 650 ? "right" : "center";
        const sprite = this.add
          .image(xValue, row.y, resolvedSpriteKey)
          .setOrigin(0.5, 1)
          .setScale(row.scale + (crowdIndex % 2 === 0 ? 0.04 : 0))
          .setAlpha(0)
          .setDepth(9.8 + row.y / 1000);

        if (tint !== 0xffffff) {
          sprite.setTint(tint);
        }

        this.festivalCrowd.push({
          sprite,
          group,
          baseX: xValue,
          baseY: row.y,
          baseScale: row.scale + (crowdIndex % 2 === 0 ? 0.04 : 0),
          roamRadiusX: 16 + (crowdIndex % 4) * 4,
          roamRadiusY: 8 + (crowdIndex % 3) * 3,
        });

        crowdIndex += 1;
      });
    });
  }

  private createReservoirChestDecor() {
    const chestKey = this.resolveTextureKey(mapAssetKeys.chest, 0xb5885a, 20, 18);
    this.reservoirChestHalo = this.add
      .ellipse(reservoirChestPoint.x, reservoirChestPoint.y + 8, 96, 42, 0x9ce7ff, 0.24)
      .setDepth(7.1)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.reservoirChest = this.add
      .image(reservoirChestPoint.x, reservoirChestPoint.y, chestKey)
      .setOrigin(0.5, 1)
      .setScale(1.52)
      .setDepth(7.4)
      .setAlpha(0);
    this.reservoirChestHintText = this.add
      .text(reservoirChestPoint.x, reservoirChestPoint.y - 42, "水库宝箱(E)", {
        fontFamily: "Trebuchet MS",
        fontSize: "13px",
        color: "#dff6ff",
        stroke: "#122230",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(7.6)
      .setAlpha(0);
  }

  private createEntrances() {
    this.entrances = [
      this.createEntrance("shrimp", 290, 424, 168, 96, {
        triggerOffsetY: -70,
        triggerWidth: playerHitboxSize.width,
        triggerHeight: playerHitboxSize.height,
      }),
      this.createEntrance("catan", 680, 378, 186, 144, {
        triggerOffsetY: -64,
        triggerWidth: playerHitboxSize.width,
        triggerHeight: playerHitboxSize.height,
      }),
      this.createEntrance("festival", 806, 430, 146, 102, {
        triggerOffsetY: -48,
        triggerWidth: playerHitboxSize.width * 2.5,
        triggerHeight: playerHitboxSize.height * 2.5,
      }),
    ];
  }

  private createEntrance(
    target: MapTarget,
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    options?: {
      triggerOffsetY?: number;
      triggerWidth?: number;
      triggerHeight?: number;
    },
  ) {
    const meta = this.getLocationMeta(target);
    const triggerWidth = options?.triggerWidth ?? width;
    const triggerHeight = options?.triggerHeight ?? height;
    const triggerCenterY = centerY + (options?.triggerOffsetY ?? 0);
    const triggerRect = new Phaser.Geom.Rectangle(
      centerX - triggerWidth / 2,
      triggerCenterY - triggerHeight / 2,
      triggerWidth,
      triggerHeight,
    );
    const markerCenterY = triggerCenterY - 10;
    const doorPad = this.add
      .rectangle(centerX, centerY, width, height, 0x1b2d38, 0)
      .setStrokeStyle(1, 0x8cae97, 0)
      .setDepth(7.4)
      .setAlpha(0);

    const aura = this.add
      .ellipse(centerX, centerY + height * 0.1, width + 34, height + 12, 0xffffff, 0)
      .setDepth(7.2)
      .setAlpha(0)
      .setVisible(false)
      .setBlendMode(Phaser.BlendModes.ADD);

    const beacons: Phaser.GameObjects.Arc[] = [];
    const ornaments: Phaser.GameObjects.Image[] = [];
    const markerLabelByTarget: Record<MapTarget, string> = {
      shrimp: "钓鱼入口",
      catan: "卡坦岛入口",
      festival: "晚会入口",
    };
    const markerColorByTarget: Record<MapTarget, number> = {
      shrimp: 0x9be3ff,
      catan: 0xffe2a6,
      festival: 0xffffff,
    };
    const markerTextColorByTarget: Record<MapTarget, string> = {
      shrimp: "#d4f3ff",
      catan: "#ffe9be",
      festival: "#f8f2dc",
    };
    const markerDot = this.add
      .circle(
        centerX,
        markerCenterY - 12,
        4.5,
        markerColorByTarget[target],
        target === "festival" ? 0 : 0.56,
      )
      .setDepth(10.5)
      .setAlpha(target === "festival" ? 0 : 0.56)
      .setBlendMode(Phaser.BlendModes.ADD);
    const markerLabel = this.add
      .text(centerX, markerCenterY + 2, markerLabelByTarget[target], {
        fontFamily: "Trebuchet MS",
        fontSize: "12px",
        color: markerTextColorByTarget[target],
        stroke: "#0f171f",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(10.6)
      .setAlpha(target === "festival" ? 0 : 0.74);

    if (target !== "festival") {
      this.tweens.add({
        targets: markerDot,
        alpha: 0.96,
        duration: 760,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      this.tweens.add({
        targets: markerLabel,
        alpha: 1,
        duration: 980,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    const signPlate = this.add
      .rectangle(centerX, markerCenterY - 14, 116, 26, 0x0f1a24, 0.74)
      .setStrokeStyle(1, 0xd8c28d, 0.24)
      .setDepth(10.1)
      .setAlpha(0);

    const signText = this.add
      .text(centerX, markerCenterY - 14, meta.title, {
        fontFamily: "Trebuchet MS",
        fontSize: "12px",
        color: "#f1e4c1",
      })
      .setOrigin(0.5)
      .setDepth(10.2)
      .setAlpha(0);

    const keyHintPlate = this.add
      .circle(centerX, markerCenterY + 10, 10, 0x121a22, 0.72)
      .setStrokeStyle(1, 0xddc89b, 0.32)
      .setDepth(10.2)
      .setAlpha(0);

    const keyHintText = this.add
      .text(centerX, markerCenterY + 10, "E", {
        fontFamily: "Trebuchet MS",
        fontSize: "11px",
        color: "#efe3c5",
      })
      .setOrigin(0.5)
      .setDepth(10.3)
      .setAlpha(0);

    return {
      target,
      centerX,
      centerY,
      triggerRect,
      doorPad,
      signPlate,
      signText,
      keyHintPlate,
      keyHintText,
      aura,
      beacons,
      ornaments,
      markerDot,
      markerLabel,
    };
  }

  private createPlayer() {
    const playerKey = this.resolveTextureKey(mapAssetKeys.player, 0xea6fa6, 16, 16);
    this.player = this.add
      .image(mapPlayerSpawnPoint.x, mapPlayerSpawnPoint.y, playerKey)
      .setOrigin(0.5, 1)
      .setScale(2.3)
      .setDepth(12.4);
    this.createPlayerSignatureDecor();
    this.syncPlayerSignatureDecor();
  }

  private createPlayerSignatureDecor() {
    if (!this.player) {
      return;
    }

    this.playerSpotlight = this.add
      .ellipse(this.player.x, this.player.y + 10, 108, 48, 0xffe6a8, 0.18)
      .setDepth(11.4)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.playerHalo = this.add
      .ellipse(this.player.x, this.player.y - 8, 52, 74, 0xffd47d, 0.2)
      .setDepth(12.8)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.playerCrown = this.add
      .text(this.player.x, this.player.y - 58, "✦", {
        fontFamily: "Trebuchet MS",
        fontSize: "18px",
        color: "#ffe7ab",
        stroke: "#2f1e08",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(13.2)
      .setAlpha(0.86);

    this.playerTitle = this.add
      .text(this.player.x, this.player.y - 78, "橙橙", {
        fontFamily: "Trebuchet MS",
        fontSize: "12px",
        color: "#fff4cf",
        stroke: "#13202a",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(13.25)
      .setAlpha(0.84);
  }

  private syncPlayerSignatureDecor() {
    if (!this.player) {
      return;
    }

    const depthBase = 12 + this.player.y / 1000;
    this.playerSpotlight?.setPosition(this.player.x, this.player.y + 10).setDepth(depthBase - 0.5);
    this.playerHalo?.setPosition(this.player.x, this.player.y - 8).setDepth(depthBase + 0.2);
    this.playerCrown?.setPosition(this.player.x, this.player.y - 58).setDepth(depthBase + 0.5);
    this.playerTitle?.setPosition(this.player.x, this.player.y - 78).setDepth(depthBase + 0.55);
  }

  private createHudTexts() {
    this.add
      .text(24, 20, mapSceneContent.title, {
        fontFamily: "Trebuchet MS",
        fontSize: "26px",
        color: "#f7ebc2",
      })
      .setDepth(20);

    this.add
      .text(24, 54, mapSceneContent.subtitle, {
        fontFamily: "Trebuchet MS",
        fontSize: "16px",
        color: "#d7eec4",
      })
      .setDepth(20);

    this.progressText = this.add
      .text(932, 26, "", {
        fontFamily: "Trebuchet MS",
        fontSize: "14px",
        color: "#f7ebc2",
        align: "right",
      })
      .setOrigin(1, 0)
      .setDepth(20);

    this.statusText = this.add
      .text(24, 502, mapSceneContent.idlePrompt, {
        fontFamily: "Trebuchet MS",
        fontSize: "18px",
        color: "#f8f2dc",
      })
      .setDepth(20);
  }

  private setFestivalMode(nextMode: FestivalMode) {
    const modeChanged = this.festivalMode !== nextMode;

    if (nextMode === "settled") {
      this.locationStatus = {
        ...this.locationStatus,
        festivalSeen: true,
        festivalUnlocked: true,
      };
      this.refreshEntranceDecor();
    }

    this.festivalMode = nextMode;
    const immediateVisual = nextMode === "settled" ? true : !modeChanged;
    this.applyFestivalVisualState(immediateVisual);
    this.updatePrompt();

    if (modeChanged && nextMode === "prelude") {
      this.time.delayedCall(120, () => {
        if (this.getEffectiveFestivalMode() === "prelude") {
          this.playCrowdCue("all", false);
        }
      });
    }

    if (modeChanged && nextMode === "celebrating") {
      this.festivalGiftOpened = false;
      this.playCrowdCue("all", true);
      this.launchCelebrationOpeningFireworks();
    }

    if (modeChanged && nextMode === "settled") {
      this.time.delayedCall(40, () => {
        if (this.getEffectiveFestivalMode() === "settled") {
          this.playCrowdCue("all", false);
        }
      });
    }
  }

  private applyFestivalVisualState(immediate: boolean) {
    const mode = this.getEffectiveFestivalMode();

    let tableAlpha = this.locationStatus.festivalUnlocked ? 0.42 : 0.22;
    let cakeAlpha = 0;
    let giftAlpha = 0;
    let giftMarkerAlpha = 0;
    let giftHintAlpha = 0;
    let glowAlpha = 0;
    let lightAlpha = 0;
    let sparkleAlpha = 0;
    let hostAlpha = 0;
    let crowdAlpha = 0;
    let crowdScaleBoost = 0;
    let playerSpotlightAlpha = 0;
    let playerHaloAlpha = 0.18;
    let playerCrownAlpha = 0.84;
    let playerTitleAlpha = 0.8;
    let playerScale = 2.3;
    let playerTint: number | null = null;

    if (mode === "prelude") {
      tableAlpha = 0.74;
      cakeAlpha = 0.82;
      giftAlpha = 0;
      glowAlpha = 0.26;
      lightAlpha = 0.78;
      sparkleAlpha = 0.2;
      hostAlpha = 0.56;
      crowdAlpha = 0.48;
      crowdScaleBoost = 0.03;
      playerSpotlightAlpha = 0;
      playerHaloAlpha = 0.28;
      playerCrownAlpha = 0.94;
      playerTitleAlpha = 0.92;
      playerScale = 2.32;
      playerTint = 0xffedd2;
    }

    if (mode === "celebrating") {
      tableAlpha = 0.96;
      cakeAlpha = 0.98;
      giftAlpha = 0.98;
      giftMarkerAlpha = this.festivalGiftOpened ? 0 : 0.74;
      giftHintAlpha = this.festivalGiftOpened ? 0 : 0.92;
      glowAlpha = 0.44;
      lightAlpha = 0.92;
      sparkleAlpha = 0.58;
      hostAlpha = 0.96;
      crowdAlpha = 0.96;
      crowdScaleBoost = 0.07;
      playerSpotlightAlpha = 0;
      playerHaloAlpha = 0.6;
      playerCrownAlpha = 0.98;
      playerTitleAlpha = 0.98;
      playerScale = 2.36;
      playerTint = 0xfff1d8;
    }

    if (mode === "settled") {
      tableAlpha = 0.84;
      cakeAlpha = 0.86;
      giftAlpha = this.festivalGiftOpened ? 0.66 : 0.88;
      giftMarkerAlpha = this.festivalGiftOpened ? 0 : 0.66;
      giftHintAlpha = this.festivalGiftOpened ? 0 : 0.9;
      glowAlpha = 0.22;
      lightAlpha = 0.8;
      sparkleAlpha = 0.26;
      hostAlpha = 0.9;
      crowdAlpha = 0.98;
      crowdScaleBoost = 0.04;
      playerSpotlightAlpha = 0;
      playerHaloAlpha = 0.38;
      playerCrownAlpha = 0.92;
      playerTitleAlpha = 0.9;
      playerScale = 2.34;
      playerTint = 0xffe9cb;
    }

    this.transitionAlpha(this.festivalGlow, glowAlpha, immediate, 320);
    this.transitionAlpha(this.festivalTable, tableAlpha, immediate, 300);
    this.transitionAlpha(this.festivalCake, cakeAlpha, immediate, 300);
    this.transitionAlpha(this.festivalGift, giftAlpha, immediate, 300);
    this.transitionAlpha(this.festivalGiftMarker, giftMarkerAlpha, immediate, 240);
    this.transitionAlpha(this.festivalGiftHintText, giftHintAlpha, immediate, 240);

    this.festivalLanterns.forEach((lantern) => {
      this.transitionAlpha(lantern, lightAlpha, immediate, 340);
    });

    this.festivalBulbs.forEach((bulb, index) => {
      const layerBoost = index % 2 === 0 ? 0.12 : 0.04;
      this.transitionAlpha(
        bulb,
        Math.min(1, lightAlpha * 0.9 + layerBoost),
        immediate,
        340,
      );
    });

    this.festivalSparkles.forEach((sparkle, index) => {
      const intensity = 0.45 + (index % 3) * 0.2;
      this.transitionAlpha(sparkle, sparkleAlpha * intensity, immediate, 420);
    });

    this.festivalHosts.forEach((host) => {
      this.transitionAlpha(host, hostAlpha, immediate, 320);
    });

    this.festivalCrowd.forEach((crowdNpc) => {
      this.transitionAlpha(crowdNpc.sprite, crowdAlpha, immediate, 360);
      this.transitionScale(
        crowdNpc.sprite,
        crowdNpc.baseScale + crowdScaleBoost,
        immediate,
        360,
      );
    });

    this.transitionAlpha(this.playerSpotlight, playerSpotlightAlpha, immediate, 320);
    this.transitionAlpha(this.playerHalo, playerHaloAlpha, immediate, 320);
    this.transitionAlpha(this.playerCrown, playerCrownAlpha, immediate, 260);
    this.transitionAlpha(this.playerTitle, playerTitleAlpha, immediate, 260);
    this.transitionScale(this.player, playerScale, immediate, 280);

    if (this.player) {
      if (playerTint === null) {
        this.player.clearTint();
      } else {
        this.player.setTint(playerTint);
      }
    }

    this.refreshReservoirChestState(immediate);

    if (mode === "celebrating") {
      this.startLanternPulse(260, 0.18);
      this.startCrowdIdleMotion({
        amplitude: 3.2,
        durationBase: 760,
        pauseMinMs: 180,
        pauseMaxMs: 420,
        scalePulse: 0.024,
        roamSpreadX: 1,
        roamSpreadY: 1,
        angleRange: 3,
        durationJitterMin: -140,
        durationJitterMax: 180,
      });
      this.startCrowdWaveLoop();
      this.startPlayerHighlightPulse(false);
      this.startFireworkShow();
      return;
    }

    if (mode === "prelude") {
      this.startLanternPulse(280, 0.16);
      this.startCrowdIdleMotion({
        amplitude: 2.2,
        durationBase: 840,
        pauseMinMs: 260,
        pauseMaxMs: 620,
        scalePulse: 0.02,
        roamSpreadX: 1.08,
        roamSpreadY: 1.06,
        angleRange: 4,
        durationJitterMin: -180,
        durationJitterMax: 220,
      });
      this.stopCrowdWaveLoop();
      this.startPlayerHighlightPulse(false);
      this.stopFireworkShow(true);
      return;
    }

    if (mode === "settled") {
      this.startLanternPulse(340, 0.1);
      this.startCrowdIdleMotion({
        amplitude: 2.4,
        durationBase: 960,
        pauseMinMs: 240,
        pauseMaxMs: 560,
        scalePulse: 0.022,
        roamSpreadX: 1.2,
        roamSpreadY: 1.12,
        angleRange: 5,
        durationJitterMin: -200,
        durationJitterMax: 260,
      });
      this.startCrowdWaveLoop();
      this.startPlayerHighlightPulse(false);
      this.stopFireworkShow(true);
      return;
    }

    this.stopLanternPulse();
    this.stopCrowdIdleMotion();
    this.stopCrowdWaveLoop();
    this.stopPlayerHighlightPulse();
    this.stopFireworkShow(true);
  }

  private getEffectiveFestivalMode() {
    if (this.festivalMode === "idle" && this.locationStatus.festivalSeen) {
      return "settled";
    }

    return this.festivalMode;
  }

  private startLanternPulse(duration: number, extraAlpha: number) {
    this.stopLanternPulse();

    this.festivalBulbs.forEach((bulb, index) => {
      const targetAlpha = Math.min(1, bulb.alpha + extraAlpha + (index % 2 === 0 ? 0.06 : 0));
      this.lanternPulseTweens.push(
        this.tweens.add({
          targets: bulb,
          alpha: targetAlpha,
          duration: duration + index * 24,
          repeat: -1,
          yoyo: true,
          ease: "Sine.easeInOut",
        }),
      );
    });
  }

  private stopLanternPulse() {
    this.lanternPulseTweens.forEach((tween) => tween.stop());
    this.lanternPulseTweens = [];
  }

  private startPlayerHighlightPulse(strong: boolean) {
    this.stopPlayerHighlightPulse();

    if (!this.playerHalo || !this.playerCrown) {
      return;
    }

    const haloScale = strong ? 1.2 : 1.12;
    const haloDuration = strong ? 460 : 620;
    const crownScale = strong ? 1.16 : 1.1;
    const crownDuration = strong ? 520 : 700;

    this.playerHighlightTweens.push(
      this.tweens.add({
        targets: this.playerHalo,
        scaleX: haloScale,
        scaleY: haloScale,
        alpha: Math.min(1, this.playerHalo.alpha + (strong ? 0.18 : 0.1)),
        duration: haloDuration,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      }),
      this.tweens.add({
        targets: this.playerCrown,
        scaleX: crownScale,
        scaleY: crownScale,
        angle: strong ? 8 : 4,
        duration: crownDuration,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      }),
    );
  }

  private stopPlayerHighlightPulse() {
    this.playerHighlightTweens.forEach((tween) => tween.stop());
    this.playerHighlightTweens = [];
    this.playerHalo?.setScale(1);
    this.playerCrown?.setScale(1);
    this.playerCrown?.setAngle(0);
  }

  private startCrowdIdleMotion(config: CrowdMotionConfig) {
    this.stopCrowdIdleMotion();

    this.festivalCrowd.forEach((crowdNpc, index) => {
      if (crowdNpc.sprite.alpha < 0.2) {
        return;
      }

      this.scheduleCrowdWander(crowdNpc, config, index);
      this.crowdIdleTweens.push(
        this.tweens.add({
          targets: crowdNpc.sprite,
          scaleX: crowdNpc.baseScale + config.scalePulse,
          scaleY: crowdNpc.baseScale + config.scalePulse,
          duration: config.durationBase + 220 + (index % 6) * 48,
          repeat: -1,
          yoyo: true,
          ease: "Sine.easeInOut",
        }),
      );
    });
  }

  private scheduleCrowdWander(crowdNpc: CrowdNpc, config: CrowdMotionConfig, index: number) {
    const walkOnce = () => {
      if (crowdNpc.sprite.alpha < 0.15) {
        return;
      }

      const roamX = Math.max(
        6,
        Math.round(
          crowdNpc.roamRadiusX *
            Phaser.Math.FloatBetween(config.roamSpreadX * 0.78, config.roamSpreadX * 1.2),
        ),
      );
      const roamY = Math.max(
        4,
        Math.round(
          crowdNpc.roamRadiusY *
            Phaser.Math.FloatBetween(config.roamSpreadY * 0.8, config.roamSpreadY * 1.22),
        ),
      );
      const targetX =
        crowdNpc.baseX + Phaser.Math.Between(-roamX, roamX);
      const targetY =
        crowdNpc.baseY -
        config.amplitude * 0.32 +
        Phaser.Math.Between(-roamY, roamY);
      const travelDuration = Math.max(
        280,
        config.durationBase +
          Phaser.Math.Between(config.durationJitterMin, config.durationJitterMax) +
          (index % 5) * 36,
      );
      const targetAngle = Phaser.Math.Between(-config.angleRange, config.angleRange);

      this.crowdIdleTweens.push(
        this.tweens.add({
          targets: crowdNpc.sprite,
          x: targetX,
          y: targetY,
          angle: targetAngle,
          duration: travelDuration,
          ease: "Sine.easeInOut",
          onComplete: () => {
            const pauseTimer = this.time.delayedCall(
              Phaser.Math.Between(config.pauseMinMs, config.pauseMaxMs),
              walkOnce,
            );
            this.crowdWalkTimers.push(pauseTimer);
          },
        }),
      );
    };

    walkOnce();
  }

  private stopCrowdIdleMotion() {
    this.crowdIdleTweens.forEach((tween) => tween.stop());
    this.crowdIdleTweens = [];
    this.crowdWalkTimers.forEach((timer) => timer.destroy());
    this.crowdWalkTimers = [];

    this.festivalCrowd.forEach((crowdNpc) => {
      crowdNpc.sprite.y = crowdNpc.baseY;
      crowdNpc.sprite.x = crowdNpc.baseX;
      crowdNpc.sprite.angle = 0;
      crowdNpc.sprite.setScale(crowdNpc.baseScale);
    });
  }

  private canShowReservoirChest() {
    return this.locationStatus.festivalSeen && this.locationStatus.fishingChestEligible;
  }

  private refreshReservoirChestState(immediate: boolean) {
    const visible = this.canShowReservoirChest();
    const opened = this.locationStatus.reservoirChestOpened;
    const chestAlpha = visible ? (opened ? 0.76 : 0.96) : 0;
    const haloAlpha = visible ? (opened ? 0.14 : 0.34) : 0;
    const hintAlpha = visible && !opened ? 0.92 : 0;

    this.transitionAlpha(this.reservoirChest, chestAlpha, immediate, 260);
    this.transitionAlpha(this.reservoirChestHalo, haloAlpha, immediate, 240);
    this.transitionAlpha(this.reservoirChestHintText, hintAlpha, immediate, 220);
  }

  private canOpenReservoirChest() {
    if (!this.player || !this.reservoirChest) {
      return false;
    }

    if (!this.canShowReservoirChest() || this.locationStatus.reservoirChestOpened) {
      return false;
    }

    const dx = this.player.x - reservoirChestPoint.x;
    const dy = this.player.y - reservoirChestPoint.y;
    return dx * dx + dy * dy <= reservoirChestInteractRadius * reservoirChestInteractRadius;
  }

  private openReservoirChest() {
    if (!this.reservoirChest || this.locationStatus.reservoirChestOpened) {
      return;
    }

    this.locationStatus = {
      ...this.locationStatus,
      reservoirChestOpened: true,
    };
    this.bus.events.emit("map/reservoir-chest-opened", {
      itemId: "jade_pendant",
      itemLabel: "玉石挂坠一个",
    });
    this.reservoirChestHintText?.setAlpha(0);

    this.tweens.add({
      targets: this.reservoirChest,
      y: this.reservoirChest.y - 8,
      duration: 140,
      yoyo: true,
      ease: "Sine.easeOut",
      onComplete: () => {
        this.refreshReservoirChestState(false);
      },
    });
  }

  private canOpenFestivalGift() {
    if (!this.player || !this.festivalGift || this.festivalGiftOpened) {
      return false;
    }

    const mode = this.getEffectiveFestivalMode();
    if (mode !== "celebrating" && mode !== "settled") {
      return false;
    }

    const dx = this.player.x - festivalGiftInteractPoint.x;
    const dy = this.player.y - festivalGiftInteractPoint.y;
    return dx * dx + dy * dy <= festivalGiftInteractRadius * festivalGiftInteractRadius;
  }

  private openFestivalGift() {
    if (!this.festivalGift || this.festivalGiftOpened) {
      return;
    }

    this.festivalGiftOpened = true;
    this.festivalGift.setTint(0xffe3a8);
    this.festivalGiftMarker?.setAlpha(0);
    this.festivalGiftHintText?.setAlpha(0);
    this.playCrowdCue("all", true);
    this.bus.events.emit("map/festival-gift-opened", {
      amountText: "52英镑",
      redeemCode: "我是暴脾气",
    });

    this.tweens.add({
      targets: this.festivalGift,
      y: this.festivalGift.y - 10,
      angle: -10,
      duration: 160,
      yoyo: true,
      ease: "Sine.easeOut",
    });

    [
      { launchX: 752, peakY: 214, radius: 76 },
      { launchX: 806, peakY: 188, radius: 96 },
      { launchX: 862, peakY: 210, radius: 74 },
    ].forEach((firework, index) => {
      this.scheduleFirework(index * 220, () => {
        this.launchFirework({
          launchX: firework.launchX,
          peakY: firework.peakY,
          particleCount: 28,
          radius: firework.radius,
          colors: [0xfff0b3, 0xffd27b, 0xff9ec9, 0xa7ffa3],
          travelMs: 520,
          ringBurst: index === 1,
        });
      });
    });
  }

  private launchCelebrationOpeningFireworks() {
    const openingBursts = [
      { delay: 0, launchX: 748, peakY: 214, radius: 74, count: 22 },
      { delay: 220, launchX: 806, peakY: 190, radius: 88, count: 30 },
      { delay: 440, launchX: 864, peakY: 214, radius: 76, count: 24 },
    ] as const;

    openingBursts.forEach((burst, index) => {
      this.scheduleFirework(burst.delay, () => {
        this.launchFirework({
          launchX: burst.launchX,
          peakY: burst.peakY,
          particleCount: burst.count,
          radius: burst.radius,
          colors:
            index % 2 === 0
              ? [0xfff4be, 0xffd28a, 0xff8fd4, 0xa8e8ff]
              : [0xfff0b3, 0xffc27a, 0xa7ffa3, 0x98ddff],
          travelMs: 560,
          ringBurst: index === 1,
          doubleBurst: false,
        });
      });
    });
  }

  private startCrowdWaveLoop() {
    if (this.crowdWaveTimer) {
      return;
    }

    this.crowdWaveTimer = this.time.addEvent({
      delay: 2800,
      loop: true,
      callback: () => {
        const cuePool: FestivalCrowdCue[] = ["left", "right", "center", "all"];
        const cue = cuePool[Phaser.Math.Between(0, cuePool.length - 1)];
        this.playCrowdCue(cue, false);
      },
    });
  }

  private stopCrowdWaveLoop() {
    if (!this.crowdWaveTimer) {
      return;
    }

    this.crowdWaveTimer.destroy();
    this.crowdWaveTimer = undefined;
  }

  private playCrowdCue(cue: FestivalCrowdCue, strong: boolean) {
    const mode = this.getEffectiveFestivalMode();
    if (mode === "idle") {
      return;
    }

    const targets =
      cue === "all"
        ? this.festivalCrowd
        : this.festivalCrowd.filter((crowdNpc) => crowdNpc.group === cue);

    if (targets.length === 0) {
      return;
    }

    const scaleBoost = strong ? 0.18 : 0.12;
    const jumpY = strong ? 8 : 5;
    targets.forEach((crowdNpc, index) => {
      if (crowdNpc.sprite.alpha < 0.15) {
        return;
      }

      this.tweens.add({
        targets: crowdNpc.sprite,
        scaleX: crowdNpc.baseScale + scaleBoost,
        scaleY: crowdNpc.baseScale + scaleBoost,
        y: crowdNpc.baseY - jumpY,
        duration: 130 + (index % 4) * 22,
        yoyo: true,
        ease: "Quad.easeOut",
      });

      this.tweens.add({
        targets: crowdNpc.sprite,
        alpha: Math.min(1, crowdNpc.sprite.alpha + 0.14),
        duration: 90,
        yoyo: true,
        ease: "Sine.easeInOut",
      });
    });
  }

  private scheduleFirework(delayMs: number, callback: () => void) {
    const timer = this.time.delayedCall(delayMs, () => {
      this.fireworkTimers = this.fireworkTimers.filter((item) => item !== timer);
      callback();
    });
    this.fireworkTimers.push(timer);
  }

  private startFireworkShow() {
    if (this.fireworkShowRunning) {
      return;
    }

    this.fireworkShowRunning = true;
    const centerX = 806;

    [180, 860].forEach((delay, index) => {
      this.scheduleFirework(delay, () => {
        this.launchFirework({
          launchX: centerX + Phaser.Math.Between(-140, 140),
          peakY: 232 - index * 8,
          particleCount: 18,
          radius: 64,
          colors: [0xfff0b3, 0xffd27b, 0xff9ec9],
          travelMs: 580 + index * 40,
        });
      });
    });

    for (let index = 0; index < 6; index += 1) {
      this.scheduleFirework(2480 + index * 620, () => {
        const palette =
          index % 2 === 0
            ? [0x98ddff, 0xff88b8, 0xfff2b0, 0xa7ffa3]
            : [0xffd28a, 0xff8bc2, 0x9ec4ff, 0xf7ffb7];

        this.launchFirework({
          launchX: centerX + Phaser.Math.Between(-170, 170),
          peakY: Phaser.Math.Between(170, 230),
          particleCount: 24,
          radius: 78,
          colors: palette,
          travelMs: Phaser.Math.Between(560, 700),
          ringBurst: index % 3 === 0,
        });

        if (index % 2 === 1) {
          this.playCrowdCue("all", false);
        }
      });
    }

    [6920, 7580].forEach((delay, index) => {
      this.scheduleFirework(delay, () => {
        this.launchFirework({
          launchX: centerX + (index - 1) * 86,
          peakY: 176 - index * 8,
          particleCount: 34,
          radius: 84,
          colors: [0xfff4be, 0xffd28a, 0xff8fd4, 0xa8e8ff],
          travelMs: 640,
          ringBurst: true,
          doubleBurst: false,
        });
      });
    });

    this.scheduleFirework(8160, () => {
      this.playCrowdCue("all", true);
    });

    this.scheduleFirework(9800, () => {
      this.fireworkShowRunning = false;
      if (this.getEffectiveFestivalMode() === "celebrating") {
        this.startFireworkShow();
      }
    });
  }

  private stopFireworkShow(clearObjects: boolean) {
    this.fireworkShowRunning = false;
    this.fireworkTimers.forEach((timer) => timer.destroy());
    this.fireworkTimers = [];

    if (clearObjects) {
      this.fireworkObjects.forEach((object) => object.destroy());
      this.fireworkObjects = [];
    }
  }

  private launchFirework(config: FireworkLaunchConfig) {
    const rocket = this.trackFireworkObject(
      this.add
        .circle(config.launchX, 500, 3, 0xfff6dd, 1)
        .setDepth(15.2)
        .setBlendMode(Phaser.BlendModes.ADD),
    );
    const glow = this.trackFireworkObject(
      this.add
        .circle(config.launchX, 500, 8, config.colors[0], 0.24)
        .setDepth(15.1)
        .setBlendMode(Phaser.BlendModes.ADD),
    );
    const targetX = config.launchX + Phaser.Math.Between(-20, 20);

    this.tweens.add({
      targets: [rocket, glow],
      x: targetX,
      y: config.peakY,
      duration: config.travelMs ?? Phaser.Math.Between(530, 680),
      ease: "Cubic.easeOut",
      onUpdate: () => {
        if (Phaser.Math.Between(0, 100) > 64) {
          const trail = this.trackFireworkObject(
            this.add
              .circle(
                rocket.x + Phaser.Math.Between(-1, 1),
                rocket.y + 8,
                Phaser.Math.Between(1, 2),
                config.colors[Phaser.Math.Between(0, config.colors.length - 1)],
                0.7,
              )
              .setDepth(14.9)
              .setBlendMode(Phaser.BlendModes.ADD),
          );

          this.tweens.add({
            targets: trail,
            y: trail.y + Phaser.Math.Between(10, 18),
            alpha: 0,
            scaleX: 0.4,
            scaleY: 0.4,
            duration: Phaser.Math.Between(180, 260),
            ease: "Quad.easeOut",
            onComplete: () => {
              this.cleanupFireworkObject(trail);
            },
          });
        }
      },
      onComplete: () => {
        this.cleanupFireworkObject(rocket);
        this.cleanupFireworkObject(glow);
        this.createFireworkBurst(targetX, config.peakY, config);

        if (config.doubleBurst) {
          this.scheduleFirework(140, () => {
            this.createFireworkBurst(targetX + Phaser.Math.Between(-16, 16), config.peakY + 8, {
              ...config,
              particleCount: Math.max(20, Math.round(config.particleCount * 0.62)),
              radius: Math.round(config.radius * 0.72),
              ringBurst: false,
              doubleBurst: false,
            });
          });
        }
      },
    });
  }

  private createFireworkBurst(x: number, y: number, config: FireworkLaunchConfig) {
    const flash = this.trackFireworkObject(
      this.add
        .circle(x, y, 7, 0xffefbd, 0.54)
        .setDepth(15.3)
        .setBlendMode(Phaser.BlendModes.ADD),
    );

    this.tweens.add({
      targets: flash,
      scaleX: 2.4,
      scaleY: 2.4,
      alpha: 0,
      duration: 220,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.cleanupFireworkObject(flash);
      },
    });

    for (let index = 0; index < config.particleCount; index += 1) {
      const angle = (Math.PI * 2 * index) / config.particleCount + Phaser.Math.FloatBetween(-0.12, 0.12);
      const distance = Phaser.Math.Between(
        Math.round(config.radius * 0.45),
        config.radius,
      );
      const color = config.colors[index % config.colors.length];
      const spark = this.trackFireworkObject(
        this.add
          .circle(x, y, Phaser.Math.Between(1, 3), color, 1)
          .setDepth(15.15)
          .setBlendMode(Phaser.BlendModes.ADD),
      );

      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance + Phaser.Math.Between(8, 24),
        alpha: 0,
        scaleX: 0.25,
        scaleY: 0.25,
        duration: Phaser.Math.Between(620, 980),
        ease: "Cubic.easeOut",
        onComplete: () => {
          this.cleanupFireworkObject(spark);
        },
      });
    }

    if (config.ringBurst) {
      const ringCount = 26;
      for (let index = 0; index < ringCount; index += 1) {
        const angle = (Math.PI * 2 * index) / ringCount;
        const ringSpark = this.trackFireworkObject(
          this.add
            .circle(x, y, 1.4, 0xfff4be, 0.95)
            .setDepth(15.05)
            .setBlendMode(Phaser.BlendModes.ADD),
        );

        this.tweens.add({
          targets: ringSpark,
          x: x + Math.cos(angle) * (config.radius + 18),
          y: y + Math.sin(angle) * (config.radius + 18),
          alpha: 0,
          duration: 720,
          ease: "Sine.easeOut",
          onComplete: () => {
            this.cleanupFireworkObject(ringSpark);
          },
        });
      }
    }
  }

  private trackFireworkObject<T extends Phaser.GameObjects.GameObject>(object: T) {
    this.fireworkObjects.push(object);
    return object;
  }

  private cleanupFireworkObject(object: Phaser.GameObjects.GameObject) {
    object.destroy();
    this.fireworkObjects = this.fireworkObjects.filter((item) => item !== object);
  }

  private tryMovePlayer(deltaX: number, deltaY: number) {
    if (!this.player) {
      return;
    }

    if (deltaX === 0 && deltaY === 0) {
      return;
    }

    const nextX = this.player.x + deltaX;
    const nextY = this.player.y + deltaY;
    const nextHitbox = this.getPlayerHitbox(nextX, nextY);

    if (!this.isInsideWorldBounds(nextHitbox)) {
      return;
    }

    const blocked = this.collisionRects.some((rect) =>
      Phaser.Geom.Intersects.RectangleToRectangle(nextHitbox, rect),
    );
    if (blocked) {
      return;
    }

    this.player.setPosition(nextX, nextY);
  }

  private getPlayerHitbox(nextX: number, nextY: number) {
    return new Phaser.Geom.Rectangle(
      nextX - playerHitboxSize.width / 2,
      nextY - 16,
      playerHitboxSize.width,
      playerHitboxSize.height,
    );
  }

  private isInsideWorldBounds(hitbox: Phaser.Geom.Rectangle) {
    const left = hitbox.x;
    const right = hitbox.x + hitbox.width;
    const top = hitbox.y;
    const bottom = hitbox.y + hitbox.height;

    return left >= 18 && right <= 942 && top >= 100 && bottom <= 528;
  }

  private updateActiveTarget() {
    if (!this.player) {
      this.activeTarget = null;
      return;
    }

    const playerHitbox = this.getPlayerHitbox(this.player.x, this.player.y);
    let nearestActive: { target: MapTarget; distance: number } | null = null;

    for (const entrance of this.entrances) {
      const isActive = Phaser.Geom.Intersects.RectangleToRectangle(
        playerHitbox,
        entrance.triggerRect,
      );

      if (isActive) {
        const distance = Phaser.Math.Distance.Between(
          this.player!.x,
          this.player!.y,
          entrance.centerX,
          entrance.centerY,
        );

        if (!nearestActive || distance < nearestActive.distance) {
          nearestActive = { target: entrance.target, distance };
        }
      }

      this.applyEntranceStyle(entrance, isActive);
    }

    this.activeTarget = nearestActive ? nearestActive.target : null;
  }

  private getNearbyEntranceTarget(maxDistance: number) {
    if (!this.player) {
      return null;
    }

    let bestTarget: MapTarget | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    this.entrances.forEach((entrance) => {
      if (entrance.target !== "festival") {
        return;
      }

      if (!this.canEnterTarget(entrance.target)) {
        return;
      }

      const distance = Phaser.Math.Distance.Between(
        this.player!.x,
        this.player!.y,
        entrance.centerX,
        entrance.centerY,
      );

      const allowedDistance = Math.min(maxDistance, 72);

      if (distance <= allowedDistance && distance < bestDistance) {
        bestDistance = distance;
        bestTarget = entrance.target;
      }
    });

    return bestTarget;
  }

  private canEnterTarget(target: MapTarget) {
    if (target !== "festival") {
      return true;
    }

    if (!this.locationStatus.festivalUnlocked) {
      return false;
    }

    if (
      this.festivalMode === "prelude" ||
      this.festivalMode === "celebrating" ||
      this.festivalMode === "settled"
    ) {
      return false;
    }

    return true;
  }

  private applyEntranceStyle(entrance: BuildingEntrance, isActive: boolean) {
    void isActive;
    entrance.aura.setAlpha(0);
    entrance.aura.setVisible(false);
    entrance.doorPad.setAlpha(0);
    entrance.signPlate.setAlpha(0);
    entrance.signText.setAlpha(0);
    entrance.keyHintPlate.setAlpha(0);
    entrance.keyHintText.setAlpha(0);

    const showFestivalMarker =
      entrance.target !== "festival" || this.locationStatus.festivalUnlocked;

    if (!showFestivalMarker) {
      entrance.markerDot.setAlpha(0);
      entrance.markerLabel.setAlpha(0);
      return;
    }

    const idleDotAlpha = entrance.target === "festival" ? 0.42 : 0.56;
    const idleLabelAlpha = entrance.target === "festival" ? 0.68 : 0.74;
    entrance.markerDot.setAlpha(isActive ? 0.92 : idleDotAlpha);
    entrance.markerDot.setScale(isActive ? 1.22 : 1);
    entrance.markerLabel.setAlpha(isActive ? 0.98 : idleLabelAlpha);
    entrance.markerLabel.setScale(isActive ? 1.04 : 1);
  }

  private refreshEntranceDecor() {
    this.entrances.forEach((entrance) => {
      const label = this.getEntranceLabel(entrance.target);
      const isFestivalLocked =
        entrance.target === "festival" && !this.locationStatus.festivalUnlocked;

      entrance.signText.setText(label);
      entrance.signText.setColor(isFestivalLocked ? "#b6bec2" : "#f7edcf");
      entrance.signText.setAlpha(isFestivalLocked ? 0.72 : 1);
    });

    if (!this.progressText) {
      return;
    }

    if (this.locationStatus.festivalSeen) {
      const chestStatus = this.locationStatus.fishingChestEligible
        ? this.locationStatus.reservoirChestOpened
          ? "水库宝箱：已开启"
          : "水库宝箱：待开启"
        : "水库宝箱：未触发";
      this.progressText.setText(`金币：${this.locationStatus.playerCoins}\n${chestStatus}`);
      return;
    }

    if (this.locationStatus.festivalUnlocked) {
      this.progressText.setText(`金币：${this.locationStatus.playerCoins}\n广场晚会：已解锁`);
      return;
    }

    this.progressText.setText(`金币：${this.locationStatus.playerCoins}`);
  }

  private getEntranceLabel(target: MapTarget) {
    if (target === "shrimp") {
      return this.locationStatus.shrimpCompleted ? "市场 已完成" : "市场 进入";
    }

    if (target === "catan") {
      return this.locationStatus.catanCompleted ? "小岛 已完成" : "小岛 进入";
    }

    if (!this.locationStatus.festivalUnlocked) {
      return "广场 未解锁";
    }

    if (this.locationStatus.festivalSeen) {
      return "广场 回味晚会";
    }

    return "广场 开始晚会";
  }

  private updatePrompt() {
    if (!this.statusText) {
      return;
    }

    if (
      this.festivalMode === "prelude" ||
      this.festivalMode === "celebrating" ||
      this.festivalMode === "settled"
    ) {
      if (this.festivalGiftOpened) {
        if (this.festivalMode !== "settled" || !this.canShowReservoirChest()) {
          this.statusText.setText(mapSceneContent.festivalGiftOpenedPrompt);
          return;
        }
      }

      if (this.canOpenFestivalGift()) {
        this.statusText.setText(mapSceneContent.festivalGiftPrompt);
        return;
      }

      if (this.festivalMode === "celebrating" || this.festivalMode === "settled") {
        if (this.festivalMode === "settled" && this.canShowReservoirChest()) {
          if (this.canOpenReservoirChest()) {
            this.statusText.setText(mapSceneContent.reservoirChestOpenPrompt);
            return;
          }

          this.statusText.setText(
            this.locationStatus.reservoirChestOpened
              ? mapSceneContent.reservoirChestOpenedPrompt
              : mapSceneContent.reservoirChestLocatePrompt,
          );
          return;
        }

        this.statusText.setText(mapSceneContent.festivalGiftLocatePrompt);
        return;
      }

      this.statusText.setText(mapSceneContent.festivalCelebratingPrompt);
      return;
    }

    if (!this.activeTarget) {
      if (this.locationStatus.festivalSeen) {
        if (this.canShowReservoirChest()) {
          if (this.canOpenReservoirChest()) {
            this.statusText.setText(mapSceneContent.reservoirChestOpenPrompt);
            return;
          }

          this.statusText.setText(
            this.locationStatus.reservoirChestOpened
              ? mapSceneContent.reservoirChestOpenedPrompt
              : mapSceneContent.reservoirChestLocatePrompt,
          );
          return;
        }

        this.statusText.setText(mapSceneContent.festivalCompletedPrompt);
        return;
      }

      if (this.locationStatus.festivalUnlocked) {
        this.statusText.setText(mapSceneContent.festivalReadyPrompt);
        return;
      }

      this.statusText.setText(mapSceneContent.idlePrompt);
      return;
    }

    if (this.activeTarget === "festival") {
      if (!this.locationStatus.festivalUnlocked) {
        this.statusText.setText(mapSceneContent.festivalLockedPrompt);
        return;
      }

      if (this.locationStatus.festivalSeen) {
        this.statusText.setText(mapSceneContent.festivalCompletedPrompt);
        return;
      }

      this.statusText.setText(mapSceneContent.festivalReadyPrompt);
      return;
    }

    this.statusText.setText(mapSceneContent.prompts[this.activeTarget]);
  }

  private getLocationMeta(target: MapTarget) {
    const locationIdByTarget: Record<MapTarget, (typeof mapLocations)[number]["id"]> = {
      shrimp: "shrimp",
      catan: "catan",
      festival: "festival",
    };
    const fallback: Record<MapTarget, { title: string; subtitle: string }> = {
      shrimp: {
        title: "市场",
        subtitle: "去钓鱼",
      },
      catan: {
        title: "小岛",
        subtitle: "卡坦对局",
      },
      festival: {
        title: "广场",
        subtitle: "生日彩蛋",
      },
    };

    const meta = mapLocations.find(
      (location) => location.id === locationIdByTarget[target],
    );

    return {
      title: meta?.title ?? fallback[target].title,
      subtitle: meta?.subtitle ?? fallback[target].subtitle,
    };
  }

  private transitionAlpha(
    target:
      | (Phaser.GameObjects.GameObject & {
          alpha: number;
          setAlpha: (value: number) => unknown;
        })
      | undefined,
    alpha: number,
    immediate: boolean,
    duration: number,
  ) {
    if (!target) {
      return;
    }

    this.tweens.killTweensOf(target);

    if (immediate) {
      target.setAlpha(alpha);
      return;
    }

    this.tweens.add({
      targets: target,
      alpha,
      duration,
      ease: "Sine.easeOut",
    });
  }

  private transitionScale(
    target:
      | (Phaser.GameObjects.GameObject & {
          scaleX: number;
          scaleY: number;
          setScale: (x: number, y?: number) => unknown;
        })
      | undefined,
    scale: number,
    immediate: boolean,
    duration: number,
  ) {
    if (!target) {
      return;
    }

    this.tweens.killTweensOf(target);

    if (immediate) {
      target.setScale(scale);
      return;
    }

    this.tweens.add({
      targets: target,
      scaleX: scale,
      scaleY: scale,
      duration,
      ease: "Sine.easeOut",
    });
  }

  private renderFatalError(title: string, error: unknown) {
    if (this.fatalErrorShown) {
      return;
    }

    this.fatalErrorShown = true;
    const message = error instanceof Error ? error.message : String(error);

    this.cameras.main.setBackgroundColor("#111d26");
    this.add.rectangle(480, 270, 960, 540, 0x0f1c24, 1);
    this.add.rectangle(480, 270, 760, 260, 0x1b2d38, 0.96).setStrokeStyle(2, 0xf38b6b);
    this.add.text(480, 214, title, {
      fontFamily: "Trebuchet MS",
      fontSize: "28px",
      color: "#f8f2dc",
    }).setOrigin(0.5);
    this.add.text(480, 280, message, {
      fontFamily: "Trebuchet MS",
      fontSize: "16px",
      color: "#ffd3c3",
      align: "center",
      wordWrap: { width: 660 },
    }).setOrigin(0.5);
    this.add.text(480, 340, "把这句报错发给我，我继续精准修。", {
      fontFamily: "Trebuchet MS",
      fontSize: "14px",
      color: "#d6e9cf",
    }).setOrigin(0.5);
  }

  private resolveTextureKey(
    sourceKey: string,
    fallbackColor: number,
    fallbackWidth: number,
    fallbackHeight: number,
  ) {
    if (this.canRenderTexture(sourceKey)) {
      return sourceKey;
    }

    if (!this.textureFallbackReported.has(sourceKey)) {
      this.textureFallbackReported.add(sourceKey);
      this.bus.events.emit("system/error", {
        source: "map/texture",
        message: `贴图不可用，已启用降级纹理：${sourceKey}`,
        code: "map_texture_fallback",
      });
    }

    const fallbackKey = `fallback:${sourceKey}`;
    if (!this.textures.exists(fallbackKey)) {
      const graphics = this.add.graphics({ x: 0, y: 0 });
      graphics.setVisible(false);
      graphics.fillStyle(fallbackColor, 1);
      graphics.fillRect(0, 0, fallbackWidth, fallbackHeight);
      graphics.lineStyle(2, 0x111d26, 0.38);
      graphics.strokeRect(0, 0, fallbackWidth, fallbackHeight);
      graphics.generateTexture(fallbackKey, fallbackWidth, fallbackHeight);
      graphics.destroy();
    }

    return fallbackKey;
  }

  private canRenderTexture(textureKey: string) {
    if (!this.textures.exists(textureKey)) {
      return false;
    }

    const texture = this.textures.get(textureKey);
    if (!texture) {
      return false;
    }

    const source = texture.getSourceImage() as
      | HTMLImageElement
      | HTMLCanvasElement
      | HTMLVideoElement
      | null
      | undefined;
    if (!source) {
      return false;
    }

    const width =
      "naturalWidth" in source && typeof source.naturalWidth === "number"
        ? source.naturalWidth
        : source.width;
    const height =
      "naturalHeight" in source && typeof source.naturalHeight === "number"
        ? source.naturalHeight
        : source.height;

    return width > 0 && height > 0;
  }
}
