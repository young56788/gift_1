export type PhaserRuntime = {
  Phaser: typeof import("phaser");
  MapScene: typeof import("../modules/map/scenes/MapScene").MapScene;
  ShrimpScene: typeof import("../modules/shrimp/scenes/ShrimpScene").ShrimpScene;
  CatanGameScene: typeof import("../modules/catan/scenes/CatanGameScene").CatanGameScene;
};

let runtimePromise: Promise<PhaserRuntime> | null = null;

export function loadPhaserRuntime() {
  if (!runtimePromise) {
    runtimePromise = Promise.all([
      import("phaser/src/phaser-core.js"),
      import("phaser/src/geom/index.js"),
      import("../modules/map/scenes/MapScene"),
      import("../modules/shrimp/scenes/ShrimpScene"),
      import("../modules/catan/scenes/CatanGameScene"),
    ]).then(([phaserCoreModule, geomModule, mapScene, shrimpScene, catanScene]) => {
      const phaserCore = (phaserCoreModule as { default?: Record<string, unknown> }).default ?? phaserCoreModule;
      const geom = (geomModule as { default?: Record<string, unknown> }).default ?? geomModule;

      return {
        Phaser: {
          ...phaserCore,
          Geom: geom,
        } as typeof import("phaser"),
        MapScene: mapScene.MapScene,
        ShrimpScene: shrimpScene.ShrimpScene,
        CatanGameScene: catanScene.CatanGameScene,
      };
    });
  }

  return runtimePromise;
}
