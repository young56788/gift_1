export type CatanResource = "wood" | "brick" | "grain" | "ore" | "wool";
export type CatanPortKind = "three-for-one" | CatanResource;
export type CatanDevelopmentCard = "knight" | "harvest" | "roadBuilding" | "monopoly" | "victoryPoint";

export type CatanTileType =
  | "forest"
  | "hills"
  | "pasture"
  | "fields"
  | "mountains"
  | "desert";

export type CatanPlayerId = "player" | "leah" | "sam";
export type CatanMomentumPhase = "pressure" | "release" | "comeback";

export type CatanPhase =
  | "setup-settlement"
  | "setup-road"
  | "roll"
  | "robber-discard"
  | "robber"
  | "robber-steal"
  | "trade"
  | "build"
  | "gameOver";

export type CatanBuildingLevel = "settlement" | "city";

export type CatanResourceState = Record<CatanResource, number>;

export type CatanTileState = {
  id: number;
  type: CatanTileType;
  number: number | null;
  q: number;
  r: number;
  x: number;
  y: number;
  nodeIds: number[];
  edgeIds: number[];
};

export type CatanNodeState = {
  id: number;
  x: number;
  y: number;
  adjacentTileIds: number[];
  adjacentNodeIds: number[];
  adjacentEdgeIds: number[];
};

export type CatanEdgeState = {
  id: number;
  nodeIds: [number, number];
  adjacentTileIds: number[];
};

export type CatanPortState = {
  id: number;
  kind: CatanPortKind;
  x: number;
  y: number;
  edgeId: number;
  nodeIds: [number, number];
};

export type CatanGraph = {
  tiles: CatanTileState[];
  nodes: CatanNodeState[];
  edges: CatanEdgeState[];
  ports: CatanPortState[];
};

export type CatanNodeOccupancy = {
  owner: CatanPlayerId;
  level: CatanBuildingLevel;
};

export type CatanDiceState = {
  left: number;
  right: number;
  total: number;
};

export type CatanPlayerState = {
  id: CatanPlayerId;
  label: string;
  resources: CatanResourceState;
  developmentCards: Record<CatanDevelopmentCard, number>;
  freshDevelopmentCards: Record<CatanDevelopmentCard, number>;
  bonusVictoryPoints: number;
  victoryPoints: number;
  roadsLeft: number;
  settlementsLeft: number;
  citiesLeft: number;
  knightsPlayed: number;
};

export type CatanMatchState = {
  graph: CatanGraph;
  players: Record<CatanPlayerId, CatanPlayerState>;
  occupiedNodes: Record<number, CatanNodeOccupancy | undefined>;
  occupiedEdges: Record<number, CatanPlayerId | undefined>;
  activePlayerId: CatanPlayerId;
  turnOrder: CatanPlayerId[];
  turnNumber: number;
  phase: CatanPhase;
  robberTileId: number;
  dice: CatanDiceState | null;
  winnerId: CatanPlayerId | null;
  momentumPhase: CatanMomentumPhase;
  momentumAidUsed: Record<CatanPlayerId, boolean>;
  latestLog: string[];
  freeRoadBuildsRemaining: number;
  developmentDeck: CatanDevelopmentCard[];
  robber: {
    discardRemaining: number;
    stealableVictimIds: CatanPlayerId[];
    targetTileId: number | null;
  };
  setup: {
    placementOrder: CatanPlayerId[];
    placementIndex: number;
    pendingRoadNodeId: number | null;
    completed: boolean;
  };
};

export type CatanBuildIntent =
  | {
      type: "build-road";
      edgeId: number;
    }
  | {
      type: "build-settlement";
      nodeId: number;
    }
  | {
      type: "upgrade-city";
      nodeId: number;
    };

export type CatanIntent =
  | {
      type: "roll-dice";
      dice?: [number, number];
    }
  | {
      type: "move-robber";
      tileId: number;
    }
  | {
      type: "discard-resource";
      resource: CatanResource;
    }
  | {
      type: "steal-from-player";
      victimId: CatanPlayerId;
    }
  | {
      type: "trade-bank";
      give: CatanResource;
      receive: CatanResource;
    }
  | {
      type: "trade-port";
      portId: number;
      give: CatanResource;
      receive: CatanResource;
    }
  | {
      type: "trade-npc";
      npcId: Exclude<CatanPlayerId, "player">;
      receive: CatanResource;
      demands: Partial<CatanResourceState>;
    }
  | {
      type: "buy-development-card";
    }
  | {
      type: "play-knight";
    }
  | {
      type: "play-harvest";
      resources: [CatanResource, CatanResource];
    }
  | {
      type: "play-road-building";
    }
  | {
      type: "play-monopoly";
      resource: CatanResource;
    }
  | CatanBuildIntent
  | {
      type: "end-turn";
    };

export type CatanIntentResult = {
  state: CatanMatchState;
  applied: boolean;
  reason?: string;
};

export type CatanMatchSnapshot = {
  turnNumber: number;
  phase: CatanPhase;
  activePlayerId: CatanPlayerId;
  robberTileId: number;
  robberDiscardRemaining: number;
  robberVictimIds: CatanPlayerId[];
  setupPendingNodeId: number | null;
  dice: CatanDiceState | null;
  winnerId: CatanPlayerId | null;
  momentumPhase: CatanMomentumPhase;
  freeRoadBuildsRemaining: number;
  players: Record<CatanPlayerId, Pick<CatanPlayerState, "id" | "label" | "victoryPoints">>;
  occupiedNodes: Record<number, CatanNodeOccupancy | undefined>;
  occupiedEdges: Record<number, CatanPlayerId | undefined>;
  availableRoadEdges: number[];
  availableSettlementNodes: number[];
  availableCityNodes: number[];
  availableRobberTileIds: number[];
  latestLog: string[];
};

export const emptyResources = (): CatanResourceState => ({
  wood: 0,
  brick: 0,
  grain: 0,
  ore: 0,
  wool: 0,
});

export const buildCosts: Record<CatanBuildIntent["type"], Partial<CatanResourceState>> = {
  "build-road": {
    wood: 1,
    brick: 1,
  },
  "build-settlement": {
    wood: 1,
    brick: 1,
    grain: 1,
    wool: 1,
  },
  "upgrade-city": {
    grain: 2,
    ore: 3,
  },
};

export const developmentCardCost: Partial<CatanResourceState> = {
  grain: 1,
  ore: 1,
  wool: 1,
};
