import Phaser from "phaser";
import { Pane } from "tweakpane";
import type { EventBus } from "../../../bus/createEventBus";
import { sceneKeys } from "../../../phaser/sceneKeys";
import { shrimpSceneContent, shrimpSceneTuning } from "../config/content";

type CatchType = "silverFish" | "carp" | "bass" | "catfish" | "prawn";
type CatchQuality = "perfect" | "good" | "miss";
type FishPattern = "steady" | "dart" | "sway";
type SessionGrade = "S" | "A" | "B" | "C";
type CatchBreakdown = Record<CatchType, number>;

type FishingRuntimeTuning = {
  catchThreshold: number;
  perfectThreshold: number;
  zoneSpeedScale: number;
  pointerSpeedScale: number;
  comboScoreFactor: number;
  rareBonusPerCombo: number;
  prawnBonusPerCombo: number;
  dartBurstMultiplier: number;
  swayAmplitude: number;
};

const fishingDebugEnabled =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("debugFishing") === "1";

export class ShrimpScene extends Phaser.Scene {
  private readonly bus: EventBus;

  private catchZone?: Phaser.GameObjects.Rectangle;
  private perfectBand?: Phaser.GameObjects.Rectangle;
  private pointer?: Phaser.GameObjects.Rectangle;
  private hitFlash?: Phaser.GameObjects.Rectangle;
  private sessionText?: Phaser.GameObjects.Text;
  private scoreText?: Phaser.GameObjects.Text;
  private infoText?: Phaser.GameObjects.Text;
  private resultText?: Phaser.GameObjects.Text;
  private patternText?: Phaser.GameObjects.Text;
  private legendText?: Phaser.GameObjects.Text;
  private roundTimerText?: Phaser.GameObjects.Text;
  private roundTimerBarBg?: Phaser.GameObjects.Rectangle;
  private roundTimerBar?: Phaser.GameObjects.Rectangle;
  private ambientTweens: Phaser.Tweens.Tween[] = [];

  private zoneDirection = 1;
  private pointerDirection = 1;
  private zoneSpeedPerMs = shrimpSceneTuning.zoneSpeedPerMs;
  private pointerSpeedPerMs = shrimpSceneTuning.pointerSpeedPerMs;
  private catchThreshold = shrimpSceneTuning.catchThreshold;
  private perfectThreshold = shrimpSceneTuning.perfectThreshold;

  private castCount = 0;
  private totalCatchCount = 0;
  private prawnCount = 0;
  private score = 0;
  private combo = 0;
  private maxCombo = 0;
  private perfectCount = 0;
  private goodCount = 0;
  private missCount = 0;
  private timeoutCount = 0;
  private catchBreakdown: CatchBreakdown = this.createEmptyCatchBreakdown();
  private sessionIndex = 0;
  private playerCoins = 0;
  private playerPrawnTotal = 0;

  private fishPattern: FishPattern = "steady";
  private elapsedMs = 0;
  private nextDartMs = 0;
  private swayPhase = 0;
  private roundTimeLimitMs = shrimpSceneTuning.roundTimeLimitBaseMs;
  private roundTimeLeftMs = shrimpSceneTuning.roundTimeLimitBaseMs;
  private roundChaosFactor = 0;

  private roundReady = true;
  private sessionLocked = false;
  private sessionOutcomeEmitted = false;
  private inputBound = false;
  private lifecycleBound = false;
  private sceneErrorReported = false;
  private roundResetTimer?: Phaser.Time.TimerEvent;
  private mapReturnGuardTimer?: Phaser.Time.TimerEvent;
  private mapReturnFallbackEmitted = false;

  private tuningPane?: Pane;
  private tuningPaneHost?: HTMLDivElement;
  private cleanupFns: Array<() => void> = [];
  private runtimeTuning: FishingRuntimeTuning = {
    catchThreshold: shrimpSceneTuning.catchThreshold,
    perfectThreshold: shrimpSceneTuning.perfectThreshold,
    zoneSpeedScale: 1,
    pointerSpeedScale: 1,
    comboScoreFactor: shrimpSceneTuning.scoring.comboScoreFactor,
    rareBonusPerCombo: 0.018,
    prawnBonusPerCombo: 0.012,
    dartBurstMultiplier: shrimpSceneTuning.fishBehavior.dartBurstMultiplier,
    swayAmplitude: shrimpSceneTuning.fishBehavior.swayAmplitude,
  };

  private audioContext?: AudioContext;

  constructor(bus: EventBus) {
    super(sceneKeys.shrimp);
    this.bus = bus;
  }

  create() {
    this.runSafely("shrimp/create", () => {
      this.createBackdrop();
      this.createFishingBar();
      this.createHud();
      this.cleanupFns.push(
        this.bus.commands.subscribe("shrimp/start", ({ sessionIndex, playerCoins, playerPrawnTotal }) => {
          this.sessionIndex = Math.max(0, sessionIndex);
          this.playerCoins = Math.max(0, playerCoins);
          this.playerPrawnTotal = Math.max(0, playerPrawnTotal);
          this.updateSessionText();
        }),
      );

      if (!this.lifecycleBound) {
        this.events.on(Phaser.Scenes.Events.SLEEP, this.handleSceneSleep, this);
        this.events.on(Phaser.Scenes.Events.WAKE, this.handleSceneWake, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleSceneShutdown, this);
        this.lifecycleBound = true;
      }

      this.setupDebugPane();
      this.resetSessionState();
      this.bindInput();
    });
  }

