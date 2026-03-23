import Phaser from "phaser";
import type { EventBus } from "../../../bus/createEventBus";
import { sceneKeys } from "../../../phaser/sceneKeys";
import { mapSceneContent, mapLocations } from "../config/content";

type LocationZone = {
  target: "shrimp" | "catan" | "festival";
  label: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  ring: Phaser.GameObjects.Rectangle;
};

export class MapScene extends Phaser.Scene {
  private readonly bus: EventBus;

  private player?: Phaser.GameObjects.Rectangle;
  private cursorKeys?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys?: Record<"W" | "A" | "S" | "D" | "E", Phaser.Input.Keyboard.Key>;
  private locations: LocationZone[] = [];
  private locationStatus = {
    shrimpCompleted: false,
    catanCompleted: false,
    festivalUnlocked: false,
  };
  private activeTarget: LocationZone["target"] | null = null;
  private statusText?: Phaser.GameObjects.Text;
  private cleanupFns: Array<() => void> = [];

  constructor(bus: EventBus) {
    super(sceneKeys.map);
    this.bus = bus;
  }

  create() {
    this.cameras.main.setBackgroundColor("#173f4d");
    this.add.rectangle(480, 270, 960, 540, 0x173f4d).setStrokeStyle(4, 0xa0d39d);
    this.add.text(40, 24, mapSceneContent.title, {
      fontSize: "26px",
      color: "#f9edc9",
      fontFamily: "Trebuchet MS",
    });
    this.add.text(40, 58, mapSceneContent.subtitle, {
      fontSize: "16px",
      color: "#d8f3d3",
      fontFamily: "Trebuchet MS",
    });

    this.player = this.add.rectangle(110, 420, 28, 28, 0xffd67d);
    this.physics.add.existing(this.player);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);

    this.cursorKeys = this.input.keyboard?.createCursorKeys();
    this.wasdKeys = this.input.keyboard?.addKeys("W,A,S,D,E") as Record<
      "W" | "A" | "S" | "D" | "E",
      Phaser.Input.Keyboard.Key
    >;

    this.locations = this.createLocations();
    this.statusText = this.add.text(40, 498, mapSceneContent.idlePrompt, {
      fontSize: "18px",
      color: "#f9edc9",
      fontFamily: "Trebuchet MS",
    });

    this.cleanupFns.push(
      this.bus.commands.subscribe("map/show-state", (payload) => {
        this.locationStatus = payload;
        this.refreshLocationDecor();
      }),
    );

  }

  update() {
    if (!this.player || !this.cursorKeys || !this.wasdKeys) {
      return;
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0);

    const speed = 180;
    if (this.cursorKeys.left.isDown || this.wasdKeys.A.isDown) {
      body.setVelocityX(-speed);
    } else if (this.cursorKeys.right.isDown || this.wasdKeys.D.isDown) {
      body.setVelocityX(speed);
    }

    if (this.cursorKeys.up.isDown || this.wasdKeys.W.isDown) {
      body.setVelocityY(-speed);
    } else if (this.cursorKeys.down.isDown || this.wasdKeys.S.isDown) {
      body.setVelocityY(speed);
    }

    this.activeTarget = null;

    this.locations.forEach((location) => {
      const isActive = Phaser.Geom.Intersects.RectangleToRectangle(
        this.player!.getBounds(),
        location.zone.getBounds(),
      );

      location.ring.setStrokeStyle(3, isActive ? 0xfff6b4 : 0x6ec28a);

      if (isActive) {
        this.activeTarget = location.target;
      }
    });

    if (this.activeTarget && Phaser.Input.Keyboard.JustDown(this.wasdKeys.E)) {
      this.bus.events.emit("map/enter-request", { target: this.activeTarget });
    }

    this.updatePrompt();
  }

  shutdown() {
    this.cleanupFns.forEach((cleanup) => cleanup());
    this.cleanupFns = [];
  }

  private createLocations() {
    const marketMeta = mapLocations.find((location) => location.id === "shrimp");
    const islandMeta = mapLocations.find((location) => location.id === "catan");
    const squareMeta = mapLocations.find((location) => location.id === "festival");
    const market = this.createLocation(
      210,
      210,
      marketMeta?.title ?? "市场",
      marketMeta?.subtitle ?? "钓虾",
      "shrimp",
    );
    const island = this.createLocation(
      540,
      150,
      islandMeta?.title ?? "小岛",
      islandMeta?.subtitle ?? "卡坦",
      "catan",
    );
    const square = this.createLocation(
      760,
      330,
      squareMeta?.title ?? "广场",
      squareMeta?.subtitle ?? "宴会",
      "festival",
    );

    this.refreshLocationDecor();

    return [market, island, square];
  }

  private createLocation(
    x: number,
    y: number,
    title: string,
    subtitle: string,
    target: LocationZone["target"],
  ) {
    const ring = this.add.rectangle(x, y, 130, 110, 0x29515d, 0.85);
    ring.setStrokeStyle(3, 0x6ec28a);

    const label = this.add.text(x, y, `${title}\n${subtitle}`, {
      align: "center",
      fontSize: "22px",
      color: "#f8f2dc",
      fontFamily: "Trebuchet MS",
    });
    label.setOrigin(0.5);

    const zone = this.add.zone(x, y, 140, 120);
    zone.setOrigin(0.5);

    return {
      target,
      label,
      zone,
      ring,
    };
  }

  private refreshLocationDecor() {
    this.locations.forEach((location) => {
      if (location.target === "festival" && !this.locationStatus.festivalUnlocked) {
        location.ring.fillColor = 0x31414b;
        location.label.setAlpha(0.5);
      } else {
        location.ring.fillColor = 0x29515d;
        location.label.setAlpha(1);
      }

      if (location.target === "shrimp" && this.locationStatus.shrimpCompleted) {
        location.label.setText(mapSceneContent.labels.shrimpCompleted);
      }
    });
  }

  private updatePrompt() {
    if (!this.statusText) {
      return;
    }

    if (!this.activeTarget) {
      this.statusText.setText(mapSceneContent.idlePrompt);
      return;
    }

    if (this.activeTarget === "festival" && !this.locationStatus.festivalUnlocked) {
      this.statusText.setText(mapSceneContent.festivalLockedPrompt);
      return;
    }

    this.statusText.setText(mapSceneContent.prompts[this.activeTarget]);
  }
}
