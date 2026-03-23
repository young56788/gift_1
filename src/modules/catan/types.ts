export type ResourceKey = "wood" | "brick" | "grain" | "ore" | "wool";

export type DevelopmentCardKey = "knight" | "harvest" | "roadBuilding";

export type ResourceState = Record<ResourceKey, number>;

export type ResourceDelta = Partial<ResourceState>;

export type DevelopmentCardState = Record<DevelopmentCardKey, number>;

export type CatanPhase = "opening" | "turning" | "closing" | "won";

export type OpponentKey = "leah" | "sam";

export type OpponentState = Record<OpponentKey, number>;

export type CatanActionTarget = {
  kind: "road" | "node";
  id: number;
};

export type BoardOwner = "player" | OpponentKey;

export type CatanBuildKind = "road" | "settlement" | "city";

export type CatanRoadState = {
  id: number;
  owner: BoardOwner;
  emphasis?: boolean;
};

export type CatanNodeState = {
  id: number;
  owner: BoardOwner;
  level: "settlement" | "city";
};

export type CatanDiceState = {
  left: number;
  right: number;
  total: number;
};

export type CatanProductionState = {
  note: string;
  activatedTileIds: number[];
  player: ResourceDelta;
  opponents: Partial<Record<OpponentKey, ResourceDelta>>;
};

export type CatanRobberState = {
  tileId: number;
  note: string;
  targetOwner: BoardOwner;
};

export type CatanStealState = {
  resource: ResourceKey;
  thief: BoardOwner;
  victim: BoardOwner;
};

export type CatanAwardState = {
  longestRoadOwner: BoardOwner | null;
  largestArmyOwner: BoardOwner | null;
  roadLengths: Record<BoardOwner, number>;
  knightCounts: Record<BoardOwner, number>;
  bonusPoints: Record<BoardOwner, number>;
};

export type CatanDevelopmentEventState = {
  owner: BoardOwner;
  used: DevelopmentCardKey | null;
  gained: Partial<DevelopmentCardState>;
  note: string;
  target: CatanActionTarget | null;
};

export type CatanBoardSnapshot = {
  turn: number;
  phase: CatanPhase;
  title: string;
  summary: string;
  activeActionLabel: string | null;
  completed: boolean;
  playerPoints: number;
  opponents: OpponentState;
  robberTileId: number;
  robber: CatanRobberState;
  recentSteal: CatanStealState | null;
  recentDevelopmentEvent: CatanDevelopmentEventState | null;
  awards: CatanAwardState;
  dice: CatanDiceState;
  production: CatanProductionState;
  developmentCards: DevelopmentCardState;
  roads: CatanRoadState[];
  nodes: CatanNodeState[];
  choices: Array<{
    id: string;
    label: string;
    description: string;
    preview: string | null;
    targetLabel: string;
    recommended: boolean;
    disabled: boolean;
    target: CatanActionTarget;
  }>;
  latestLog: string[];
};

export type CatanBoardState = {
  roads: CatanRoadState[];
  nodes: CatanNodeState[];
};

export type ScriptedAction = {
  id: string;
  label: string;
  description: string;
  target: CatanActionTarget;
  build?: {
    kind: CatanBuildKind;
  };
  gainDevelopmentCards?: Partial<DevelopmentCardState>;
  useDevelopmentCard?: DevelopmentCardKey;
  spend?: ResourceDelta;
  gain?: ResourceDelta;
  pointGain: number;
  playerLine: string;
  npcLine: string;
  opponentGain?: Partial<OpponentState>;
  steal?: ResourceKey;
  stealBy?: OpponentKey;
  recommended?: boolean;
};

export type ScriptedTurn = {
  turn: number;
  title: string;
  phase: Exclude<CatanPhase, "won">;
  dice: [number, number];
  robber: CatanRobberState;
  production: CatanProductionState;
  sceneLine: string;
  mood: string;
  actions: ScriptedAction[];
};

export type ScriptedCatanState = {
  turnIndex: number;
  phase: CatanPhase;
  playerPoints: number;
  opponents: OpponentState;
  board: CatanBoardState;
  developmentCards: DevelopmentCardState;
  resources: ResourceState;
  log: string[];
  summary: string;
  recentSteal: CatanStealState | null;
  recentDevelopmentEvent: CatanDevelopmentEventState | null;
  completed: boolean;
};
