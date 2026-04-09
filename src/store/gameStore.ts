import { create } from "zustand";
import { shrimpReward, shrimpSceneTuning } from "../modules/shrimp/config/content";
import type { GameState, SceneId } from "./types";

const jadePendantItemId = "jade_pendant";

type GameStore = GameState & {
  setCurrentScene: (scene: SceneId) => void;
  setOverlayMessage: (message: string | null) => void;
  setFestivalSequenceActive: (active: boolean) => void;
  setMapTimeOfDay: (timeOfDay: "day" | "night") => void;
  setMapCandleLightsOn: (on: boolean) => void;
  markShrimpCompleted: (payload: {
    normalCatchCount: number;
    specialItemFound: boolean;
    prawnCount: number;
    totalCatchCount: number;
    sessionQualifiedForChest: boolean;
    coinDelta: number;
    prawnTotalAfterSession: number;
  }) => void;
  markReservoirChestOpened: () => void;
  markCatanCompleted: () => void;
  markFestivalSeen: () => void;
};

const initialState: GameState = {
  player: {
    name: "橙橙",
    coins: shrimpSceneTuning.economy.initialCoins,
    prawnTotal: 0,
  },
  inventory: {
    specialItemFound: false,
    specialItemId: null,
    jadePendantFound: false,
    jadePendantItemId: null,
  },
  progress: {
    shrimpCompleted: false,
    shrimpSessionsPlayed: 0,
    catanCompleted: false,
    festivalUnlocked: false,
    festivalSeen: false,
    fishingChestEligible: false,
    reservoirChestOpened: false,
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
  markShrimpCompleted: ({ specialItemFound, prawnCount, coinDelta }) =>
    set((state) => {
      const catanCompleted = state.progress.catanCompleted;
      const nextPrawnTotal = state.player.prawnTotal + prawnCount;
      const qualifiedForChest =
        nextPrawnTotal >= shrimpSceneTuning.requiredPrawnTotalForReward;

      return {
        player: {
          ...state.player,
          coins: state.player.coins + coinDelta,
          prawnTotal: nextPrawnTotal,
        },
        inventory: {
          ...state.inventory,
          specialItemFound:
            state.inventory.specialItemFound || specialItemFound,
          specialItemId:
            state.inventory.specialItemId ??
            (specialItemFound ? shrimpReward.specialItemId : null),
        },
        progress: {
          ...state.progress,
          shrimpCompleted: true,
          shrimpSessionsPlayed: state.progress.shrimpSessionsPlayed + 1,
          festivalUnlocked: catanCompleted,
          fishingChestEligible:
            state.progress.fishingChestEligible || qualifiedForChest,
        },
      };
    }),
  markReservoirChestOpened: () =>
    set((state) => ({
      inventory: {
        ...state.inventory,
        jadePendantFound: true,
        jadePendantItemId: state.inventory.jadePendantItemId ?? jadePendantItemId,
      },
      progress: {
        ...state.progress,
        reservoirChestOpened: true,
      },
    })),
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
