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
      import("phaser"),
      import("../modules/map/scenes/MapScene"),
      import("../modules/shrimp/scenes/ShrimpScene"),
      import("../modules/catan/scenes/CatanGameScene"),
    ]).then(([phaserModule, mapScene, shrimpScene, catanScene]) => {
      return {
        Phaser: (phaserModule as { default?: typeof import("phaser") }).default ?? phaserModule,
        MapScene: mapScene.MapScene,
        ShrimpScene: shrimpScene.ShrimpScene,
        CatanGameScene: catanScene.CatanGameScene,
      };
    });
  }

  return runtimePromise;
}
