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
  };
  "catan/show-state": CatanBoardSnapshot;
  "catan/rebuild-show-state": CatanMatchSnapshot;
  "shrimp/start": undefined;
  "phaser/pause": undefined;
  "phaser/resume": undefined;
};

export type PhaserEventMap = {
  "map/enter-request": { target: "shrimp" | "catan" | "festival" };
  "catan/action-selected": { actionId: string };
  "catan/request-state": undefined;
  "catan/rebuild-intent-selected": { intent: CatanIntent };
  "catan/rebuild-request-state": undefined;
  "shrimp/completed": {
    completed: boolean;
    normalCatchCount: number;
    specialItemFound: boolean;
  };
  "shrimp/exit": {
    completed: boolean;
  };
  "system/error": {
    source: string;
    message: string;
  };
};

export type EventHandler<TPayload> = (payload: TPayload) => void;