  update(_time: number, delta: number) {
    this.runSafely("shrimp/update", () => {
      if (!this.catchZone || !this.pointer || this.sessionLocked || !this.roundReady) {
        return;
      }

      this.elapsedMs += delta;

      const zoneStep = this.zoneSpeedPerMs * delta * this.zoneDirection;
      this.catchZone.x += zoneStep;
      if (
        this.catchZone.x >= shrimpSceneTuning.zoneBounds.max ||
        this.catchZone.x <= shrimpSceneTuning.zoneBounds.min
      ) {
        this.zoneDirection *= -1;
      }

      let pointerStep = this.pointerSpeedPerMs * delta * this.pointerDirection;
      if (this.fishPattern === "dart" && this.elapsedMs >= this.nextDartMs) {
        pointerStep *= this.runtimeTuning.dartBurstMultiplier;
        this.nextDartMs =
          this.elapsedMs +
          Phaser.Math.Between(
            shrimpSceneTuning.fishBehavior.dartIntervalMinMs,
            shrimpSceneTuning.fishBehavior.dartIntervalMaxMs,
          );
      }
      if (this.fishPattern === "sway") {
        pointerStep +=
          Math.sin(this.elapsedMs * shrimpSceneTuning.fishBehavior.swayFrequency + this.swayPhase) *
          this.runtimeTuning.swayAmplitude *
          (delta / 1000);
      }

      this.pointer.x += pointerStep;
      if (
        this.pointer.x >= shrimpSceneTuning.pointerBounds.max ||
        this.pointer.x <= shrimpSceneTuning.pointerBounds.min
      ) {
        this.pointerDirection *= -1;
      }

      this.perfectBand?.setPosition(this.catchZone.x, this.catchZone.y);
      this.roundTimeLeftMs = Math.max(0, this.roundTimeLeftMs - delta);
      this.updateRoundTimerHud();
      if (this.roundTimeLeftMs <= 0) {
        this.handleRoundTimeout();
      }
    });
  }

  shutdown() {
    this.handleSceneShutdown();
  }

  private createBackdrop() {
    this.cameras.main.setBackgroundColor("#071828");
    const water = this.add.graphics();
    water.fillGradientStyle(0x0a2134, 0x0a2134, 0x113b57, 0x113b57, 1);
    water.fillRect(0, 0, 960, 540);

    const glow = this.add.graphics();
    glow.fillGradientStyle(0x39a8d8, 0x39a8d8, 0x0f3550, 0x0f3550, 0.16);
    glow.fillRect(0, 160, 960, 300);

    const waveA = this.add.rectangle(480, 250, 760, 6, 0x6ed0ef, 0.12);
    const waveB = this.add.rectangle(470, 292, 700, 8, 0x96e7ff, 0.1);
    const waveC = this.add.rectangle(500, 334, 760, 6, 0x6ed0ef, 0.09);

    this.ambientTweens.push(
      this.tweens.add({
        targets: waveA,
        x: 500,
        duration: 2200,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      }),
    );
    this.ambientTweens.push(
      this.tweens.add({
        targets: waveB,
        x: 450,
        duration: 2800,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      }),
    );
    this.ambientTweens.push(
      this.tweens.add({
        targets: waveC,
        x: 520,
        duration: 2400,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      }),
    );
  }

  private createFishingBar() {
    this.add.rectangle(480, 270, 740, 168, 0x0c2438, 0.48).setStrokeStyle(2, 0x5fb9de, 0.35);
    this.add.rectangle(480, 270, 640, 30, 0x1c3047, 0.95).setStrokeStyle(2, 0x84d2f6, 0.72);
    this.add.rectangle(480, 270, 640, 6, 0x92dbff, 0.18);

    this.catchZone = this.add.rectangle(
      shrimpSceneTuning.catchZoneStartX,
      270,
      shrimpSceneTuning.catchZoneWidth,
      34,
      0xf7ce6f,
      0.88,
    );
    this.perfectBand = this.add.rectangle(
      shrimpSceneTuning.catchZoneStartX,
      270,
      52,
      34,
      0xffefad,
      0.45,
    );
    this.pointer = this.add.rectangle(
      shrimpSceneTuning.pointerStartX,
      270,
      16,
      52,
      0xf5fbff,
      1,
    );
    this.hitFlash = this.add.rectangle(480, 270, 960, 540, 0xffffff, 0).setAlpha(0);
  }

