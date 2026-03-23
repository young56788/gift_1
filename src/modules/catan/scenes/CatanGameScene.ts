import Phaser from "phaser";
import type { EventBus } from "../../../bus/createEventBus";
import { sceneKeys } from "../../../phaser/sceneKeys";
import { BOARD_VIEWBOX_HEIGHT, BOARD_VIEWBOX_WIDTH, fixedBoardGraph } from "../boardGraph";
import type { CatanMatchSnapshot } from "../engineTypes";

const ownerColors = {
  player: 0xffd67a,
  leah: 0x80d0a8,
  sam: 0xf38b6b,
} as const;

const BOARD_SCALE = 0.58;
const BOARD_ORIGIN_X = (960 - BOARD_VIEWBOX_WIDTH * BOARD_SCALE) / 2;
const BOARD_ORIGIN_Y = (540 - BOARD_VIEWBOX_HEIGHT * BOARD_SCALE) / 2;
const BOARD_ALIGNMENT_OFFSET_Y = -12;
const SOURCE_HEX_RADIUS = 70;

export class CatanGameScene extends Phaser.Scene {
  private readonly bus: EventBus;
  private cleanupFns: Array<() => void> = [];
  private errorText?: Phaser.GameObjects.Text;
  private noticeText?: Phaser.GameObjects.Text;
  private boardTextureFailed = false;
  private boardTextureError = "";
  private previousSnapshot: CatanMatchSnapshot | null = null;
  private tileOverlays: Phaser.GameObjects.Polygon[] = [];
  private tileZones: Phaser.GameObjects.Zone[] = [];
  private edgeRoads: Phaser.GameObjects.Rectangle[] = [];
  private edgeZones: Phaser.GameObjects.Zone[] = [];
  private nodeSlots: Phaser.GameObjects.Arc[] = [];
  private nodeStructures: Phaser.GameObjects.Container[] = [];
  private nodeZones: Phaser.GameObjects.Zone[] = [];
  private robberMarker?: Phaser.GameObjects.Container;

  constructor(bus: EventBus) {
    super(sceneKeys.catan);
    this.bus = bus;
  }

