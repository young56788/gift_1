import Phaser from "phaser";
import type { EventBus } from "../../../bus/createEventBus";
import { sceneKeys } from "../../../phaser/sceneKeys";
import { shrimpSceneContent, shrimpSceneTuning } from "../config/content";

export class ShrimpScene extends Phaser.Scene {
  private readonly bus: EventBus;

  private catchZone?: Phaser.GameObjects.Rectangle;
  private pointer?: Phaser.GameObjects.Rectangle;
  private infoText?: Phaser.GameObjects.Text;
  private resultText?: Phaser.GameObjects.Text;
  private zoneDirection = 1;
  private pointerDirection = 1;
  private resultLocked = false;

  constructor(bus: EventBus) {
    super(sceneKeys.shrimp);
    this.bus = bus;
  }

  create() {
    this.cameras.main.setBackgroundColor("#10304a");
    this.add.rectangle(480, 270, 960, 540, 0x10304a);
    this.add.text(40, 28, shrimpSceneContent.title, {
      fontSize: "28px",
      color: "#f6e4b3",
      fontFamily: "Trebuchet MS",
    });
    this.add.text(40, 64, shrimpSceneContent.subtitle, {
      fontSize: "18px",
      color: "#def2e1",
      fontFamily: "Trebuchet MS",
    });

    this.add.rectangle(480, 270, 640, 28, 0x2a3c50, 1).setStrokeStyle(2, 0x84d2f6);
    this.catchZone = this.add.rectangle(
      shrimpSceneTuning.catchZoneStartX,
      270,
      shrimpSceneTuning.catchZoneWidth,
      34,
      0xffcf70,
      0.9,
    );
    this.pointer = this.add.rectangle(
      shrimpSceneTuning.pointerStartX,
      270,
      16,
      48,
      0xf8f2dc,
      1,
    );
    this.infoText = this.add.text(40, 430, shrimpSceneContent.idleHint, {
      fontSize: "20px",
      color: "#f8f2dc",
      fontFamily: "Trebuchet MS",
    });
    this.resultText = this.add.text(40, 470, "", {
      fontSize: "18px",
      color: "#f6e4b3",
      fontFamily: "Trebuchet MS",
      wordWrap: {
        width: 840,
      },
    });

    this.input.keyboard?.on("keydown-SPACE", this.handleCatch, this);
    this.input.keyboard?.on("keydown-ESC", this.handleExit, this);

  }

  update(_time: number, delta: number) {
    if (!this.catchZone || !this.pointer || this.resultLocked) {
      return;
    }

    const zoneStep = shrimpSceneTuning.zoneSpeedPerMs * delta * this.zoneDirection;
    this.catchZone.x += zoneStep;

    if (
      this.catchZone.x >= shrimpSceneTuning.zoneBounds.max ||
      this.catchZone.x <= shrimpSceneTuning.zoneBounds.min
    ) {
      this.zoneDirection *= -1;
    }

    const pointerStep = shrimpSceneTuning.pointerSpeedPerMs * delta * this.pointerDirection;
    this.pointer.x += pointerStep;

    if (
      this.pointer.x >= shrimpSceneTuning.pointerBounds.max ||
      this.pointer.x <= shrimpSceneTuning.pointerBounds.min
    ) {
      this.pointerDirection *= -1;
    }
  }

  shutdown() {
    this.input.keyboard?.off("keydown-SPACE", this.handleCatch, this);
    this.input.keyboard?.off("keydown-ESC", this.handleExit, this);
  }

  private handleCatch() {
    if (!this.catchZone || !this.pointer || !this.infoText || !this.resultText || this.resultLocked) {
      return;
    }

    const distance = Math.abs(this.pointer.x - this.catchZone.x);
    const success = distance < shrimpSceneTuning.catchThreshold;
    this.resultLocked = true;

    if (success) {
      this.infoText.setText(shrimpSceneContent.successTitle);
      this.resultText.setText(shrimpSceneContent.successLine);
      this.bus.events.emit("shrimp/completed", {
        completed: true,
        normalCatchCount: shrimpSceneTuning.normalCatchCount,
        specialItemFound: true,
      });
    } else {
      this.infoText.setText(shrimpSceneContent.retryTitle);
      this.resultText.setText(shrimpSceneContent.retryLine);
      this.resultLocked = false;
    }
  }

  private handleExit() {
    if (!this.resultLocked) {
      this.bus.events.emit("shrimp/exit", {
        completed: false,
      });
    }
  }
}
