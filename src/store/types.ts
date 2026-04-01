export type SceneId = "intro" | "map" | "shrimp" | "catan" | "festival";

export type InventoryState = {
  specialItemFound: boolean;
  specialItemId: string | null;
};

export type ProgressState = {
  shrimpCompleted: boolean;
  catanCompleted: boolean;
  festivalUnlocked: boolean;
  festivalSeen: boolean;
};

export type PlayerState = {
  name: string;
};

export type UiState = {
  currentScene: SceneId;
  overlayMessage: string | null;
  lowPowerMode: boolean;
  festivalSequenceActive: boolean;
  mapTimeOfDay: "day" | "night";
  mapCandleLightsOn: boolean;
};

export type GameState = {
  player: PlayerState;
  inventory: InventoryState;
  progress: ProgressState;
  ui: UiState;
};
