import type { EventBus } from "../bus/createEventBus";
import type { CatanBoardSnapshot } from "../modules/catan/types";
import type { CatanMatchSnapshot } from "../modules/catan/engineTypes";
import type { SceneId } from "../store/types";
import { setGameInstance } from "./gameRegistry";
import { loadPhaserRuntime, loadPhaserScene } from "./loadPhaserRuntime";
import { sceneKeyBySceneId } from "./sceneKeys";

type PhaserBootState = {
  initialSceneId: Extract<SceneId, "map" | "shrimp" | "catan">;
  rendererType?: number;
  mapState: {
    shrimpCompleted: boolean;
    catanCompleted: boolean;
    festivalUnlocked: boolean;
    festivalSeen: boolean;
    fishingChestEligible: boolean;
    reservoirChestOpened: boolean;
    playerCoins: number;
    timeOfDay: "day" | "night";
    candleLightsOn: boolean;
  };
};

type LoadableSceneId = Extract<SceneId, "map" | "shrimp" | "catan">;
type MapFestivalMode = "idle" | "prelude" | "celebrating" | "settled";

export async function createPhaserGame(
  container: HTMLDivElement,
  eventBus: EventBus,
  bootState: PhaserBootState,
) {
  const runtime = await loadPhaserRuntime();
  const { Phaser } = runtime;
  const debugEnabled =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("debugPhaser") === "1";

  const game = new Phaser.Game({
    type: bootState.rendererType ?? Phaser.AUTO,
    width: 960,
    height: 540,
    parent: container,
    backgroundColor: "#0b1620",
    audio: {
      disableWebAudio: true,
    },
    physics: {
      default: "arcade",
      arcade: {
        debug: false,
      },
    },
    scene: [],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });

  let latestMapState = bootState.mapState;
  let latestFestivalMode: MapFestivalMode = "idle";
  let latestCatanState: CatanBoardSnapshot | null = null;
  let latestCatanRebuildState: CatanMatchSnapshot | null = null;
  let latestShrimpStart = {
    sessionIndex: 0,
    playerCoins: 0,
    playerPrawnTotal: 0,
  };
  let desiredActiveScene: LoadableSceneId | null = bootState.initialSceneId;
  let destroyed = false;
  let gameReady = false;
  let bootProbeTimer: number | null = null;
  let sceneHealTimer: number | null = null;
  const sceneLoadPromises = new Map<LoadableSceneId, Promise<void>>();
  const sceneLoadRetryCounts = new Map<LoadableSceneId, number>();
  const pendingSceneLoads = new Set<LoadableSceneId>();
  const pendingSceneUnloads = new Set<LoadableSceneId>();
  const maxSceneLoadRetries = 2;

  function getManagedScene(sceneId: LoadableSceneId) {
    const sceneKey = sceneKeyBySceneId[sceneId];
    const scene = game.scene.keys[sceneKey];

    return scene ?? null;
  }

  function getManagedSceneIds() {
    return (["map", "shrimp", "catan"] as LoadableSceneId[]).filter((sceneId) => Boolean(getManagedScene(sceneId)));
  }

  function getActiveSceneIds() {
    return (["map", "shrimp", "catan"] as LoadableSceneId[]).filter((sceneId) => {
      const scene = getManagedScene(sceneId);
      return Boolean(scene && scene.scene.isActive() && scene.scene.isVisible());
    });
  }

  function getSleepingSceneIds() {
    return (["map", "shrimp", "catan"] as LoadableSceneId[]).filter((sceneId) => {
      const scene = getManagedScene(sceneId);
      return Boolean(scene && scene.scene.isSleeping());
    });
  }

  function emitDebugState(reason: string) {
    if (!debugEnabled) {
      return;
    }

    eventBus.events.emit("phaser/debug-state", {
      reason,
      gameReady,
      managedSceneIds: getManagedSceneIds(),
      activeSceneIds: getActiveSceneIds(),
      sleepingSceneIds: getSleepingSceneIds(),
      pendingSceneLoads: [...pendingSceneLoads],
      pendingSceneUnloads: [...pendingSceneUnloads],
    });
  }

  async function ensureSceneLoaded(sceneId: LoadableSceneId) {
    if (getManagedScene(sceneId) || sceneLoadPromises.has(sceneId)) {
      return sceneLoadPromises.get(sceneId) ?? Promise.resolve();
    }

    const loadPromise = (async () => {
      const SceneConstructor = await loadPhaserScene(sceneId);
      if (destroyed || getManagedScene(sceneId)) {
        return;
      }

      game.scene.add(sceneKeyBySceneId[sceneId], new SceneConstructor(eventBus), false);
      emitDebugState(`scene-added:${sceneId}`);
    })().finally(() => {
      sceneLoadPromises.delete(sceneId);
      emitDebugState(`scene-add-finished:${sceneId}`);
    });

    sceneLoadPromises.set(sceneId, loadPromise);
    return loadPromise;
  }

  function activateScene(sceneId: LoadableSceneId) {
    if (destroyed) {
      return;
    }

    const scene = getManagedScene(sceneId);
    const sceneKey = sceneKeyBySceneId[sceneId];

    if (!scene) {
      return;
    }

    if (scene.scene.isSleeping()) {
      game.scene.wake(sceneKey);
    }

    if (!scene.scene.isActive()) {
      game.scene.run(sceneKey);
    }

    scene.scene.setVisible(true);

    window.setTimeout(() => {
      if (destroyed) {
        return;
      }

      const latestScene = getManagedScene(sceneId);
      if (!latestScene) {
        return;
      }

      if (!latestScene.scene.isActive()) {
        game.scene.run(sceneKey);
        latestScene.scene.setVisible(true);
        emitDebugState(`scene-run-retry:${sceneId}`);
      }
    }, 32);
    emitDebugState(`scene-activated:${sceneId}`);

    if (sceneId === "map") {
      eventBus.commands.emit("map/show-state", latestMapState);
      eventBus.commands.emit("map/festival-mode", { mode: latestFestivalMode });
    }

    if (sceneId === "catan") {
      if (latestCatanState) {
        eventBus.commands.emit("catan/show-state", latestCatanState);
      }

      if (latestCatanRebuildState) {
        eventBus.commands.emit("catan/rebuild-show-state", latestCatanRebuildState);
      }
    }

    if (sceneId === "shrimp") {
      eventBus.commands.emit("shrimp/start", latestShrimpStart);
    }
  }

  function unloadScene(sceneId: LoadableSceneId) {
    if (destroyed) {
      return;
    }

    const scene = getManagedScene(sceneId);
    const sceneKey = sceneKeyBySceneId[sceneId];
    if (!scene) {
      return;
    }

    scene.scene.setVisible(false);
    game.scene.sleep(sceneKey);
    emitDebugState(`scene-slept:${sceneId}`);
  }

  function queueSceneLoad(sceneId: LoadableSceneId) {
    pendingSceneUnloads.delete(sceneId);
    pendingSceneLoads.add(sceneId);
    emitDebugState(`scene-queued-load:${sceneId}`);
  }

  function queueSceneUnload(sceneId: LoadableSceneId) {
    pendingSceneLoads.delete(sceneId);
    pendingSceneUnloads.add(sceneId);
    emitDebugState(`scene-queued-unload:${sceneId}`);
  }

  function loadSceneWithRetry(sceneId: LoadableSceneId) {
    const tryLoadScene = () => {
      void ensureSceneLoaded(sceneId)
        .then(() => {
          sceneLoadRetryCounts.delete(sceneId);
          activateScene(sceneId);
          emitDebugState(`scene-load-success:${sceneId}`);
        })
        .catch((error) => {
          const retryCount = sceneLoadRetryCounts.get(sceneId) ?? 0;
          if (retryCount < maxSceneLoadRetries && !destroyed) {
            sceneLoadRetryCounts.set(sceneId, retryCount + 1);
            window.setTimeout(() => {
              if (!destroyed) {
                tryLoadScene();
              }
            }, 180);
            return;
          }

          sceneLoadRetryCounts.delete(sceneId);
          const message = error instanceof Error ? error.message : String(error);
          eventBus.events.emit("system/error", {
            source: `scene/load:${sceneId}`,
            message,
            code: `${sceneId}_scene_load_failed`,
            recoverable: sceneId === "catan",
            actionHint: sceneId === "catan" ? "点击“重试加载卡坦”重新初始化舞台。" : undefined,
          });
          emitDebugState(`scene-load-failed:${sceneId}`);
        });
    };

    tryLoadScene();
  }

  function flushPendingSceneCommands() {
    if (destroyed || !gameReady) {
      return;
    }

    pendingSceneUnloads.forEach((sceneId) => {
      unloadScene(sceneId);
    });
    pendingSceneUnloads.clear();

    pendingSceneLoads.forEach((sceneId) => {
      loadSceneWithRetry(sceneId);
    });
    pendingSceneLoads.clear();
    emitDebugState("pending-flushed");
  }

  function markGameReady() {
    if (destroyed || gameReady) {
      return;
    }

    gameReady = true;
    if (bootProbeTimer !== null) {
      window.clearInterval(bootProbeTimer);
      bootProbeTimer = null;
    }
    flushPendingSceneCommands();
    loadSceneWithRetry(bootState.initialSceneId);
    emitDebugState("initial-scene-activate-requested");
    emitDebugState("game-ready");
  }

  function requestSceneLoad(sceneId: LoadableSceneId) {
    desiredActiveScene = sceneId;
    if (!gameReady) {
      queueSceneLoad(sceneId);
      return;
    }

    loadSceneWithRetry(sceneId);
    emitDebugState(`scene-request-load:${sceneId}`);
  }

  function requestSceneUnload(sceneId: LoadableSceneId) {
    if (desiredActiveScene === sceneId) {
      desiredActiveScene = null;
    }
    if (!gameReady) {
      queueSceneUnload(sceneId);
      return;
    }

    unloadScene(sceneId);
    emitDebugState(`scene-request-unload:${sceneId}`);
  }

  const commandCleanups = [
    eventBus.commands.subscribe("scene/load", ({ sceneId }) => {
      if (sceneId !== "map" && sceneId !== "shrimp" && sceneId !== "catan") {
        return;
      }
      requestSceneLoad(sceneId);
    }),
    eventBus.commands.subscribe("scene/unload", ({ sceneId }) => {
      if (sceneId !== "map" && sceneId !== "shrimp" && sceneId !== "catan") {
        return;
      }
      requestSceneUnload(sceneId);
    }),
    eventBus.commands.subscribe("map/show-state", (payload) => {
      latestMapState = payload;
    }),
    eventBus.commands.subscribe("map/festival-mode", ({ mode }) => {
      latestFestivalMode = mode;
    }),
    eventBus.commands.subscribe("catan/show-state", (payload) => {
      latestCatanState = payload;
    }),
    eventBus.commands.subscribe("catan/rebuild-show-state", (payload) => {
      latestCatanRebuildState = payload;
    }),
    eventBus.commands.subscribe("shrimp/start", (payload) => {
      latestShrimpStart = payload;
    }),
  ];

  eventBus.commands.emit("map/show-state", bootState.mapState);
  eventBus.commands.emit("map/festival-mode", { mode: latestFestivalMode });
  emitDebugState("boot-init");
  requestSceneLoad(bootState.initialSceneId);
  (["map", "shrimp", "catan"] as LoadableSceneId[]).forEach((sceneId) => {
    if (sceneId !== bootState.initialSceneId) {
      requestSceneUnload(sceneId);
    }
  });

  game.events.once(Phaser.Core.Events.READY, () => {
    markGameReady();
    emitDebugState("phaser-ready-event");
  });

  const checkBooted = () => {
    const maybeBootedGame = game as Phaser.Game & { isBooted?: boolean };
    if (maybeBootedGame.isBooted) {
      markGameReady();
    }
  };

  checkBooted();
  if (!gameReady) {
    bootProbeTimer = window.setInterval(() => {
      checkBooted();
      if (gameReady && bootProbeTimer !== null) {
        window.clearInterval(bootProbeTimer);
        bootProbeTimer = null;
      }
    }, 80);
  }

  sceneHealTimer = window.setInterval(() => {
    if (!gameReady || destroyed || !desiredActiveScene) {
      return;
    }

    const activeSceneIds = getActiveSceneIds();
    if (activeSceneIds.includes(desiredActiveScene)) {
      return;
    }

    const targetScene = getManagedScene(desiredActiveScene);
    if (!targetScene) {
      loadSceneWithRetry(desiredActiveScene);
      emitDebugState(`scene-autoheal-load:${desiredActiveScene}`);
      return;
    }

    activateScene(desiredActiveScene);
    emitDebugState(`scene-autoheal-activate:${desiredActiveScene}`);
  }, 180);

  game.events.once(Phaser.Core.Events.DESTROY, () => {
    destroyed = true;
    if (bootProbeTimer !== null) {
      window.clearInterval(bootProbeTimer);
      bootProbeTimer = null;
    }
    if (sceneHealTimer !== null) {
      window.clearInterval(sceneHealTimer);
      sceneHealTimer = null;
    }
    commandCleanups.forEach((cleanup) => cleanup());
    emitDebugState("game-destroyed");
  });

  setGameInstance(game);
  return game;
}
