export const sceneKeys = {
  map: "map-scene",
  shrimp: "shrimp-scene",
  catan: "catan-scene",
} as const;

export const sceneKeyBySceneId = {
  map: sceneKeys.map,
  shrimp: sceneKeys.shrimp,
  catan: sceneKeys.catan,
} as const;
