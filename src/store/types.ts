export type SceneId = "intro" | "map" | "shrimp" | "catan" | "festival";

export type InventoryState = {
  specialItemFound: boolean;
  specialItemId: string | null;
  jadePendantFound: boolean;
  jadePendantItemId: string | null;
};

export type ProgressState = {
  shrimpCompleted: boolean;
  shrimpSessionsPlayed: number;
  catanCompleted: boolean;
  festivalUnlocked: boolean;
  festivalSeen: boolean;
  fishingChestEligible: boolean;
  reservoirChestUnlocked: boolean;
  reservoirChestOpened: boolean;
};

export type PlayerState = {
  name: string;
  coins: number;
  prawnTotal: number;
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
