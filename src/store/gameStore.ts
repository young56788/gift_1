import { create } from "zustand";
import { shrimpReward } from "../modules/shrimp/config/content";
import type { GameState, SceneId } from "./types";

type GameStore = GameState & {
  setCurrentScene: (scene: SceneId) => void;
  setOverlayMessage: (message: string | null) => void;
  setFestivalSequenceActive: (active: boolean) => void;
  setMapTimeOfDay: (timeOfDay: "day" | "night") => void;
  setMapCandleLightsOn: (on: boolean) => void;
  markShrimpCompleted: (payload: {
    normalCatchCount: number;
    specialItemFound: boolean;
  }) => void;
  markCatanCompleted: () => void;
  markFestivalSeen: () => void;
};

const initialState: GameState = {
  player: {
    name: "橙橙",
  },
  inventory: {
    specialItemFound: false,
    specialItemId: null,
  },
  progress: {
    shrimpCompleted: false,
    catanCompleted: false,
    festivalUnlocked: false,
    festivalSeen: false,
  },
  ui: {
    currentScene: "map",
    overlayMessage: null,
    lowPowerMode: false,
    festivalSequenceActive: false,
    mapTimeOfDay: "day",
    mapCandleLightsOn: false,
  },
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,
  setCurrentScene: (scene) =>
    set((state) => ({
      ui: {
        ...state.ui,
        currentScene: scene,
      },
    })),
  setOverlayMessage: (message) =>
    set((state) => ({
      ui: {
        ...state.ui,
        overlayMessage: message,
      },
    })),
  setFestivalSequenceActive: (active) =>
    set((state) => ({
      ui: {
        ...state.ui,
        festivalSequenceActive: active,
      },
    })),
  setMapTimeOfDay: (timeOfDay) =>
    set((state) => ({
      ui: {
        ...state.ui,
        mapTimeOfDay: timeOfDay,
      },
    })),
  setMapCandleLightsOn: (on) =>
    set((state) => ({
      ui: {
        ...state.ui,
        mapCandleLightsOn: on,
      },
    })),
  markShrimpCompleted: ({ specialItemFound }) =>
    set((state) => {
      const catanCompleted = state.progress.catanCompleted;

      return {
        inventory: {
          specialItemFound:
            state.inventory.specialItemFound || specialItemFound,
          specialItemId:
            state.inventory.specialItemId ??
            (specialItemFound ? shrimpReward.specialItemId : null),
        },
        progress: {
          ...state.progress,
          shrimpCompleted: true,
          festivalUnlocked: catanCompleted,
        },
      };
    }),
  markCatanCompleted: () =>
    set((state) => ({
      progress: {
        ...state.progress,
        catanCompleted: true,
        festivalUnlocked: state.progress.shrimpCompleted,
      },
    })),
  markFestivalSeen: () =>
    set((state) => ({
      progress: {
        ...state.progress,
        festivalSeen: true,
      },
    })),
}));
