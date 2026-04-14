import type { EventBus } from "../bus/createEventBus";

export type LoadablePhaserSceneId = "map" | "shrimp" | "catan";

export type PhaserRuntime = {
  Phaser: typeof import("phaser");
};

export type PhaserSceneConstructor = new (bus: EventBus) => import("phaser").Scene;

let runtimePromise: Promise<PhaserRuntime> | null = null;
const scenePromiseById: Partial<Record<LoadablePhaserSceneId, Promise<PhaserSceneConstructor>>> = {};

export function loadPhaserRuntime() {
  if (!runtimePromise) {
    runtimePromise = import("phaser").then((phaserModule) => {
      return {
        Phaser: (phaserModule as { default?: typeof import("phaser") }).default ?? phaserModule,
      };
    });
  }

  return runtimePromise;
}

export function loadPhaserScene(sceneId: LoadablePhaserSceneId) {
  if (!scenePromiseById[sceneId]) {
    scenePromiseById[sceneId] = (() => {
      switch (sceneId) {
        case "map":
          return import("../modules/map/scenes/MapScene").then(
            ({ MapScene }) => MapScene as PhaserSceneConstructor,
          );
        case "shrimp":
          return import("../modules/shrimp/scenes/ShrimpScene").then(
            ({ ShrimpScene }) => ShrimpScene as PhaserSceneConstructor,
          );
        case "catan":
          return import("../modules/catan/scenes/CatanGameScene").then(
            ({ CatanGameScene }) => CatanGameScene as PhaserSceneConstructor,
          );
      }
    })();
  }

  return scenePromiseById[sceneId] as Promise<PhaserSceneConstructor>;
}
