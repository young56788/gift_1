import type { SceneId } from "../store/types";
import type { CatanBoardSnapshot } from "../modules/catan/types";
import type { CatanIntent, CatanMatchSnapshot } from "../modules/catan/engineTypes";

export type PhaserCommandMap = {
  "scene/load": { sceneId: SceneId };
  "scene/unload": { sceneId: SceneId };
  "map/show-state": {
    shrimpCompleted: boolean;
    catanCompleted: boolean;
    festivalUnlocked: boolean;
    festivalSeen: boolean;
    fishingChestEligible: boolean;
    reservoirChestUnlocked: boolean;
    reservoirChestOpened: boolean;
    playerCoins: number;
    timeOfDay: "day" | "night";
    candleLightsOn: boolean;
  };
  "map/festival-mode": { mode: "idle" | "prelude" | "celebrating" | "settled" };
  "map/festival-crowd-cue": { cue: "left" | "right" | "center" | "all" };
  "catan/show-state": CatanBoardSnapshot;
  "catan/rebuild-show-state": CatanMatchSnapshot;
  "shrimp/start": {
    sessionIndex: number;
    playerCoins: number;
    playerPrawnTotal: number;
  };
  "phaser/pause": undefined;
  "phaser/resume": undefined;
};

export type PhaserEventMap = {
  "map/enter-request": { target: "shrimp" | "catan" | "festival" };
  "map/festival-easter-egg-request": undefined;
  "map/festival-gift-opened": { amountText: string; redeemCode: string };
  "map/reservoir-chest-opened": { itemId: string; itemLabel: string };
  "catan/action-selected": { actionId: string };
  "catan/request-state": undefined;
  "catan/rebuild-intent-selected": { intent: CatanIntent };
  "catan/rebuild-request-state": undefined;
  "shrimp/completed": {
    completed: boolean;
    normalCatchCount: number;
    specialItemFound: boolean;
    prawnCount: number;
    totalCatchCount: number;
    sessionQualifiedForChest: boolean;
    castCount: number;
    perfectCount: number;
    goodCount: number;
    missCount: number;
    timeoutCount: number;
    catchBreakdown: {
      silverFish: number;
      carp: number;
      bass: number;
      catfish: number;
      prawn: number;
    };
    sessionCost: number;
    sessionSurcharge: number;
    sessionReward: number;
    coinDelta: number;
    prawnTotalAfterSession: number;
  };
  "shrimp/exit": {
    completed: boolean;
  };
  "system/error": {
    source: string;
    message: string;
    code?: string;
    recoverable?: boolean;
    actionHint?: string;
  };
  "phaser/debug-state": {
    reason: string;
    gameReady: boolean;
    managedSceneIds: Array<"map" | "shrimp" | "catan">;
    activeSceneIds: Array<"map" | "shrimp" | "catan">;
    sleepingSceneIds: Array<"map" | "shrimp" | "catan">;
    pendingSceneLoads: Array<"map" | "shrimp" | "catan">;
    pendingSceneUnloads: Array<"map" | "shrimp" | "catan">;
  };
};

export type EventHandler<TPayload> = (payload: TPayload) => void;