  preload() {
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      if (file.key !== "catan-board-reference") {
        return;
      }

      this.boardTextureFailed = true;
      this.boardTextureError = `棋盘底图加载失败: ${file.src ?? file.url ?? file.key}`;
    });

    if (!this.textures.exists("catan-board-reference")) {
      this.load.svg("catan-board-reference", "/catan-board-reference.svg");
    }
  }

  create() {
    try {
      this.cameras.main.setBackgroundColor("#10222d");
      this.add.rectangle(480, 270, 960, 540, 0x0f1c24);
      this.add.rectangle(480, 270, 940, 520, 0x122630, 0.94).setStrokeStyle(2, 0x385e65);
      this.renderBoardBackground();
      this.errorText = this.add.text(20, 500, "", {
        fontFamily: "Trebuchet MS",
        fontSize: "13px",
        color: "#ffb8a3",
        wordWrap: { width: 920 },
      });
      this.noticeText = this.add.text(20, 24, "", {
        fontFamily: "Trebuchet MS",
        fontSize: "16px",
        color: "#f8f2dc",
        backgroundColor: "#173431cc",
        padding: { x: 8, y: 4 },
      }).setAlpha(0);

      fixedBoardGraph.tiles.forEach((tile) => {
        const { x, y } = this.projectPoint(tile.x, tile.y);
        const overlay = this.add.polygon(x, y, this.createHexPoints(SOURCE_HEX_RADIUS * BOARD_SCALE), 0xffffff, 0);
        overlay.setStrokeStyle(0, 0xffffff, 0);
        this.tileOverlays.push(overlay);

        const hitRadius = SOURCE_HEX_RADIUS * BOARD_SCALE * 0.9;
        const hitAreaSize = hitRadius * 2 + 8;
        const zone = this.add.zone(x, y, hitAreaSize, hitAreaSize);
        zone.setOrigin(0.5);
        zone.setDataEnabled();
        zone.data?.set("tileId", tile.id);
        this.tileZones.push(zone);
      });

      const robberCircle = this.add.circle(0, 0, 11, 0x1f2937, 0.92);
      robberCircle.setStrokeStyle(2, 0xf8f2dc, 0.9);
      const robberText = this.add.text(0, 0, "盗", {
        fontFamily: "Trebuchet MS",
        fontSize: "12px",
        color: "#f8f2dc",
      }).setOrigin(0.5);
      this.robberMarker = this.add.container(0, 0, [robberCircle, robberText]);

      fixedBoardGraph.edges.forEach((edge) => {
        const left = this.projectPoint(
          fixedBoardGraph.nodes[edge.nodeIds[0]].x,
          fixedBoardGraph.nodes[edge.nodeIds[0]].y,
        );
        const right = this.projectPoint(
          fixedBoardGraph.nodes[edge.nodeIds[1]].x,
          fixedBoardGraph.nodes[edge.nodeIds[1]].y,
        );
        const road = this.add.rectangle(
          (left.x + right.x) / 2,
          (left.y + right.y) / 2,
          Math.max(Phaser.Math.Distance.Between(left.x, left.y, right.x, right.y) - 14, 22),
          8,
          0x2f4f5b,
          0.24,
        );
        road.setRotation(Phaser.Math.Angle.Between(left.x, left.y, right.x, right.y));
        road.setStrokeStyle(1, 0xe9e2c8, 0.18);
        this.edgeRoads.push(road);

        const zone = this.add.zone(
          (left.x + right.x) / 2,
          (left.y + right.y) / 2,
          Math.max(Math.abs(right.x - left.x) + 28, 22),
          Math.max(Math.abs(right.y - left.y) + 28, 22),
        );
        zone.setDataEnabled();
        zone.data?.set("helper", `可建道路 · 连接节点 ${edge.nodeIds[0]} 和 ${edge.nodeIds[1]}`);
        this.edgeZones.push(zone);
      });

      fixedBoardGraph.nodes.forEach((node) => {
        const point = this.projectPoint(node.x, node.y);
        const slot = this.add.circle(point.x, point.y, 6, 0x28424b, 0.28);
        slot.setStrokeStyle(1, 0xe9e2c8, 0.22);
        this.nodeSlots.push(slot);

        const structure = this.add.container(point.x, point.y);
        this.nodeStructures.push(structure);

        const zone = this.add.zone(point.x, point.y, 28, 28);
        zone.setDataEnabled();
        zone.data?.set("helper", `节点 ${node.id}`);
        this.nodeZones.push(zone);
      });

      this.cleanupFns.push(
        this.bus.commands.subscribe("catan/rebuild-show-state", (payload) => {
          this.applySnapshot(payload);
        }),
      );

      this.events.on(Phaser.Scenes.Events.WAKE, this.handleWake, this);
      this.events.on(Phaser.Scenes.Events.SLEEP, this.handleSleep, this);
      this.bus.events.emit("catan/rebuild-request-state", undefined);
    } catch (error) {
      this.renderFatalError(error);
    }
  }

  shutdown() {
    this.cleanupFns.forEach((cleanup) => cleanup());
    this.cleanupFns = [];
    this.events.off(Phaser.Scenes.Events.WAKE, this.handleWake, this);
    this.events.off(Phaser.Scenes.Events.SLEEP, this.handleSleep, this);
  }

  private handleWake() {
    this.bus.events.emit("catan/rebuild-request-state", undefined);
  }

  private handleSleep() {
    this.input.setDefaultCursor("default");
  }

  private applySnapshot(snapshot: CatanMatchSnapshot) {
    try {
      const previousSnapshot = this.previousSnapshot;
      this.errorText?.setText(this.boardTextureFailed ? this.boardTextureError : "");

      this.tileOverlays.forEach((tile, tileId) => {
        const canMoveRobber = snapshot.availableRobberTileIds.includes(tileId);
        tile.setStrokeStyle(
          canMoveRobber ? 4 : 0,
          0xffd67a,
          canMoveRobber ? 1 : 0,
        );
        tile.setFillStyle(0xffd67a, canMoveRobber ? 0.12 : 0);
        tile.setAlpha(canMoveRobber ? 1 : 0);
      });

      const robberTile = fixedBoardGraph.tiles[snapshot.robberTileId];

      if (this.robberMarker && robberTile) {
        const robberPoint = this.projectPoint(robberTile.x, robberTile.y + 20);
        this.robberMarker.setPosition(robberPoint.x, robberPoint.y);
        this.robberMarker.setAlpha(snapshot.availableRobberTileIds.length > 0 ? 0.72 : 1);
      }
      this.edgeRoads.forEach((road, edgeId) => {
        const owner = snapshot.occupiedEdges[edgeId];
        const isBuildable = snapshot.availableRoadEdges.includes(edgeId);
        if (owner) {
          road.setFillStyle(ownerColors[owner], 1);
          road.setStrokeStyle(0, 0, 0);
          road.setAlpha(1);
          return;
        }

        road.setFillStyle(0x2f4f5b, 0.24);
        road.setStrokeStyle(isBuildable ? 2 : 1, isBuildable ? 0xfff3c8 : 0xe9e2c8, isBuildable ? 0.82 : 0.18);
        road.setAlpha(isBuildable ? 0.68 : 0.34);
      });

      this.nodeSlots.forEach((slot, nodeId) => {
        const occupant = snapshot.occupiedNodes[nodeId];
        const canSettlement = snapshot.availableSettlementNodes.includes(nodeId);
        const canCity = snapshot.availableCityNodes.includes(nodeId);
        const active = Boolean(canSettlement || canCity);
        const isSetupPendingNode =
          snapshot.phase === "setup-road" && snapshot.setupPendingNodeId === nodeId;

        slot.setFillStyle(0x28424b, occupant ? 0 : 0.28);
        slot.setStrokeStyle(active ? 2 : 1, active ? 0xfff3c8 : 0xe9e2c8, active ? 0.82 : 0.22);
        slot.setAlpha(occupant ? 0 : active ? 0.8 : 0.42);

        const structure = this.nodeStructures[nodeId];
        structure.removeAll(true);

        if (occupant) {
          if (isSetupPendingNode) {
            const confirm = this.add.circle(0, 0, 10, 0xffd67a, 0.28);
            confirm.setStrokeStyle(3, 0xfff3c8, 1);
            structure.add(confirm);
            structure.setAlpha(1);
            slot.setAlpha(0);
            return;
          }

          structure.add(this.createBuildingMarker(occupant.owner, occupant.level === "city"));
          structure.setAlpha(1);
          return;
        }

        structure.setAlpha(0);
      });

      this.refreshInteractions(snapshot);
      this.animateSnapshotFeedback(previousSnapshot, snapshot);
      this.previousSnapshot = snapshot;
    } catch (error) {
      this.renderFatalError(error);
    }
  }

  private refreshInteractions(snapshot: CatanMatchSnapshot) {
    this.edgeZones.forEach((zone, edgeId) => {
      zone.disableInteractive();
      zone.removeAllListeners();

      if (!snapshot.availableRoadEdges.includes(edgeId)) {
        return;
      }

      zone.setInteractive({ cursor: "pointer" });
      zone.on("pointerdown", () => {
        this.bus.events.emit("catan/rebuild-intent-selected", {
          intent: { type: "build-road", edgeId },
        });
      });
    });

    this.nodeZones.forEach((zone, nodeId) => {
      zone.disableInteractive();
      zone.removeAllListeners();

      if (snapshot.availableSettlementNodes.includes(nodeId)) {
        zone.setInteractive({ cursor: "pointer" });
        zone.on("pointerdown", () => {
          this.bus.events.emit("catan/rebuild-intent-selected", {
            intent: { type: "build-settlement", nodeId },
          });
        });
        return;
      }

      if (snapshot.availableCityNodes.includes(nodeId)) {
        zone.setInteractive({ cursor: "pointer" });
        zone.on("pointerdown", () => {
          this.bus.events.emit("catan/rebuild-intent-selected", {
            intent: { type: "upgrade-city", nodeId },
          });
        });
      }
    });

      this.tileZones.forEach((zone, tileId) => {
        zone.disableInteractive();
        zone.removeAllListeners();

        if (!snapshot.availableRobberTileIds.includes(tileId)) {
          return;
        }

        const radius = SOURCE_HEX_RADIUS * BOARD_SCALE * 0.9;
        const points = this.createHexPoints(radius).reduce((accumulator, value, index, source) => {
          if (index % 2 === 0) {
            accumulator.push({
              x: value + radius + 4,
              y: source[index + 1]! + radius + 4,
            });
          }

          return accumulator;
        }, [] as Array<{ x: number; y: number }>);

        zone.setInteractive(
          new Phaser.Geom.Polygon(points),
          Phaser.Geom.Polygon.Contains,
        );
        zone.on("pointerdown", () => {
          this.bus.events.emit("catan/rebuild-intent-selected", {
            intent: { type: "move-robber", tileId },
          });
        });
      });
  }

  private projectPoint(x: number, y: number) {
    return {
      x: BOARD_ORIGIN_X + x * BOARD_SCALE,
      y: BOARD_ORIGIN_Y + y * BOARD_SCALE + BOARD_ALIGNMENT_OFFSET_Y,
    };
  }

  private createHexPoints(radius: number) {
    const points: number[] = [];

    for (let index = 0; index < 6; index += 1) {
      const angle = Phaser.Math.DegToRad(60 * index - 90);
      points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }

    return points;
  }

  private createBuildingMarker(owner: keyof typeof ownerColors, isCity: boolean) {
    const tint = ownerColors[owner];
    const marker = this.add.circle(0, 0, isCity ? 12 : 9, tint, 1);
    marker.setStrokeStyle(isCity ? 3 : 2, isCity ? 0xffffff : 0x173431, 0.9);
    return [marker];
  }

  private renderBoardBackground() {
    if (this.textures.exists("catan-board-reference")) {
      this.add.image(BOARD_ORIGIN_X, BOARD_ORIGIN_Y, "catan-board-reference").setOrigin(0).setScale(BOARD_SCALE);
      return;
    }

    this.boardTextureFailed = true;

    if (!this.boardTextureError) {
      this.boardTextureError = "棋盘底图没有加载成功，当前先用调试底板兜底。";
    }

    this.add.rectangle(480, 270, 520, 430, 0x204758, 0.92).setStrokeStyle(2, 0x9dc4b2);
  }

  private renderFatalError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    this.add.rectangle(480, 270, 960, 540, 0x10222d);
    this.add.rectangle(480, 270, 760, 280, 0x1c3240, 0.96).setStrokeStyle(2, 0xf38b6b);
    this.add.text(480, 214, "卡坦场景初始化失败", {
      fontFamily: "Trebuchet MS",
      fontSize: "28px",
      color: "#f8f2dc",
    }).setOrigin(0.5);
    this.add.text(480, 282, message, {
      fontFamily: "Trebuchet MS",
      fontSize: "16px",
      color: "#ffcfbf",
      align: "center",
      wordWrap: { width: 660 },
    }).setOrigin(0.5);
    this.add.text(480, 340, "现在至少不会整页卡死。把这句报错发给我，我继续修。", {
      fontFamily: "Trebuchet MS",
      fontSize: "14px",
      color: "#d6e9cf",
      align: "center",
      wordWrap: { width: 660 },
    }).setOrigin(0.5);
  }

  private animateSnapshotFeedback(previousSnapshot: CatanMatchSnapshot | null, snapshot: CatanMatchSnapshot) {
    if (!previousSnapshot) {
      return;
    }

    const latestLine = snapshot.latestLog[0] ?? "";
    const newRoad = this.findNewRoad(previousSnapshot, snapshot);
    const nodeChange = this.findNodeChange(previousSnapshot, snapshot);

    if (snapshot.dice && snapshot.dice.total !== previousSnapshot.dice?.total) {
      this.showNotice(`${snapshot.players[snapshot.activePlayerId].label} 的回合：掷出 ${snapshot.dice.total}`);
    }

    if (newRoad) {
      this.pulseSingleRoad(newRoad.edgeId, newRoad.owner);
      this.showNotice(`${snapshot.players[newRoad.owner].label} 修了一条路`);
    }

    if (nodeChange) {
      this.pulseSingleNode(nodeChange.nodeId, nodeChange.owner, nodeChange.level === "city");
      this.showNotice(
        nodeChange.level === "city"
          ? `${snapshot.players[nodeChange.owner].label} 升级了一座城市`
          : `${snapshot.players[nodeChange.owner].label} 落下了一个村庄`,
      );
    }

    if (latestLine.includes("打出了骑士卡")) {
      this.pulseRobberMarker();
      this.showNotice("骑士发动：选择一个地块放置强盗");
    }

    if (latestLine.includes("打出了丰收卡")) {
      this.flashResourceNodes(0xffd67a);
      this.showNotice(snapshot.latestLog[1] ?? "丰收发动");
    }

    if (snapshot.freeRoadBuildsRemaining > previousSnapshot.freeRoadBuildsRemaining) {
      this.pulseRoadChoices(snapshot.availableRoadEdges);
      this.showNotice("道路建设发动：可免费修路 2 次");
    }

    const longestRoadLine = snapshot.latestLog.find((line) => line.includes("道路王"));

    if (longestRoadLine) {
      const ownerId = this.findOwnerByLabel(snapshot, longestRoadLine);

      if (ownerId) {
        this.pulseOwnerRoadNetwork(snapshot, ownerId);
      }

      this.showNotice(longestRoadLine);
    }

    const victoryPointLine = snapshot.latestLog.find((line) => line.includes("得分卡"));

    if (victoryPointLine) {
      this.flashResourceNodes(0x9fd8ff);
      this.showNotice(victoryPointLine);
    }

    if (
      previousSnapshot.phase !== "robber" &&
      snapshot.phase === "robber" &&
      !latestLine.includes("打出了骑士卡")
    ) {
      this.pulseRobberMarker();
      this.showNotice("强盗触发：选择一个新地块");
    }
  }

  private pulseRobberMarker() {
    if (!this.robberMarker) {
      return;
    }

    this.tweens.killTweensOf(this.robberMarker);
    this.robberMarker.setScale(1);
    this.tweens.add({
      targets: this.robberMarker,
      scaleX: 1.26,
      scaleY: 1.26,
      alpha: 1,
      duration: 180,
      yoyo: true,
      repeat: 1,
      ease: "Sine.easeInOut",
    });
  }

  private pulseRoadChoices(edgeIds: number[]) {
    edgeIds.forEach((edgeId) => {
      const road = this.edgeRoads[edgeId];

      if (!road) {
        return;
      }

      this.tweens.killTweensOf(road);
      road.setScale(1);
      this.tweens.add({
        targets: road,
        scaleX: 1.14,
        scaleY: 1.14,
        alpha: 1,
        duration: 180,
        yoyo: true,
        repeat: 1,
        ease: "Sine.easeInOut",
      });
    });
  }

  private pulseSingleRoad(edgeId: number, owner: keyof typeof ownerColors) {
    const road = this.edgeRoads[edgeId];

    if (!road) {
      return;
    }

    road.setFillStyle(ownerColors[owner], 1);
    this.tweens.killTweensOf(road);
    road.setScale(1);
    this.tweens.add({
      targets: road,
      scaleX: 1.26,
      scaleY: 1.26,
      alpha: 1,
      duration: 240,
      yoyo: true,
      repeat: 2,
      ease: "Sine.easeInOut",
    });
  }

  private pulseOwnerRoadNetwork(snapshot: CatanMatchSnapshot, ownerId: keyof typeof ownerColors) {
    this.edgeRoads.forEach((road, edgeId) => {
      if (snapshot.occupiedEdges[edgeId] !== ownerId) {
        return;
      }

      this.tweens.killTweensOf(road);
      road.setScale(1);
      this.tweens.add({
        targets: road,
        scaleX: 1.18,
        scaleY: 1.18,
        alpha: 1,
        duration: 180,
        yoyo: true,
        repeat: 2,
        ease: "Sine.easeInOut",
      });
    });
  }

  private flashResourceNodes(color: number) {
    this.nodeSlots.forEach((slot) => {
      this.tweens.killTweensOf(slot);
      this.tweens.add({
        targets: slot,
        alpha: 0.95,
        duration: 150,
        yoyo: true,
        repeat: 1,
        ease: "Sine.easeInOut",
        onStart: () => {
          slot.setStrokeStyle(2, color, 0.9);
        },
        onComplete: () => {
          slot.setStrokeStyle(1, 0xe9e2c8, 0.22);
        },
      });
    });
  }

  private pulseSingleNode(nodeId: number, owner: keyof typeof ownerColors, isCity: boolean) {
    const slot = this.nodeSlots[nodeId];
    const structure = this.nodeStructures[nodeId];

    if (!slot || !structure) {
      return;
    }

    this.tweens.killTweensOf(slot);
    this.tweens.killTweensOf(structure);
    slot.setStrokeStyle(2, ownerColors[owner], 0.95);
    this.tweens.add({
      targets: slot,
      alpha: 0.96,
      duration: 180,
      yoyo: true,
      repeat: 1,
      ease: "Sine.easeInOut",
      onComplete: () => {
        slot.setStrokeStyle(1, 0xe9e2c8, 0.22);
      },
    });
    this.tweens.add({
      targets: structure,
      scaleX: isCity ? 1.2 : 1.16,
      scaleY: isCity ? 1.2 : 1.16,
      duration: 220,
      yoyo: true,
      repeat: 2,
      ease: "Sine.easeInOut",
      onStart: () => {
        structure.setAlpha(1);
      },
      onComplete: () => {
        structure.setScale(1);
      },
    });
  }

  private showNotice(text: string) {
    if (!this.noticeText) {
      return;
    }

    this.tweens.killTweensOf(this.noticeText);
    this.noticeText.setText(text);
    this.noticeText.setAlpha(0.96);
    this.tweens.add({
      targets: this.noticeText,
      alpha: 0,
      delay: 1200,
      duration: 420,
      ease: "Quad.easeOut",
    });
  }

  private findOwnerByLabel(snapshot: CatanMatchSnapshot, line: string) {
    const ownerId = (Object.keys(snapshot.players) as Array<keyof typeof snapshot.players>).find((playerId) => {
      return line.includes(snapshot.players[playerId].label);
    });

    return ownerId ? (ownerId as keyof typeof ownerColors) : null;
  }

  private findNewRoad(previousSnapshot: CatanMatchSnapshot, snapshot: CatanMatchSnapshot) {
    for (const edge of fixedBoardGraph.edges) {
      const owner = snapshot.occupiedEdges[edge.id];

      if (owner && previousSnapshot.occupiedEdges[edge.id] !== owner) {
        return { edgeId: edge.id, owner };
      }
    }

    return null;
  }

  private findNodeChange(previousSnapshot: CatanMatchSnapshot, snapshot: CatanMatchSnapshot) {
    for (const node of fixedBoardGraph.nodes) {
      const occupancy = snapshot.occupiedNodes[node.id];
      const previous = previousSnapshot.occupiedNodes[node.id];

      if (!occupancy) {
        continue;
      }

      if (!previous || previous.owner !== occupancy.owner || previous.level !== occupancy.level) {
        return { nodeId: node.id, owner: occupancy.owner, level: occupancy.level };
      }
    }

    return null;
  }
}