  private createHud() {
    this.add.text(40, 28, shrimpSceneContent.title, {
      fontSize: "28px",
      color: "#f7e6bb",
      fontFamily: "Trebuchet MS",
    });
    this.add.text(40, 62, shrimpSceneContent.subtitle, {
      fontSize: "16px",
      color: "#dbf1e4",
      fontFamily: "Trebuchet MS",
    });

    this.sessionText = this.add.text(40, 100, "", {
      fontSize: "17px",
      color: "#eef2d8",
      fontFamily: "Trebuchet MS",
    });
    this.scoreText = this.add.text(40, 126, "", {
      fontSize: "17px",
      color: "#d1f3ff",
      fontFamily: "Trebuchet MS",
    });
    this.patternText = this.add.text(40, 152, "", {
      fontSize: "16px",
      color: "#9fe7ff",
      fontFamily: "Trebuchet MS",
    });
    this.roundTimerBarBg = this.add.rectangle(760, 130, 182, 14, 0x173446, 0.9).setStrokeStyle(1, 0x6cd2f2, 0.38);
    this.roundTimerBar = this.add.rectangle(669, 130, 178, 10, 0x85f0ff, 0.86).setOrigin(0, 0.5);
    this.roundTimerText = this.add.text(662, 102, "", {
      fontSize: "15px",
      color: "#d8f8ff",
      fontFamily: "Trebuchet MS",
    });
    this.legendText = this.add.text(620, 152, shrimpSceneContent.qualityLegend, {
      fontSize: "14px",
      color: "#e8e5bf",
      fontFamily: "Trebuchet MS",
    });
    this.infoText = this.add.text(40, 426, shrimpSceneContent.idleHint, {
      fontSize: "20px",
      color: "#f8f2dc",
      fontFamily: "Trebuchet MS",
    });
    this.resultText = this.add.text(40, 462, "", {
      fontSize: "18px",
      color: "#f6e4b3",
      fontFamily: "Trebuchet MS",
      wordWrap: {
        width: 860,
      },
    });
  }

  private bindInput() {
    if (this.inputBound) {
      return;
    }
    this.input.keyboard?.on("keydown-SPACE", this.handleCatch, this);
    this.input.keyboard?.on("keydown-ESC", this.handleExit, this);
    this.inputBound = true;
  }

  private unbindInput() {
    if (!this.inputBound) {
      return;
    }
    this.input.keyboard?.off("keydown-SPACE", this.handleCatch, this);
    this.input.keyboard?.off("keydown-ESC", this.handleExit, this);
    this.inputBound = false;
  }

  private clearRoundResetTimer() {
    this.roundResetTimer?.destroy();
    this.roundResetTimer = undefined;
  }

  private clearMapReturnGuardTimer() {
    this.mapReturnGuardTimer?.destroy();
    this.mapReturnGuardTimer = undefined;
  }

  private clearAmbientTweens() {
    this.ambientTweens.forEach((tween) => tween.stop());
    this.ambientTweens = [];
  }

  private resetSessionState() {
    this.sceneErrorReported = false;
    this.sessionLocked = false;
    this.sessionOutcomeEmitted = false;
    this.roundReady = true;
    this.castCount = 0;
    this.totalCatchCount = 0;
    this.prawnCount = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.perfectCount = 0;
    this.goodCount = 0;
    this.missCount = 0;
    this.timeoutCount = 0;
    this.catchBreakdown = this.createEmptyCatchBreakdown();
    this.elapsedMs = 0;
    this.nextDartMs = 0;
    this.swayPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.roundChaosFactor = 0;
    this.roundTimeLimitMs = shrimpSceneTuning.roundTimeLimitBaseMs;
    this.roundTimeLeftMs = shrimpSceneTuning.roundTimeLimitBaseMs;

    this.applyRuntimeTuningBounds();
    this.clearRoundResetTimer();
    this.clearMapReturnGuardTimer();
    this.resetRoundDynamics();
    this.updateSessionText();
    this.armRoundTimer();
    this.infoText?.setText(shrimpSceneContent.idleHint);
    this.resultText?.setText("");
    this.mapReturnFallbackEmitted = false;
  }

  private handleSceneSleep() {
    this.clearRoundResetTimer();
    this.clearMapReturnGuardTimer();
    this.unbindInput();
    if (this.tuningPaneHost) {
      this.tuningPaneHost.style.display = "none";
    }
  }

  private handleSceneWake() {
    this.runSafely("shrimp/wake", () => {
      if (this.tuningPaneHost) {
        this.tuningPaneHost.style.display = "block";
      }
      this.resetSessionState();
      this.bindInput();
    });
  }

