import { create } from "zustand";
import { shrimpReward } from "../modules/shrimp/config/content";
import type { GameState, SceneId } from "./types";

type GameStore = GameState & {
  setCurrentScene: (scene: SceneId) => void;
  setOverlayMessage: (message: string | null) => void;
  markShrimpCompleted: (payload: {
    normalCatchCount: number;
    specialItemFound: boolean;
  }) => void;
  markCatanCompleted: () => void;
  markFestivalSeen: () => void;
};

const initialState: GameState = {
  player: {
    name: "寿星",
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
    currentScene: "intro",
    overlayMessage: null,
    lowPowerMode: false,
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
