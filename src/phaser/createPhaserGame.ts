import type { EventBus } from "../bus/createEventBus";
import type { CatanBoardSnapshot } from "../modules/catan/types";
import type { CatanMatchSnapshot } from "../modules/catan/engineTypes";
import type { SceneId } from "../store/types";
import type Phaser from "phaser";
import { setGameInstance } from "./gameRegistry";
import { sceneKeyBySceneId } from "./sceneKeys";

type PhaserBootState = {
  initialSceneId: Extract<SceneId, "map" | "shrimp" | "catan">;
  mapState: {
    shrimpCompleted: boolean;
    catanCompleted: boolean;
    festivalUnlocked: boolean;
  };
};

type LoadableSceneId = Extract<SceneId, "map" | "shrimp" | "catan">;

export async function createPhaserGame(
  container: HTMLDivElement,
  eventBus: EventBus,
  bootState: PhaserBootState,
) {
  const { default: Phaser } = await import("phaser");

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: 960,
    height: 540,
    parent: container,
    backgroundColor: "#0b1620",
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
  let latestCatanState: CatanBoardSnapshot | null = null;
  let latestCatanRebuildState: CatanMatchSnapshot | null = null;
  let destroyed = false;
  const sceneLoadPromises = new Map<LoadableSceneId, Promise<void>>();

  function getManagedScene(sceneId: LoadableSceneId) {
    const sceneKey = sceneKeyBySceneId[sceneId];
    const scene = game.scene.keys[sceneKey];

    return scene ?? null;
  }

  async function ensureSceneLoaded(sceneId: LoadableSceneId) {
    if (getManagedScene(sceneId) || sceneLoadPromises.has(sceneId)) {
      return sceneLoadPromises.get(sceneId) ?? Promise.resolve();
    }

    const loadPromise = (async () => {
      if (sceneId === "map") {
        const { MapScene } = await import("../modules/map/scenes/MapScene");

        if (destroyed || getManagedScene("map")) {
          return;
        }

        game.scene.add(sceneKeyBySceneId.map, new MapScene(eventBus), false);
        return;
      }

      if (sceneId === "shrimp") {
        const { ShrimpScene } = await import("../modules/shrimp/scenes/ShrimpScene");

        if (destroyed || getManagedScene("shrimp")) {
          return;
        }

        game.scene.add(sceneKeyBySceneId.shrimp, new ShrimpScene(eventBus), false);
        return;
      }

      const { CatanGameScene } = await import("../modules/catan/scenes/CatanGameScene");

      if (destroyed || getManagedScene("catan")) {
        return;
      }

      game.scene.add(sceneKeyBySceneId.catan, new CatanGameScene(eventBus), false);
    })().finally(() => {
      sceneLoadPromises.delete(sceneId);
    });

    sceneLoadPromises.set(sceneId, loadPromise);
    return loadPromise;
  }

  const commandCleanups = [
    eventBus.commands.subscribe("scene/load", ({ sceneId }) => {
      if (sceneId !== "map" && sceneId !== "shrimp" && sceneId !== "catan") {
        return;
      }

      void ensureSceneLoaded(sceneId).then(() => {
        if (destroyed) {
          return;
        }

        const scene = getManagedScene(sceneId);

        if (!scene) {
          return;
        }

        if (scene.scene.isSleeping()) {
          scene.scene.setVisible(true);
          scene.scene.wake();
        } else if (!scene.scene.isActive()) {
          scene.scene.start();
          scene.scene.setVisible(true);
        } else {
          scene.scene.setVisible(true);
        }

        if (sceneId === "map") {
          eventBus.commands.emit("map/show-state", latestMapState);
        }

        if (sceneId === "catan") {
          if (latestCatanState) {
            eventBus.commands.emit("catan/show-state", latestCatanState);
          }

          if (latestCatanRebuildState) {
            eventBus.commands.emit("catan/rebuild-show-state", latestCatanRebuildState);
          }
        }
      });
    }),
    eventBus.commands.subscribe("scene/unload", ({ sceneId }) => {
      if (sceneId !== "map" && sceneId !== "shrimp" && sceneId !== "catan") {
        return;
      }

      const scene = getManagedScene(sceneId);

      if (!scene) {
        return;
      }

      scene.scene.setVisible(false);
      scene.scene.sleep();
    }),
    eventBus.commands.subscribe("map/show-state", (payload) => {
      latestMapState = payload;
    }),
    eventBus.commands.subscribe("catan/show-state", (payload) => {
      latestCatanState = payload;
    }),
    eventBus.commands.subscribe("catan/rebuild-show-state", (payload) => {
      latestCatanRebuildState = payload;
    }),
  ];

  eventBus.commands.emit("map/show-state", bootState.mapState);
  eventBus.commands.emit("scene/load", { sceneId: bootState.initialSceneId });
  (["map", "shrimp", "catan"] as LoadableSceneId[]).forEach((sceneId) => {
    if (sceneId !== bootState.initialSceneId) {
      eventBus.commands.emit("scene/unload", { sceneId });
    }
  });

  game.events.once(Phaser.Core.Events.DESTROY, () => {
    destroyed = true;
    commandCleanups.forEach((cleanup) => cleanup());
  });

  setGameInstance(game);
  return game;
}
