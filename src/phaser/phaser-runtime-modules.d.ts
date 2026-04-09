declare module "phaser/src/phaser-core.js" {
  const PhaserCore: typeof import("phaser");
  export = PhaserCore;
}

declare module "phaser/src/geom/index.js" {
  const Geom: typeof import("phaser").Geom;
  export = Geom;
}