  private handleSceneShutdown() {
    this.clearRoundResetTimer();
    this.clearMapReturnGuardTimer();
    this.unbindInput();
    this.clearAmbientTweens();
    this.tuningPane?.dispose();
    this.tuningPane = undefined;
    if (this.tuningPaneHost?.parentElement) {
      this.tuningPaneHost.parentElement.removeChild(this.tuningPaneHost);
    }
    this.tuningPaneHost = undefined;
    this.events.off(Phaser.Scenes.Events.SLEEP, this.handleSceneSleep, this);
    this.events.off(Phaser.Scenes.Events.WAKE, this.handleSceneWake, this);
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.handleSceneShutdown, this);
    this.cleanupFns.forEach((cleanup) => cleanup());
    this.cleanupFns = [];
    this.lifecycleBound = false;
  }

  private setupDebugPane() {
    if (!fishingDebugEnabled || this.tuningPane) {
      return;
    }
    const parent = this.game.canvas?.parentElement;
    if (!parent) {
      return;
    }
    if (window.getComputedStyle(parent).position === "static") {
      parent.style.position = "relative";
    }
    const host = document.createElement("div");
    host.style.position = "absolute";
    host.style.top = "12px";
    host.style.right = "12px";
    host.style.zIndex = "40";
    host.style.maxWidth = "260px";
    parent.appendChild(host);
    this.tuningPaneHost = host;

    const pane = new Pane({
      title: shrimpSceneContent.debugPaneTitle,
      container: host,
    });
    this.tuningPane = pane;
    const paneApi = pane as Pane & {
      addBinding: (target: object, key: string, options?: Record<string, unknown>) => void;
      addButton: (options: { title: string }) => { on: (event: "click", handler: () => void) => void };
      refresh: () => void;
      on: (event: "change", handler: () => void) => void;
    };

    paneApi.addBinding(this.runtimeTuning, "catchThreshold", {
      label: "Catch",
      min: 40,
      max: 92,
      step: 1,
    });
    paneApi.addBinding(this.runtimeTuning, "perfectThreshold", {
      label: "Perfect",
      min: 14,
      max: 52,
      step: 1,
    });
    paneApi.addBinding(this.runtimeTuning, "zoneSpeedScale", {
      label: "Zone SPD",
      min: 0.7,
      max: 1.5,
      step: 0.01,
    });
    paneApi.addBinding(this.runtimeTuning, "pointerSpeedScale", {
      label: "Pointer SPD",
      min: 0.7,
      max: 1.7,
      step: 0.01,
    });
    paneApi.addBinding(this.runtimeTuning, "comboScoreFactor", {
      label: "Combo Score",
      min: 0,
      max: 20,
      step: 0.5,
    });
    paneApi.addBinding(this.runtimeTuning, "rareBonusPerCombo", {
      label: "Rare+Combo",
      min: 0,
      max: 0.05,
      step: 0.001,
    });
    paneApi.addBinding(this.runtimeTuning, "prawnBonusPerCombo", {
      label: "Prawn+Combo",
      min: 0,
      max: 0.04,
      step: 0.001,
    });
    paneApi.addBinding(this.runtimeTuning, "dartBurstMultiplier", {
      label: "Dart Boost",
      min: 1,
      max: 2.4,
      step: 0.01,
    });
    paneApi.addBinding(this.runtimeTuning, "swayAmplitude", {
      label: "Sway Amp",
      min: 8,
      max: 84,
      step: 1,
    });
    paneApi
      .addButton({
        title: "Reset Normal",
      })
      .on("click", () => {
        this.resetRuntimeTuning();
        paneApi.refresh();
        this.resetSessionState();
      });

    paneApi.on("change", () => {
      this.applyRuntimeTuningBounds();
      this.resetRoundDynamics();
      this.updateSessionText();
    });
  }

  private resetRuntimeTuning() {
    this.runtimeTuning.catchThreshold = shrimpSceneTuning.catchThreshold;
    this.runtimeTuning.perfectThreshold = shrimpSceneTuning.perfectThreshold;
    this.runtimeTuning.zoneSpeedScale = 1;
    this.runtimeTuning.pointerSpeedScale = 1;
    this.runtimeTuning.comboScoreFactor = shrimpSceneTuning.scoring.comboScoreFactor;
    this.runtimeTuning.rareBonusPerCombo = 0.018;
    this.runtimeTuning.prawnBonusPerCombo = 0.012;
    this.runtimeTuning.dartBurstMultiplier = shrimpSceneTuning.fishBehavior.dartBurstMultiplier;
    this.runtimeTuning.swayAmplitude = shrimpSceneTuning.fishBehavior.swayAmplitude;
  }

  private applyRuntimeTuningBounds() {
    this.runtimeTuning.catchThreshold = Phaser.Math.Clamp(this.runtimeTuning.catchThreshold, 40, 92);
    this.runtimeTuning.perfectThreshold = Phaser.Math.Clamp(
      this.runtimeTuning.perfectThreshold,
      14,
      this.runtimeTuning.catchThreshold - 6,
    );
  }

  private handleCatch() {
    this.runSafely("shrimp/catch", () => {
      if (
        !this.catchZone ||
        !this.pointer ||
        !this.infoText ||
        !this.resultText ||
        this.sessionLocked ||
        this.sessionOutcomeEmitted ||
        !this.roundReady
      ) {
        return;
      }

      this.roundTimeLeftMs = 0;
      this.roundReady = false;
      this.castCount += 1;
      const distance = Math.abs(this.pointer.x - this.catchZone.x);
      const quality = this.getCatchQuality(distance);
      let headline = shrimpSceneContent.castMissTitle;
      let detailLine = shrimpSceneContent.castContinueLine;

      if (quality === "miss") {
        this.missCount += 1;
        this.combo = 0;
        this.score = Math.max(0, this.score - shrimpSceneTuning.scoring.missPenalty);
        detailLine = shrimpSceneContent.comboBreakLine;
      } else {
        const catchType = this.rollCatchType(distance, quality);
        this.totalCatchCount += 1;
        this.registerCatch(catchType);
        this.combo += 1;
        this.maxCombo = Math.max(this.maxCombo, this.combo);

        if (quality === "perfect") {
          this.perfectCount += 1;
          headline = shrimpSceneContent.castPerfectTitle;
          this.score +=
            shrimpSceneTuning.scoring.perfectBase +
            Math.round(this.combo * this.runtimeTuning.comboScoreFactor);
        } else {
          this.goodCount += 1;
          headline = shrimpSceneContent.castGoodTitle;
          this.score +=
            shrimpSceneTuning.scoring.goodBase +
            Math.round(this.combo * this.runtimeTuning.comboScoreFactor * 0.58);
        }

        detailLine = `${this.getCatchTypeLabel(catchType)} · ${this.getQualityLabel(quality)}（第 ${this.castCount}/${shrimpSceneTuning.sessionCastCount} 杆）`;
      }

      this.infoText.setText(headline);
      this.resultText.setText(detailLine);
      this.updateSessionText();
      this.playCatchFeedback(quality);

      if (this.castCount >= shrimpSceneTuning.sessionCastCount) {
        this.finishSession();
        return;
      }

      this.clearRoundResetTimer();
      this.roundResetTimer = this.time.delayedCall(shrimpSceneTuning.resolveRevealDelayMs, () => {
        this.runSafely("shrimp/round-reset", () => {
          if (this.sessionLocked || this.sessionOutcomeEmitted || this.scene.isSleeping()) {
            return;
          }

          this.resetRoundDynamics();
          this.roundReady = true;
          this.armRoundTimer();
          this.infoText?.setText(shrimpSceneContent.castReadyHint);
        });
      });
    });
  }

  private handleExit() {
    this.runSafely("shrimp/exit", () => {
      if (this.sessionOutcomeEmitted) {
        return;
      }
      this.sessionOutcomeEmitted = true;
      this.clearRoundResetTimer();
      this.clearMapReturnGuardTimer();
      this.roundTimeLeftMs = 0;
      this.updateRoundTimerHud();
      this.bus.events.emit("shrimp/exit", {
        completed: false,
      });
    });
  }

  private resetRoundDynamics() {
    if (!this.catchZone || !this.pointer) {
      return;
    }

    this.roundChaosFactor = Phaser.Math.Clamp(
      this.castCount * shrimpSceneTuning.chaosPerCast,
      0,
      shrimpSceneTuning.maxChaosFactor,
    );
    const chaosMultiplier = 1 + this.roundChaosFactor;

    const zoneSpeedVariance = Phaser.Math.FloatBetween(
      -shrimpSceneTuning.zoneSpeedVariancePerMs,
      shrimpSceneTuning.zoneSpeedVariancePerMs,
    );
    const pointerSpeedVariance = Phaser.Math.FloatBetween(
      -shrimpSceneTuning.pointerSpeedVariancePerMs,
      shrimpSceneTuning.pointerSpeedVariancePerMs,
    );

    this.zoneSpeedPerMs = Math.max(
      0.06,
      (shrimpSceneTuning.zoneSpeedPerMs + zoneSpeedVariance * chaosMultiplier) *
        this.runtimeTuning.zoneSpeedScale *
        (1 + this.roundChaosFactor * 0.26),
    );
    this.pointerSpeedPerMs = Math.max(
      0.14,
      (shrimpSceneTuning.pointerSpeedPerMs + pointerSpeedVariance * chaosMultiplier) *
        this.runtimeTuning.pointerSpeedScale *
        (1 + this.roundChaosFactor * 0.34),
    );
    this.catchThreshold = Math.max(
      38,
      this.runtimeTuning.catchThreshold +
        Phaser.Math.Between(
          -Math.round(shrimpSceneTuning.catchThresholdVariance * chaosMultiplier),
          Math.round(shrimpSceneTuning.catchThresholdVariance * chaosMultiplier),
        ) -
        Math.round(this.roundChaosFactor * 8),
    );
    this.perfectThreshold = Phaser.Math.Clamp(this.runtimeTuning.perfectThreshold, 14, this.catchThreshold - 6);

    const zoneWidth = Phaser.Math.Between(
      shrimpSceneTuning.catchZoneWidthRange.min,
      shrimpSceneTuning.catchZoneWidthRange.max,
    );
    this.catchZone.width = zoneWidth;
    this.catchZone.x = Phaser.Math.Between(shrimpSceneTuning.zoneBounds.min, shrimpSceneTuning.zoneBounds.max);
    this.pointer.x = Phaser.Math.Between(
      shrimpSceneTuning.pointerBounds.min + 12,
      shrimpSceneTuning.pointerBounds.max - 12,
    );
    this.zoneDirection = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
    this.pointerDirection = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;

    this.fishPattern = this.rollFishPattern(this.roundChaosFactor);
    this.nextDartMs =
      this.elapsedMs +
      Phaser.Math.Between(
        shrimpSceneTuning.fishBehavior.dartIntervalMinMs,
        shrimpSceneTuning.fishBehavior.dartIntervalMaxMs,
      );
    this.swayPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);

    this.perfectBand?.setSize(Math.max(22, this.perfectThreshold * 1.45), 34);
    this.perfectBand?.setPosition(this.catchZone.x, this.catchZone.y);
    this.updatePatternText();
  }

  private rollFishPattern(chaos: number): FishPattern {
    const jitter = Phaser.Math.FloatBetween(-0.08, 0.08);
    const dartChance = Phaser.Math.Clamp(
      shrimpSceneTuning.fishBehavior.dartPatternChance + chaos * 0.16 + jitter,
      0.18,
      0.68,
    );
    const swayChance = Phaser.Math.Clamp(
      shrimpSceneTuning.fishBehavior.swayPatternChance + chaos * 0.12 - jitter,
      0.12,
      0.55,
    );
    const roll = Math.random();
    if (roll < dartChance) {
      return "dart";
    }
    if (roll < dartChance + swayChance) {
      return "sway";
    }
    return "steady";
  }

  private getCatchQuality(distance: number): CatchQuality {
    if (distance <= this.perfectThreshold) {
      return "perfect";
    }
    if (distance <= this.catchThreshold) {
      return "good";
    }
    return "miss";
  }

  private finishSession() {
    if (!this.infoText || !this.resultText) {
      return;
    }
    if (this.sessionOutcomeEmitted) {
      return;
    }

    this.sessionLocked = true;
    this.sessionOutcomeEmitted = true;
    this.roundReady = false;
    this.clearRoundResetTimer();
    this.roundTimeLeftMs = 0;
    this.updateRoundTimerHud();

    const prawnTotalAfterSession = this.playerPrawnTotal + this.prawnCount;
    const qualifiedForChest =
      prawnTotalAfterSession >= shrimpSceneTuning.requiredPrawnTotalForReward;
    const grade = this.getSessionGrade();
    const settlement = this.getSessionSettlement(grade);
    this.infoText.setText(
      qualifiedForChest ? shrimpSceneContent.sessionSuccessTitle : shrimpSceneContent.sessionFailTitle,
    );
    this.resultText.setText(
      [
        qualifiedForChest
          ? shrimpSceneContent.sessionQualifiedLine
          : shrimpSceneContent.sessionNotQualifiedLine,
      ].join("\n"),
    );
    this.playFinishFeedback(grade);

    this.bus.events.emit("shrimp/completed", {
      completed: true,
      normalCatchCount: this.totalCatchCount - this.prawnCount,
      specialItemFound: qualifiedForChest,
      prawnCount: this.prawnCount,
      totalCatchCount: this.totalCatchCount,
      sessionQualifiedForChest: qualifiedForChest,
      castCount: this.castCount,
      perfectCount: this.perfectCount,
      goodCount: this.goodCount,
      missCount: this.missCount,
      timeoutCount: this.timeoutCount,
      catchBreakdown: { ...this.catchBreakdown },
      sessionCost: settlement.sessionCost,
      sessionSurcharge: settlement.sessionSurcharge,
      sessionReward: settlement.sessionReward,
      coinDelta: settlement.coinDelta,
      prawnTotalAfterSession,
    });
    this.armMapReturnGuard();
  }

  private armMapReturnGuard() {
    this.clearMapReturnGuardTimer();
    this.mapReturnGuardTimer = this.time.delayedCall(700, () => {
      this.runSafely("shrimp/map-return-guard", () => {
        if (this.scene.isSleeping() || !this.scene.isActive() || this.mapReturnFallbackEmitted) {
          return;
        }
        this.mapReturnFallbackEmitted = true;
        this.bus.events.emit("system/error", {
          source: "shrimp/map-return-guard",
          message: "结算后地图切换超时，已触发返回地图兜底。",
          code: "shrimp_map_return_guard",
          recoverable: true,
          actionHint: "已自动尝试返回地图。",
        });
        this.bus.events.emit("shrimp/exit", {
          completed: false,
        });
      });
    });
  }

  private getSessionGrade(): SessionGrade {
    if (this.score >= shrimpSceneTuning.gradeThresholds.s) {
      return "S";
    }
    if (this.score >= shrimpSceneTuning.gradeThresholds.a) {
      return "A";
    }
    if (this.score >= shrimpSceneTuning.gradeThresholds.b) {
      return "B";
    }
    return "C";
  }

  private createEmptyCatchBreakdown(): CatchBreakdown {
    return {
      silverFish: 0,
      carp: 0,
      bass: 0,
      catfish: 0,
      prawn: 0,
    };
  }

  private registerCatch(catchType: CatchType) {
    this.catchBreakdown[catchType] += 1;
    if (catchType === "prawn") {
      this.prawnCount += 1;
    }
  }

  private getSessionSettlement(grade: SessionGrade) {
    const fishReward =
      this.catchBreakdown.silverFish * shrimpSceneTuning.economy.fishReward.silverFish +
      this.catchBreakdown.carp * shrimpSceneTuning.economy.fishReward.carp +
      this.catchBreakdown.bass * shrimpSceneTuning.economy.fishReward.bass +
      this.catchBreakdown.catfish * shrimpSceneTuning.economy.fishReward.catfish +
      this.catchBreakdown.prawn * shrimpSceneTuning.economy.fishReward.prawn;
    const qualityReward = this.perfectCount * shrimpSceneTuning.economy.perfectCatchBonus;
    const sessionReward = fishReward + qualityReward + this.getGradeReward(grade);
    const sessionSurcharge = this.getSessionSurcharge();
    const sessionCost =
      shrimpSceneTuning.economy.baseSessionFee +
      sessionSurcharge +
      this.castCount * shrimpSceneTuning.economy.castFee +
      this.timeoutCount * shrimpSceneTuning.economy.timeoutPenaltyFee;

    return {
      sessionReward,
      sessionCost,
      sessionSurcharge,
      coinDelta: sessionReward - sessionCost,
    };
  }

  private getSessionSurcharge() {
    return Math.min(
      shrimpSceneTuning.economy.sessionFeeGrowthCap,
      this.sessionIndex * shrimpSceneTuning.economy.sessionFeeGrowthPerSession,
    );
  }

  private getGradeReward(grade: SessionGrade) {
    if (grade === "S") {
      return shrimpSceneTuning.economy.gradeReward.s;
    }
    if (grade === "A") {
      return shrimpSceneTuning.economy.gradeReward.a;
    }
    if (grade === "B") {
      return shrimpSceneTuning.economy.gradeReward.b;
    }
    return shrimpSceneTuning.economy.gradeReward.c;
  }

  private updateSessionText() {
    if (this.sessionText) {
      this.sessionText.setText(
        `进度 ${Math.min(this.castCount, shrimpSceneTuning.sessionCastCount)}/${shrimpSceneTuning.sessionCastCount} 杆`,
      );
    }
    if (this.scoreText) {
      this.scoreText.setText("");
    }
  }

  private updatePatternText() {
    if (!this.patternText) {
      return;
    }
    const patternName =
      this.fishPattern === "dart" ? "突进" : this.fishPattern === "sway" ? "回摆" : "平稳";
    this.patternText.setText(
      `鱼群动作：${patternName} ｜ 判定窗 ±${this.catchThreshold} / Perfect ±${this.perfectThreshold} ｜ 随机度 ${Math.round(this.roundChaosFactor * 100)}%`,
    );
  }

  private armRoundTimer() {
    const tightening = this.castCount * shrimpSceneTuning.roundTimeLimitTightenPerCastMs;
    const variance = Phaser.Math.Between(
      -shrimpSceneTuning.roundTimeLimitVarianceMs,
      shrimpSceneTuning.roundTimeLimitVarianceMs,
    );
    const randomPenalty = Math.round(this.roundChaosFactor * 420);
    const nextLimit = Math.max(
      shrimpSceneTuning.roundTimeLimitMinMs,
      shrimpSceneTuning.roundTimeLimitBaseMs - tightening + variance - randomPenalty,
    );
    this.roundTimeLimitMs = nextLimit;
    this.roundTimeLeftMs = nextLimit;
    this.updateRoundTimerHud();
  }

  private updateRoundTimerHud() {
    if (!this.roundTimerText || !this.roundTimerBar) {
      return;
    }
    const ratio = Phaser.Math.Clamp(this.roundTimeLeftMs / Math.max(1, this.roundTimeLimitMs), 0, 1);
    const width = Math.max(0, 178 * ratio);
    this.roundTimerBar.width = width;
    const warning = this.roundTimeLeftMs <= shrimpSceneTuning.roundTimeWarningMs;
    this.roundTimerBar.setFillStyle(warning ? 0xff9d76 : 0x85f0ff, warning ? 0.95 : 0.86);
    this.roundTimerText.setText(`本杆限时 ${(this.roundTimeLeftMs / 1000).toFixed(2)}s`);
    this.roundTimerText.setColor(warning ? "#ffd6bf" : "#d8f8ff");
  }

  private handleRoundTimeout() {
    if (
      !this.infoText ||
      !this.resultText ||
      this.sessionLocked ||
      this.sessionOutcomeEmitted ||
      !this.roundReady
    ) {
      return;
    }

    this.roundReady = false;
    this.castCount += 1;
    this.missCount += 1;
    this.timeoutCount += 1;
    this.combo = 0;
    this.score = Math.max(0, this.score - shrimpSceneTuning.scoring.missPenalty - 8);

    this.infoText.setText(shrimpSceneContent.castTimeoutTitle);
    this.resultText.setText(
      `${shrimpSceneContent.castTimeoutLine}（第 ${this.castCount}/${shrimpSceneTuning.sessionCastCount} 杆）`,
    );
    this.updateSessionText();
    this.playCatchFeedback("miss");

    if (this.castCount >= shrimpSceneTuning.sessionCastCount) {
      this.finishSession();
      return;
    }

    this.clearRoundResetTimer();
    this.roundResetTimer = this.time.delayedCall(shrimpSceneTuning.resolveRevealDelayMs, () => {
      this.runSafely("shrimp/round-timeout-reset", () => {
        if (this.sessionLocked || this.sessionOutcomeEmitted || this.scene.isSleeping()) {
          return;
        }
        this.resetRoundDynamics();
        this.roundReady = true;
        this.armRoundTimer();
        this.infoText?.setText(shrimpSceneContent.castReadyHint);
      });
    });
  }

  private rollCatchType(distance: number, quality: CatchQuality): CatchType {
    const qualityFactor = quality === "perfect" ? 1 : 0.64;
    const precisionBonus = Phaser.Math.Clamp(1 - distance / Math.max(1, this.catchThreshold), 0, 1);
    const comboRareBonus = Math.min(0.24, this.combo * this.runtimeTuning.rareBonusPerCombo);
    const comboPrawnBonus = Math.min(0.04, this.combo * this.runtimeTuning.prawnBonusPerCombo * 0.35);
    const prawnChance =
      quality === "perfect"
        ? Phaser.Math.Clamp(
            Phaser.Math.Linear(
              shrimpSceneTuning.fishRoll.basePrawnChance,
              shrimpSceneTuning.fishRoll.maxPrawnChance,
              qualityFactor,
            ) +
              comboPrawnBonus +
              precisionBonus * 0.02 +
              this.roundChaosFactor * 0.01,
            0.02,
            0.16,
          )
        : 0;
    let rareChance = Phaser.Math.Clamp(
      Phaser.Math.Linear(
        shrimpSceneTuning.fishRoll.baseRareFishChance,
        shrimpSceneTuning.fishRoll.maxRareFishChance,
        qualityFactor,
      ) +
        comboRareBonus +
        precisionBonus * 0.06 +
        this.roundChaosFactor * 0.04,
      0.08,
      0.36,
    );
    if (prawnChance + rareChance > 0.62) {
      rareChance = 0.62 - prawnChance;
    }

    const roll = Math.random();
    if (roll < prawnChance) {
      return "prawn";
    }
    if (roll < prawnChance + rareChance) {
      return "catfish";
    }
    const commonRoll = Math.random();
    if (commonRoll < 0.42) {
      return "bass";
    }
    if (commonRoll < 0.74) {
      return "carp";
    }
    return "silverFish";
  }

  private getCatchTypeLabel(catchType: CatchType) {
    if (catchType === "prawn") {
      return "你钓到了一只罗氏虾";
    }
    if (catchType === "catfish") {
      return "你钓到了一条鲶鱼";
    }
    if (catchType === "bass") {
      return "你钓到了一条鲈鱼";
    }
    if (catchType === "carp") {
      return "你钓到了一条鲤鱼";
    }
    return "你钓到了一条银鱼";
  }

  private getQualityLabel(quality: CatchQuality) {
    if (quality === "perfect") {
      return "Perfect";
    }
    if (quality === "good") {
      return "Good";
    }
    return "Miss";
  }

  private playCatchFeedback(quality: CatchQuality) {
    if (!this.pointer) {
      return;
    }
    const color = quality === "perfect" ? 0xfff1a3 : quality === "good" ? 0x8cecff : 0xff9d9d;
    const shake =
      quality === "perfect"
        ? shrimpSceneTuning.feedback.perfectShakeIntensity
        : quality === "good"
          ? shrimpSceneTuning.feedback.goodShakeIntensity
          : shrimpSceneTuning.feedback.missShakeIntensity;
    const burstCount =
      quality === "perfect"
        ? shrimpSceneTuning.feedback.burstCountPerfect
        : quality === "good"
          ? shrimpSceneTuning.feedback.burstCountGood
          : shrimpSceneTuning.feedback.burstCountMiss;

    this.hitFlash?.setFillStyle(color, 0.2).setAlpha(0.22);
    this.tweens.add({
      targets: this.hitFlash,
      alpha: 0,
      duration: shrimpSceneTuning.feedback.flashDurationMs,
      ease: "Quad.easeOut",
    });
    this.cameras.main.shake(70, shake);
    this.spawnBurst(this.pointer.x, this.pointer.y, color, burstCount);
    this.playTone(quality);
  }

  private playFinishFeedback(grade: SessionGrade) {
    const color = grade === "S" ? 0xfff1a3 : grade === "A" ? 0xaee6ff : 0x8dc9ff;
    this.hitFlash?.setFillStyle(color, 0.22).setAlpha(0.25);
    this.tweens.add({
      targets: this.hitFlash,
      alpha: 0,
      duration: 280,
      ease: "Quad.easeOut",
    });
    this.spawnBurst(480, 270, color, 20);
    this.playTone("finish");
  }

  private spawnBurst(x: number, y: number, color: number, count: number) {
    for (let index = 0; index < count; index += 1) {
      const particle = this.add.circle(
        x + Phaser.Math.Between(-12, 12),
        y + Phaser.Math.Between(-10, 10),
        Phaser.Math.Between(2, 4),
        color,
        0.85,
      );
      this.tweens.add({
        targets: particle,
        x: particle.x + Phaser.Math.Between(-34, 34),
        y: particle.y - Phaser.Math.Between(18, 56),
        alpha: 0,
        scale: 0.16,
        duration: Phaser.Math.Between(180, 420),
        ease: "Sine.easeOut",
        onComplete: () => particle.destroy(),
      });
    }
  }

  private playTone(kind: CatchQuality | "finish") {
    const context = this.getAudioContext();
    if (!context) {
      return;
    }

    const gainNode = context.createGain();
    const oscillator = context.createOscillator();
    const now = context.currentTime;

    let frequency = 420;
    let duration = 0.07;
    let volume = 0.05;
    if (kind === "perfect") {
      frequency = 760;
      duration = 0.11;
      volume = 0.07;
      oscillator.type = "triangle";
    } else if (kind === "good") {
      frequency = 560;
      duration = 0.08;
      volume = 0.055;
      oscillator.type = "sine";
    } else if (kind === "miss") {
      frequency = 260;
      duration = 0.06;
      volume = 0.05;
      oscillator.type = "square";
    } else {
      frequency = 880;
      duration = 0.14;
      volume = 0.08;
      oscillator.type = "triangle";
    }

    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  private getAudioContext() {
    const AudioCtor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) {
      return null;
    }
    if (!this.audioContext) {
      this.audioContext = new AudioCtor();
    }
    if (this.audioContext.state === "suspended") {
      void this.audioContext.resume();
    }
    return this.audioContext;
  }

  private runSafely(source: string, action: () => void) {
    try {
      action();
    } catch (error) {
      this.reportSceneError(source, error);
    }
  }

  private reportSceneError(source: string, error: unknown) {
    if (this.sceneErrorReported) {
      return;
    }

    this.sceneErrorReported = true;
    this.sessionLocked = true;
    this.roundReady = false;
    this.clearRoundResetTimer();
    this.clearMapReturnGuardTimer();

    const message = error instanceof Error ? error.message : String(error);
    this.bus.events.emit("system/error", {
      source,
      message,
      code: "shrimp_scene_runtime_failed",
      recoverable: true,
      actionHint: "请按 Esc 返回地图后重试钓鱼。",
    });
    if (!this.mapReturnFallbackEmitted) {
      this.mapReturnFallbackEmitted = true;
      this.bus.events.emit("shrimp/exit", {
        completed: false,
      });
    }
  }
}
