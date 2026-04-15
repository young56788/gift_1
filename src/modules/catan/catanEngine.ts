import { fixedBoardGraph } from "./boardGraph";
import {
  buildCosts,
  developmentCardCost,
  emptyResources,
  type CatanIntent,
  type CatanIntentResult,
  type CatanDevelopmentCard,
  type CatanMatchState,
  type CatanPlayerId,
  type CatanResource,
  type CatanResourceState,
} from "./engineTypes";
import {
  canBuildSetupRoad,
  canBuildSetupSettlement,
  canBuildRoad,
  canBuildSettlement,
  canUpgradeCity,
  getBuildingVictoryPoints,
  getAvailableSetupRoadEdges,
  getAvailableSetupSettlementNodes,
} from "./placementRules";
import { playerHasCoastalTradeAccess } from "./tradeRules";
import { advancePhase, advanceSetupTurn, advanceTurn, getPhaseAfterDice } from "./turnController";

const resourceByTileType: Partial<Record<string, CatanResource>> = {
  forest: "wood",
  hills: "brick",
  fields: "grain",
  mountains: "ore",
  pasture: "wool",
};

const tileTypeLabels = {
  forest: "森林",
  hills: "丘陵",
  fields: "农田",
  mountains: "山地",
  pasture: "牧场",
  desert: "沙漠",
} as const;

const resourceLabels = {
  wood: "木材",
  brick: "砖块",
  grain: "小麦",
  ore: "矿石",
  wool: "羊毛",
} as const;

const developmentCardLabels: Record<CatanDevelopmentCard, string> = {
  knight: "骑士",
  harvest: "丰收",
  roadBuilding: "道路建设",
  monopoly: "垄断",
  victoryPoint: "得分卡",
};

const DICE_TOTAL_PROBABILITY = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1,
} as const;

const DICE_PAIRS_BY_TOTAL: Record<number, Array<[number, number]>> = {
  2: [[1, 1]],
  3: [[1, 2], [2, 1]],
  4: [[1, 3], [2, 2], [3, 1]],
  5: [[1, 4], [2, 3], [3, 2], [4, 1]],
  6: [[1, 5], [2, 4], [3, 3], [4, 2], [5, 1]],
  7: [[1, 6], [2, 5], [3, 4], [4, 3], [5, 2], [6, 1]],
  8: [[2, 6], [3, 5], [4, 4], [5, 3], [6, 2]],
  9: [[3, 6], [4, 5], [5, 4], [6, 3]],
  10: [[4, 6], [5, 5], [6, 4]],
  11: [[5, 6], [6, 5]],
  12: [[6, 6]],
};

const developmentDeckTemplate: CatanDevelopmentCard[] = [
  ...Array.from({ length: 14 }, () => "knight" as const),
  ...Array.from({ length: 5 }, () => "victoryPoint" as const),
  ...Array.from({ length: 2 }, () => "roadBuilding" as const),
  ...Array.from({ length: 2 }, () => "harvest" as const),
  ...Array.from({ length: 2 }, () => "monopoly" as const),
];

function createEmptyDevelopmentCardCounts(): Record<CatanDevelopmentCard, number> {
  return {
    knight: 0,
    harvest: 0,
    roadBuilding: 0,
    monopoly: 0,
    victoryPoint: 0,
  };
}

function createShuffledDevelopmentDeck() {
  const deck = [...developmentDeckTemplate];

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  return deck;
}

function cloneResources(resources: CatanResourceState): CatanResourceState {
  return { ...resources };
}

function canAfford(resources: CatanResourceState, cost: Partial<CatanResourceState>) {
  return Object.entries(cost).every(([resource, count]) => {
    const key = resource as CatanResource;
    return resources[key] >= (count ?? 0);
  });
}

function getCostShortfall(resources: CatanResourceState, cost: Partial<CatanResourceState>) {
  return (Object.entries(cost) as Array<[CatanResource, number]>).reduce((total, [resource, count]) => {
    return total + Math.max((count ?? 0) - resources[resource], 0);
  }, 0);
}

function getMomentumAidBudget(
  state: CatanMatchState,
  playerId: CatanPlayerId,
  category: "build" | "development",
) {
  if (state.momentumAidUsed[playerId]) {
    return 0;
  }

  if (playerId === "player") {
    if (state.momentumPhase !== "comeback") {
      return 0;
    }

    return category === "build" ? 2 : 1;
  }

  if (state.momentumPhase === "pressure") {
    return category === "build" ? 2 : 1;
  }

  if (state.momentumPhase === "release") {
    return category === "build" ? 1 : 0;
  }

  return 0;
}

export function canAffordWithMomentumAssist(
  state: CatanMatchState,
  playerId: CatanPlayerId,
  cost: Partial<CatanResourceState>,
  category: "build" | "development" = "build",
) {
  if (canAfford(state.players[playerId].resources, cost)) {
    return true;
  }

  const shortfall = getCostShortfall(state.players[playerId].resources, cost);
  return shortfall > 0 && shortfall <= getMomentumAidBudget(state, playerId, category);
}

function payCostSoft(resources: CatanResourceState, cost: Partial<CatanResourceState>) {
  const nextResources = cloneResources(resources);

  Object.entries(cost).forEach(([resource, count]) => {
    const key = resource as CatanResource;
    nextResources[key] = Math.max(nextResources[key] - (count ?? 0), 0);
  });

  return nextResources;
}

function maybeUseMomentumAssist(
  state: CatanMatchState,
  playerId: CatanPlayerId,
  cost: Partial<CatanResourceState>,
  category: "build" | "development",
) {
  const shortfall = getCostShortfall(state.players[playerId].resources, cost);
  const budget = getMomentumAidBudget(state, playerId, category);
  const assisted = shortfall > 0 && shortfall <= budget;

  return {
    assisted,
    state: assisted
      ? {
          ...state,
          momentumAidUsed: {
            ...state.momentumAidUsed,
            [playerId]: true,
          },
        }
      : state,
  };
}

function payCost(resources: CatanResourceState, cost: Partial<CatanResourceState>) {
  const nextResources = cloneResources(resources);

  Object.entries(cost).forEach(([resource, count]) => {
    const key = resource as CatanResource;
    nextResources[key] -= count ?? 0;
  });

  return nextResources;
}

function addResource(resources: CatanResourceState, resource: CatanResource, count: number) {
  return {
    ...resources,
    [resource]: resources[resource] + count,
  };
}

function getUsableDevelopmentCardCount(state: CatanMatchState, playerId: CatanPlayerId, card: CatanDevelopmentCard) {
  return Math.max(
    state.players[playerId].developmentCards[card] - state.players[playerId].freshDevelopmentCards[card],
    0,
  );
}

function clearFreshDevelopmentCardsForPlayer(state: CatanMatchState, playerId: CatanPlayerId) {
  return withPlayerUpdate(state, playerId, (currentPlayer) => ({
    ...currentPlayer,
    freshDevelopmentCards: createEmptyDevelopmentCardCounts(),
  }));
}

function removeResource(resources: CatanResourceState, resource: CatanResource, count: number) {
  return {
    ...resources,
    [resource]: Math.max(resources[resource] - count, 0),
  };
}

function getTotalResourceCount(resources: CatanResourceState) {
  return resources.wood + resources.brick + resources.grain + resources.ore + resources.wool;
}

function getMomentumPhase(state: CatanMatchState) {
  const roundNumber = Math.max(Math.ceil(state.turnNumber / state.turnOrder.length), 1);
  const playerPoints = state.players.player.victoryPoints;

  if (playerPoints >= 8 || roundNumber >= 8) {
    return "comeback" as const;
  }

  if (roundNumber <= 4) {
    return "pressure" as const;
  }

  return "release" as const;
}

function syncMomentumPhase(state: CatanMatchState) {
  const nextMomentumPhase = getMomentumPhase(state);

  if (state.momentumPhase === nextMomentumPhase) {
    return state;
  }

  return {
    ...state,
    momentumPhase: nextMomentumPhase,
  };
}

function getProductionScoreForTotal(state: CatanMatchState, playerId: CatanPlayerId, total: number) {
  return Object.entries(state.occupiedNodes).reduce((score, [nodeId, occupancy]) => {
    if (!occupancy || occupancy.owner !== playerId) {
      return score;
    }

    const node = state.graph.nodes[Number(nodeId)];

    if (!node) {
      return score;
    }

    return score + node.adjacentTileIds.reduce((tileScore, tileId) => {
      const tile = state.graph.tiles[tileId];

      if (!tile || tile.id === state.robberTileId || tile.number !== total) {
        return tileScore;
      }

      const buildingWeight = occupancy.level === "city" ? 2 : 1;
      return tileScore + buildingWeight;
    }, 0);
  }, 0);
}

function chooseBiasedDicePair(state: CatanMatchState): [number, number] {
  const momentumPhase = state.momentumPhase;
  const totals = Object.keys(DICE_TOTAL_PROBABILITY).map((value) => Number(value));
  const playerScoreEntries = totals.map((total) => ({
    total,
    baseWeight: DICE_TOTAL_PROBABILITY[total as keyof typeof DICE_TOTAL_PROBABILITY],
    playerScore: getProductionScoreForTotal(state, "player", total),
    opponentScore:
      getProductionScoreForTotal(state, "leah", total) +
      getProductionScoreForTotal(state, "sam", total),
  }));

  const weightedEntries = playerScoreEntries.map((entry) => {
    const pressureBias = entry.opponentScore - entry.playerScore;
    const comebackBias = entry.playerScore - entry.opponentScore;
    const phaseMultiplier =
      momentumPhase === "pressure"
        ? 1 + pressureBias * 0.32
        : momentumPhase === "release"
          ? 1 + comebackBias * 0.1
          : 1 + comebackBias * 0.26;
    const robberBoost =
      entry.total === 7
        ? momentumPhase === "pressure"
          ? 1.28
          : momentumPhase === "comeback"
            ? 0.82
            : 1
        : 1;

    return {
      total: entry.total,
      weight: Math.max(entry.baseWeight * phaseMultiplier * robberBoost, 0.4),
    };
  });

  const totalWeight = weightedEntries.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = Math.random() * totalWeight;
  const selectedTotal =
    weightedEntries.find((entry) => {
      cursor -= entry.weight;
      return cursor <= 0;
    })?.total ?? 7;
  const pairs = DICE_PAIRS_BY_TOTAL[selectedTotal] ?? [[3, 4]];

  return pairs[Math.floor(Math.random() * pairs.length)];
}

function discardForRobber(resources: CatanResourceState) {
  let nextResources = cloneResources(resources);
  let remainingToDiscard = Math.floor(getTotalResourceCount(resources) / 2);
  const discarded: Partial<Record<CatanResource, number>> = {};
  const discardPriority: CatanResource[] = ["grain", "ore", "brick", "wood", "wool"];

  while (remainingToDiscard > 0) {
    const nextResource = discardPriority.find((resource) => nextResources[resource] > 0);

    if (!nextResource) {
      break;
    }

    nextResources = removeResource(nextResources, nextResource, 1);
    discarded[nextResource] = (discarded[nextResource] ?? 0) + 1;
    remainingToDiscard -= 1;
  }

  return {
    resources: nextResources,
    discarded,
  };
}

function formatResourceSummary(resources: Partial<Record<CatanResource, number>>) {
  return Object.entries(resources)
    .filter((entry): entry is [CatanResource, number] => Boolean(entry[1]))
    .map(([resource, count]) => `${resourceLabels[resource]} x${count}`)
    .join("，");
}

function getLargestArmyOwner(state: CatanMatchState) {
  const entries = (Object.keys(state.players) as CatanPlayerId[]).map((playerId) => ({
    playerId,
    count: state.players[playerId].knightsPlayed,
  }));
  const maxCount = Math.max(...entries.map((entry) => entry.count), 0);

  if (maxCount < 3) {
    return null;
  }

  const leaders = entries.filter((entry) => entry.count === maxCount);
  return leaders.length === 1 ? leaders[0].playerId : null;
}

function isNodeBlockedForRoad(state: CatanMatchState, playerId: CatanPlayerId, nodeId: number) {
  const occupant = state.occupiedNodes[nodeId];
  return Boolean(occupant && occupant.owner !== playerId);
}

function getLongestRoadLength(state: CatanMatchState, playerId: CatanPlayerId) {
  const ownedEdges = state.graph.edges.filter((edge) => state.occupiedEdges[edge.id] === playerId);

  if (ownedEdges.length === 0) {
    return 0;
  }

  const adjacentOwnedEdges = new Map<number, number[]>();

  state.graph.nodes.forEach((node) => {
    const ownedAdjacent = node.adjacentEdgeIds.filter((edgeId) => state.occupiedEdges[edgeId] === playerId);
    adjacentOwnedEdges.set(node.id, ownedAdjacent);
  });

  function dfs(edgeId: number, comingFromNodeId: number | null, visited: Set<number>): number {
    const edge = state.graph.edges[edgeId];

    if (!edge) {
      return 0;
    }

    const nextVisited = new Set(visited);
    nextVisited.add(edgeId);
    let best = 1;

    edge.nodeIds.forEach((nodeId) => {
      if (comingFromNodeId !== null && nodeId === comingFromNodeId) {
        return;
      }

      if (isNodeBlockedForRoad(state, playerId, nodeId)) {
        return;
      }

      const candidates = adjacentOwnedEdges.get(nodeId) ?? [];

      candidates.forEach((candidateEdgeId) => {
        if (nextVisited.has(candidateEdgeId)) {
          return;
        }

        best = Math.max(best, 1 + dfs(candidateEdgeId, nodeId, nextVisited));
      });
    });

    return best;
  }

  return ownedEdges.reduce((best, edge) => {
    return Math.max(
      best,
      dfs(edge.id, null, new Set()),
      dfs(edge.id, edge.nodeIds[0], new Set()),
      dfs(edge.id, edge.nodeIds[1], new Set()),
    );
  }, 0);
}

function getLongestRoadOwner(state: CatanMatchState) {
  const entries = (Object.keys(state.players) as CatanPlayerId[]).map((playerId) => ({
    playerId,
    length: getLongestRoadLength(state, playerId),
  }));
  const maxLength = Math.max(...entries.map((entry) => entry.length), 0);

  if (maxLength <= 5) {
    return null;
  }

  const leaders = entries.filter((entry) => entry.length === maxLength);
  return leaders.length === 1 ? leaders[0].playerId : null;
}

function getPlacedSettlementCount(state: CatanMatchState, playerId: CatanPlayerId) {
  return Object.values(state.occupiedNodes).reduce((total, occupancy) => {
    if (!occupancy || occupancy.owner !== playerId) {
      return total;
    }

    return total + 1;
  }, 0);
}

function grantSecondSetupSettlementResources(
  state: CatanMatchState,
  playerId: CatanPlayerId,
  nodeId: number,
) {
  const node = state.graph.nodes[nodeId];

  if (!node) {
    return {
      state,
      lines: [] as string[],
    };
  }

  let nextState = state;
  const gainedResources: Partial<Record<CatanResource, number>> = {};

  node.adjacentTileIds.forEach((tileId) => {
    const tile = state.graph.tiles[tileId];
    const resource = tile ? resourceByTileType[tile.type] : null;

    if (!resource) {
      return;
    }

    gainedResources[resource] = (gainedResources[resource] ?? 0) + 1;
    nextState = withPlayerUpdate(nextState, playerId, (currentPlayer) => ({
      ...currentPlayer,
      resources: addResource(currentPlayer.resources, resource, 1),
    }));
  });

  const lines = Object.entries(gainedResources).length
    ? [
        `第 2 个起始定居点带来资源：${Object.entries(gainedResources)
          .map(([resource, count]) => `${resourceLabels[resource as CatanResource]} x${count}`)
          .join("，")}。`,
      ]
    : ["第 2 个起始定居点邻接沙漠，本次没有获得资源。"];

  return {
    state: nextState,
    lines,
  };
}

function recalculateVictoryPoints(state: CatanMatchState, playerId: CatanPlayerId) {
  const nodePoints = Object.values(state.occupiedNodes).reduce((total, node) => {
    if (!node || node.owner !== playerId) {
      return total;
    }

    return total + getBuildingVictoryPoints(node.level);
  }, 0);

  const largestArmyOwner = getLargestArmyOwner(state);
  const largestArmyPoints = largestArmyOwner === playerId ? 2 : 0;
  const longestRoadOwner = getLongestRoadOwner(state);
  const longestRoadPoints = longestRoadOwner === playerId ? 2 : 0;
  const bonusVictoryPoints = state.players[playerId].bonusVictoryPoints;

  return nodePoints + largestArmyPoints + longestRoadPoints + bonusVictoryPoints;
}

function refreshVictoryPoints(state: CatanMatchState) {
  return {
    ...state,
    players: {
      player: {
        ...state.players.player,
        victoryPoints: recalculateVictoryPoints(state, "player"),
      },
      leah: {
        ...state.players.leah,
        victoryPoints: recalculateVictoryPoints(state, "leah"),
      },
      sam: {
        ...state.players.sam,
        victoryPoints: recalculateVictoryPoints(state, "sam"),
      },
    },
  };
}

function withPlayerUpdate(
  state: CatanMatchState,
  playerId: CatanPlayerId,
  updater: (player: CatanMatchState["players"][CatanPlayerId]) => CatanMatchState["players"][CatanPlayerId],
) {
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: updater(state.players[playerId]),
    },
  };
}

function appendLog(state: CatanMatchState, ...lines: string[]) {
  return {
    ...state,
    latestLog: lines,
  };
}

function chooseComebackBlessingResource(resources: CatanResourceState) {
  const priority: Array<{ resource: CatanResource; target: number }> = [
    { resource: "ore", target: 3 },
    { resource: "grain", target: 2 },
    { resource: "brick", target: 2 },
    { resource: "wood", target: 2 },
    { resource: "wool", target: 1 },
  ];
  const missing = priority
    .map((entry) => ({
      resource: entry.resource,
      deficit: Math.max(entry.target - resources[entry.resource], 0),
    }))
    .sort((left, right) => right.deficit - left.deficit);

  return missing[0]?.deficit > 0 ? missing[0].resource : "grain";
}

function distributeResources(state: CatanMatchState, total: number) {
  let nextState = state;
  const lines: string[] = [`骰子结果 ${total}。`];

  Object.entries(state.occupiedNodes).forEach(([nodeId, occupancy]) => {
    if (!occupancy) {
      return;
    }

    state.graph.nodes[Number(nodeId)].adjacentTileIds.forEach((tileId) => {
      const tile = state.graph.tiles[tileId];

      if (!tile || tile.number !== total || tile.id === state.robberTileId) {
        return;
      }

      const resource = resourceByTileType[tile.type];

      if (!resource) {
        return;
      }

      const gain = occupancy.level === "city" ? 2 : 1;
      nextState = withPlayerUpdate(nextState, occupancy.owner, (player) => ({
        ...player,
        resources: addResource(player.resources, resource, gain),
      }));
      lines.push(
        `${nextState.players[occupancy.owner].label} 从 ${tileTypeLabels[tile.type]} 获得 ${resourceLabels[resource]} x${gain}`,
      );
    });
  });

  if (state.activePlayerId === "player" && state.momentumPhase === "comeback") {
    const blessingResource = chooseComebackBlessingResource(nextState.players.player.resources);
    nextState = withPlayerUpdate(nextState, "player", (player) => ({
      ...player,
      resources: addResource(player.resources, blessingResource, 1),
    }));
    lines.push(`橙橙好运发动，额外获得 ${resourceLabels[blessingResource]} x1。`);
  }

  return appendLog(nextState, ...lines);
}

function applyRobberDiscard(state: CatanMatchState) {
  let nextState = state;
  const lines: string[] = [];
  let playerDiscardRemaining = 0;

  (Object.keys(state.players) as CatanPlayerId[]).forEach((playerId) => {
    const player = nextState.players[playerId];
    const totalResources = getTotalResourceCount(player.resources);

    if (totalResources <= 7) {
      return;
    }

    if (playerId === "player") {
      playerDiscardRemaining = Math.floor(totalResources / 2);
      lines.push(`${player.label} 手牌 ${totalResources} 张，需要手动弃掉 ${playerDiscardRemaining} 张。`);
      return;
    }

    const { resources, discarded } = discardForRobber(player.resources);
    nextState = withPlayerUpdate(nextState, playerId, (currentPlayer) => ({
      ...currentPlayer,
      resources,
    }));
    lines.push(`${player.label} 手牌 ${totalResources} 张，弃掉 ${Math.floor(totalResources / 2)} 张：${formatResourceSummary(discarded)}。`);
  });

  if (lines.length === 0) {
    lines.push("没有玩家超过 7 张手牌，无需弃牌。");
  }

  return {
    state: {
      ...nextState,
      robber: {
        ...nextState.robber,
        discardRemaining: playerDiscardRemaining,
        stealableVictimIds: [],
        targetTileId: null,
      },
    },
    lines,
  };
}

function getRobberVictimIds(state: CatanMatchState, activePlayerId: CatanPlayerId, tileId: number) {
  const tile = state.graph.tiles[tileId];

  if (!tile) {
    return [] as CatanPlayerId[];
  }

  return Array.from(
    new Set(
      tile.nodeIds
        .map((nodeId) => state.occupiedNodes[nodeId]?.owner)
        .filter((owner): owner is CatanPlayerId => Boolean(owner) && owner !== activePlayerId),
    ),
  )
    .filter((playerId) => getTotalResourceCount(state.players[playerId].resources) > 0)
    .sort((left, right) => {
      if (state.momentumPhase === "comeback") {
        if (left === "player") {
          return 1;
        }

        if (right === "player") {
          return -1;
        }

        return 0;
      }

      if (left === "player") {
        return -1;
      }

      if (right === "player") {
        return 1;
      }

      return 0;
    });
}

function resolveRobberSteal(state: CatanMatchState, activePlayerId: CatanPlayerId, victimId: CatanPlayerId | null) {
  if (!victimId) {
    return {
      state,
      lines: ["这块地周围没有可偷取资源的对手。"],
    };
  }

  const victim = state.players[victimId];
  const stealableResources = (Object.keys(victim.resources) as CatanResource[]).filter(
    (resource) => victim.resources[resource] > 0,
  );

  if (stealableResources.length === 0) {
    return {
      state,
      lines: [`${victim.label} 没有资源可偷。`],
    };
  }

  const stolenResource = stealableResources[Math.floor(Math.random() * stealableResources.length)];
  const stolenFromVictimState = withPlayerUpdate(state, victimId, (currentPlayer) => ({
    ...currentPlayer,
    resources: removeResource(currentPlayer.resources, stolenResource, 1),
  }));
  const nextState = withPlayerUpdate(stolenFromVictimState, activePlayerId, (currentPlayer) => ({
    ...currentPlayer,
    resources: addResource(currentPlayer.resources, stolenResource, 1),
  }));

  return {
    state: nextState,
    lines: [`${state.players[activePlayerId].label} 从 ${victim.label} 手里偷到了 1 张${resourceLabels[stolenResource]}。`],
  };
}

function determineWinner(state: CatanMatchState) {
  const winnerEntry = Object.values(state.players).find((player) => player.victoryPoints >= 10);

  if (!winnerEntry) {
    return state;
  }

  return {
    ...state,
    winnerId: winnerEntry.id,
    phase: "gameOver" as const,
    latestLog: [`${winnerEntry.label} 达到 10 分，比赛结束。`],
  };
}

export function createInitialCatanState(): CatanMatchState {
  const occupiedNodes: CatanMatchState["occupiedNodes"] = {};
  const occupiedEdges: CatanMatchState["occupiedEdges"] = {};

  const baseState: CatanMatchState = {
    graph: fixedBoardGraph,
    players: {
      player: {
        id: "player",
        label: "你",
        resources: emptyResources(),
        developmentCards: createEmptyDevelopmentCardCounts(),
        freshDevelopmentCards: createEmptyDevelopmentCardCounts(),
        bonusVictoryPoints: 0,
        victoryPoints: 0,
        roadsLeft: 15,
        settlementsLeft: 5,
        citiesLeft: 4,
        knightsPlayed: 0,
      },
      leah: {
        id: "leah",
        label: "Leah",
        resources: emptyResources(),
        developmentCards: createEmptyDevelopmentCardCounts(),
        freshDevelopmentCards: createEmptyDevelopmentCardCounts(),
        bonusVictoryPoints: 0,
        victoryPoints: 0,
        roadsLeft: 15,
        settlementsLeft: 5,
        citiesLeft: 4,
        knightsPlayed: 0,
      },
      sam: {
        id: "sam",
        label: "Sam",
        resources: emptyResources(),
        developmentCards: createEmptyDevelopmentCardCounts(),
        freshDevelopmentCards: createEmptyDevelopmentCardCounts(),
        bonusVictoryPoints: 0,
        victoryPoints: 0,
        roadsLeft: 15,
        settlementsLeft: 5,
        citiesLeft: 4,
        knightsPlayed: 0,
      },
    },
    occupiedNodes,
    occupiedEdges,
    activePlayerId: "player",
    turnOrder: ["player", "leah", "sam"],
    turnNumber: 0,
    phase: "setup-settlement",
    robberTileId: fixedBoardGraph.tiles.find((tile) => tile.type === "desert")?.id ?? 0,
    dice: null,
    winnerId: null,
    momentumPhase: "pressure",
    momentumAidUsed: {
      player: false,
      leah: false,
      sam: false,
    },
    latestLog: ["空棋盘开局：按 1-2-3-3-2-1 顺序摆放两个起始定居点和道路。"],
    freeRoadBuildsRemaining: 0,
    developmentDeck: createShuffledDevelopmentDeck(),
    robber: {
      discardRemaining: 0,
      stealableVictimIds: [],
      targetTileId: null,
    },
    setup: {
      placementOrder: ["player", "leah", "sam", "sam", "leah", "player"],
      placementIndex: 0,
      pendingRoadNodeId: null,
      completed: false,
    },
  };

  return refreshVictoryPoints(baseState);
}

function setupSettlement(state: CatanMatchState, playerId: CatanPlayerId, nodeId: number) {
  if (state.phase !== "setup-settlement") {
    return { state, applied: false, reason: "当前不是开局放置定居点阶段。" } satisfies CatanIntentResult;
  }

  if (!canBuildSetupSettlement(state, playerId, nodeId)) {
    return { state, applied: false, reason: "这个起始据点当前不能放。" } satisfies CatanIntentResult;
  }

  const isSecondSetupSettlement = getPlacedSettlementCount(state, playerId) >= 1;
  const occupiedNodes = {
    ...state.occupiedNodes,
    [nodeId]: {
      owner: playerId,
      level: "settlement" as const,
    },
  };

  const settlementState = withPlayerUpdate(
    {
      ...state,
      occupiedNodes,
      phase: "setup-road",
      setup: {
        ...state.setup,
        pendingRoadNodeId: nodeId,
      },
    },
    playerId,
    (currentPlayer) => ({
      ...currentPlayer,
      settlementsLeft: currentPlayer.settlementsLeft - 1,
    }),
  );

  const { state: resourceGrantedState, lines: resourceLines } = isSecondSetupSettlement
    ? grantSecondSetupSettlementResources(settlementState, playerId, nodeId)
    : { state: settlementState, lines: [] as string[] };
  const nextState = refreshVictoryPoints(resourceGrantedState);

  return {
    state: appendLog(
      nextState,
      `${state.players[playerId].label} 放下了第 ${isSecondSetupSettlement ? "二" : "一"} 个起始定居点。`,
      ...resourceLines,
      "接下来请选择一条相邻道路。",
    ),
    applied: true,
  } satisfies CatanIntentResult;
}

function setupRoad(state: CatanMatchState, playerId: CatanPlayerId, edgeId: number) {
  if (state.phase !== "setup-road") {
    return { state, applied: false, reason: "当前不是开局放置道路阶段。" } satisfies CatanIntentResult;
  }

  if (!canBuildSetupRoad(state, playerId, edgeId)) {
    return { state, applied: false, reason: "这条起始道路当前不能放。" } satisfies CatanIntentResult;
  }

  const nextState = withPlayerUpdate(
    {
      ...state,
      occupiedEdges: {
        ...state.occupiedEdges,
        [edgeId]: playerId,
      },
    },
    playerId,
    (currentPlayer) => ({
      ...currentPlayer,
      roadsLeft: currentPlayer.roadsLeft - 1,
    }),
  );

  return {
    state: advanceSetupTurn(appendLog(nextState, `${state.players[playerId].label} 放下了起始道路。`)),
    applied: true,
  } satisfies CatanIntentResult;
}

function rollDice(state: CatanMatchState, dice?: [number, number]) {
  if (state.phase !== "roll") {
    return { state, applied: false, reason: "当前不是掷骰阶段。" } satisfies CatanIntentResult;
  }

  const [left, right] = dice ?? chooseBiasedDicePair(state);
  const total = left + right;
  const rolledState = {
    ...state,
    dice: {
      left,
      right,
      total,
    },
  };

  if (total === 7) {
    const { state: discardedState, lines: discardLines } = applyRobberDiscard(rolledState);
    const nextPhase = discardedState.robber.discardRemaining > 0 ? "robber-discard" : getPhaseAfterDice(total);
    return {
      state: appendLog(
        advancePhase(discardedState, nextPhase),
        `骰子结果 ${total}，触发强盗。`,
        ...discardLines,
        ...(discardedState.robber.discardRemaining > 0 ? [] : ["请选择一个陆地地块放置强盗。"]),
      ),
      applied: true,
    } satisfies CatanIntentResult;
  }

  return {
    state: advancePhase(distributeResources(rolledState, total), "trade"),
    applied: true,
  } satisfies CatanIntentResult;
}

function discardResource(state: CatanMatchState, resource: CatanResource) {
  if (state.phase !== "robber-discard") {
    return { state, applied: false, reason: "当前不是弃牌阶段。" } satisfies CatanIntentResult;
  }

  if (state.robber.discardRemaining <= 0) {
    return { state, applied: false, reason: "当前没有需要弃掉的手牌。" } satisfies CatanIntentResult;
  }

  if (state.players.player.resources[resource] <= 0) {
    return { state, applied: false, reason: `你手里没有${resourceLabels[resource]}。` } satisfies CatanIntentResult;
  }

  const nextState = withPlayerUpdate(
    {
      ...state,
      phase: state.robber.discardRemaining === 1 ? "robber" : state.phase,
      robber: {
        ...state.robber,
        discardRemaining: state.robber.discardRemaining - 1,
      },
    },
    "player",
    (currentPlayer) => ({
      ...currentPlayer,
      resources: removeResource(currentPlayer.resources, resource, 1),
    }),
  );

  return {
    state: appendLog(
      nextState,
      `你弃掉了 1 张${resourceLabels[resource]}。`,
      nextState.robber.discardRemaining > 0
        ? `还需要再弃 ${nextState.robber.discardRemaining} 张。`
        : "弃牌完成，请选择一个陆地地块放置强盗。",
    ),
    applied: true,
  } satisfies CatanIntentResult;
}

function moveRobber(state: CatanMatchState, tileId: number) {
  if (state.phase !== "robber") {
    return { state, applied: false, reason: "当前不是强盗阶段。" } satisfies CatanIntentResult;
  }

  if (!state.graph.tiles[tileId]) {
    return { state, applied: false, reason: "目标地块不存在。" } satisfies CatanIntentResult;
  }

  if (tileId === state.robberTileId) {
    return { state, applied: false, reason: "强盗已经在这块地上了。" } satisfies CatanIntentResult;
  }

  const tile = state.graph.tiles[tileId];

  if (!tile) {
    return { state, applied: false, reason: "强盗只能移动到新的陆地地块。" } satisfies CatanIntentResult;
  }

  const victimIds = getRobberVictimIds(state, state.activePlayerId, tileId);
  const movedState = {
    ...state,
    robberTileId: tileId,
    phase: "trade" as const,
    robber: {
      ...state.robber,
      stealableVictimIds: victimIds,
      targetTileId: tileId,
    },
  };

  if (state.activePlayerId === "player" && victimIds.length > 1) {
    return {
      state: appendLog(
        {
          ...movedState,
          phase: "robber-steal",
        },
        `强盗移动到 ${tileTypeLabels[tile.type]}，这块地现在不会产出资源。`,
        "请选择一名相邻玩家进行偷取。",
      ),
      applied: true,
    } satisfies CatanIntentResult;
  }

  const autoVictimId = victimIds.length > 0 ? victimIds[0] : null;
  const { state: stolenState, lines: stealLines } = resolveRobberSteal(movedState, state.activePlayerId, autoVictimId);

  return {
    state: appendLog(
      {
        ...stolenState,
        phase: "trade",
        robber: {
          ...stolenState.robber,
          stealableVictimIds: [],
          targetTileId: null,
        },
      },
      `强盗移动到 ${tileTypeLabels[tile.type]}，这块地现在不会产出资源。`,
      ...stealLines,
    ),
    applied: true,
  } satisfies CatanIntentResult;
}

function stealFromPlayer(state: CatanMatchState, victimId: CatanPlayerId) {
  if (state.phase !== "robber-steal") {
    return { state, applied: false, reason: "当前不是偷牌选择阶段。" } satisfies CatanIntentResult;
  }

  if (!state.robber.stealableVictimIds.includes(victimId)) {
    return { state, applied: false, reason: "这个目标当前不能偷。" } satisfies CatanIntentResult;
  }

  const targetTile = state.robber.targetTileId !== null ? state.graph.tiles[state.robber.targetTileId] : null;
  const { state: stolenState, lines: stealLines } = resolveRobberSteal(state, state.activePlayerId, victimId);

  return {
    state: appendLog(
      {
        ...stolenState,
        phase: "trade",
        robber: {
          ...stolenState.robber,
          stealableVictimIds: [],
          targetTileId: null,
        },
      },
      targetTile ? `强盗留在 ${tileTypeLabels[targetTile.type]}。` : "强盗已经完成移动。",
      ...stealLines,
    ),
    applied: true,
  } satisfies CatanIntentResult;
}

function tradeWithBank(
  state: CatanMatchState,
  playerId: CatanPlayerId,
  give: CatanResource,
  receive: CatanResource,
) {
  if (state.phase !== "trade" && state.phase !== "build") {
    return { state, applied: false, reason: "当前不是交易或建造阶段。" } satisfies CatanIntentResult;
  }

  const player = state.players[playerId];

  if (player.resources[give] < 4) {
    return { state, applied: false, reason: "资源不足以和银行交换。" } satisfies CatanIntentResult;
  }

  const nextState = withPlayerUpdate(state, playerId, (currentPlayer) => ({
    ...currentPlayer,
    resources: {
      ...currentPlayer.resources,
      [give]: currentPlayer.resources[give] - 4,
      [receive]: currentPlayer.resources[receive] + 1,
    },
  }));

  return {
    state: appendLog(nextState, `${player.label} 用 4 张${resourceLabels[give]} 换了 1 张${resourceLabels[receive]}。`, "现在可以继续建造。"),
    applied: true,
  } satisfies CatanIntentResult;
}

function tradeWithPort(
  state: CatanMatchState,
  playerId: CatanPlayerId,
  _portId: number,
  give: CatanResource,
  receive: CatanResource,
) {
  if (state.phase !== "trade" && state.phase !== "build") {
    return { state, applied: false, reason: "当前不是交易或建造阶段。" } satisfies CatanIntentResult;
  }

  if (!playerHasCoastalTradeAccess(state, playerId)) {
    return { state, applied: false, reason: "你当前还没有接通海岸边点位。" } satisfies CatanIntentResult;
  }

  if (state.players[playerId].resources[give] < 3) {
    return { state, applied: false, reason: "资源不足，无法完成 3:1 海岸交易。" } satisfies CatanIntentResult;
  }

  const nextState = withPlayerUpdate(state, playerId, (currentPlayer) => ({
    ...currentPlayer,
    resources: {
      ...currentPlayer.resources,
      [give]: currentPlayer.resources[give] - 3,
      [receive]: currentPlayer.resources[receive] + 1,
    },
  }));

  return {
    state: appendLog(
      nextState,
      `${state.players[playerId].label} 通过海岸贸易用 3 张${resourceLabels[give]} 换了 1 张${resourceLabels[receive]}。`,
    ),
    applied: true,
  } satisfies CatanIntentResult;
}

function tradeWithNpc(
  state: CatanMatchState,
  npcId: Exclude<CatanPlayerId, "player">,
  receive: CatanResource,
  demands: Partial<CatanResourceState>,
) {
  if (state.phase !== "trade" && state.phase !== "build") {
    return { state, applied: false, reason: "当前不是交易或建造阶段。" } satisfies CatanIntentResult;
  }

  const npc = state.players[npcId];
  const player = state.players.player;
  const demandEntries = Object.entries(demands).filter((entry): entry is [CatanResource, number] => Boolean(entry[1]));
  const demandCount = demandEntries.reduce((sum, [, count]) => sum + count, 0);

  if (demandCount < 3) {
    return { state, applied: false, reason: `${npc.label} 觉得你的报价太低了。` } satisfies CatanIntentResult;
  }

  if (npc.resources[receive] <= 0) {
    return { state, applied: false, reason: `${npc.label} 现在没有可给出的${resourceLabels[receive]}。` } satisfies CatanIntentResult;
  }

  const missingDemand = demandEntries.find(([resource, count]) => player.resources[resource] < count);

  if (missingDemand) {
    return {
      state,
      applied: false,
      reason: `你的${resourceLabels[missingDemand[0]]}不够，${npc.label} 不接受这笔交易。`,
    } satisfies CatanIntentResult;
  }

  let nextState = withPlayerUpdate(state, "player", (currentPlayer) => ({
    ...currentPlayer,
    resources: demandEntries.reduce(
      (nextResources, [resource, count]) => removeResource(nextResources, resource, count),
      addResource(currentPlayer.resources, receive, 1),
    ),
  }));

  nextState = withPlayerUpdate(nextState, npcId, (currentPlayer) => ({
    ...currentPlayer,
    resources: demandEntries.reduce(
      (nextResources, [resource, count]) => addResource(nextResources, resource, count),
      removeResource(currentPlayer.resources, receive, 1),
    ),
  }));

  return {
    state: appendLog(
      nextState,
      `${npc.label} 勉强接受了交易。`,
      `你交出 ${demandEntries.map(([resource, count]) => `${resourceLabels[resource]} x${count}`).join("，")}，换到 1 张${resourceLabels[receive]}。`,
    ),
    applied: true,
  } satisfies CatanIntentResult;
}

function buildRoad(state: CatanMatchState, playerId: CatanPlayerId, edgeId: number) {
  const player = state.players[playerId];
  const usingFreeRoadBuild = state.freeRoadBuildsRemaining > 0;
  const previousLongestRoadOwner = getLongestRoadOwner(state);

  if (!canBuildRoad(state, playerId, edgeId)) {
    return { state, applied: false, reason: "这条道路当前无法建造。" } satisfies CatanIntentResult;
  }

  if (!usingFreeRoadBuild && !canAffordWithMomentumAssist(state, playerId, buildCosts["build-road"])) {
    return { state, applied: false, reason: "资源不足，无法修路。" } satisfies CatanIntentResult;
  }

  const assistedCostState = usingFreeRoadBuild
    ? { state, assisted: false }
    : maybeUseMomentumAssist(state, playerId, buildCosts["build-road"], "build");
  const paidState = withPlayerUpdate(assistedCostState.state, playerId, (currentPlayer) => ({
    ...currentPlayer,
    resources: usingFreeRoadBuild
      ? currentPlayer.resources
      : payCostSoft(currentPlayer.resources, buildCosts["build-road"]),
    roadsLeft: currentPlayer.roadsLeft - 1,
  }));

  const nextState = refreshVictoryPoints({
    ...paidState,
    occupiedEdges: {
      ...paidState.occupiedEdges,
      [edgeId]: playerId,
    },
    phase: "build",
    freeRoadBuildsRemaining: usingFreeRoadBuild ? state.freeRoadBuildsRemaining - 1 : 0,
  });

  const freeRoadLine = usingFreeRoadBuild
    ? `道路建设剩余免费修路 ${nextState.freeRoadBuildsRemaining} 次。`
    : "你仍然可以继续建造或结束回合。";
  const momentumAssistLine =
    assistedCostState.assisted
      ? playerId === "player"
        ? "关键时刻，你像是顺手补齐了修路材料。"
        : `${player.label} 像是悄悄补齐了修路材料。`
      : null;
  const nextLongestRoadOwner = getLongestRoadOwner(nextState);
  const longestRoadLine =
    nextLongestRoadOwner && nextLongestRoadOwner !== previousLongestRoadOwner
      ? `${nextState.players[nextLongestRoadOwner].label} 拿下道路王，获得 2 分。`
      : null;

  return {
    state: determineWinner(
      appendLog(
        nextState,
        `${player.label} ${usingFreeRoadBuild ? "通过道路建设" : ""}建了一条新路。`,
        freeRoadLine,
        ...(momentumAssistLine ? [momentumAssistLine] : []),
        ...(longestRoadLine ? [longestRoadLine] : []),
      ),
    ),
    applied: true,
  } satisfies CatanIntentResult;
}

function buildSettlement(state: CatanMatchState, playerId: CatanPlayerId, nodeId: number) {
  const player = state.players[playerId];

  if (!canBuildSettlement(state, playerId, nodeId)) {
    return { state, applied: false, reason: "这个据点当前无法建造。" } satisfies CatanIntentResult;
  }

  if (!canAffordWithMomentumAssist(state, playerId, buildCosts["build-settlement"])) {
    return { state, applied: false, reason: "资源不足，无法落定居点。" } satisfies CatanIntentResult;
  }

  const assistedCostState = maybeUseMomentumAssist(state, playerId, buildCosts["build-settlement"], "build");
  const occupiedNodes = {
    ...assistedCostState.state.occupiedNodes,
    [nodeId]: {
      owner: playerId,
      level: "settlement" as const,
    },
  };
  const paidState = withPlayerUpdate(
    {
      ...assistedCostState.state,
      occupiedNodes,
      phase: "build",
    },
    playerId,
    (currentPlayer) => ({
      ...currentPlayer,
      resources: payCostSoft(currentPlayer.resources, buildCosts["build-settlement"]),
      settlementsLeft: currentPlayer.settlementsLeft - 1,
    }),
  );
  const momentumAssistLine =
    assistedCostState.assisted
      ? playerId === "player"
        ? "关键时刻，你像是顺手补齐了落村材料。"
        : `${player.label} 像是悄悄补齐了落村材料。`
      : null;
  return {
    state: determineWinner(
      appendLog(
        refreshVictoryPoints(paidState),
        `${player.label} 落下了一个新定居点。`,
        ...(momentumAssistLine ? [momentumAssistLine] : []),
        "你仍然可以继续建造或结束回合。",
      ),
    ),
    applied: true,
  } satisfies CatanIntentResult;
}

function upgradeCity(state: CatanMatchState, playerId: CatanPlayerId, nodeId: number) {
  const player = state.players[playerId];

  if (!canUpgradeCity(state, playerId, nodeId)) {
    return { state, applied: false, reason: "这个位置当前不能升级为城市。" } satisfies CatanIntentResult;
  }

  if (!canAffordWithMomentumAssist(state, playerId, buildCosts["upgrade-city"])) {
    return { state, applied: false, reason: "资源不足，无法升级城市。" } satisfies CatanIntentResult;
  }

  const assistedCostState = maybeUseMomentumAssist(state, playerId, buildCosts["upgrade-city"], "build");
  const occupiedNodes = {
    ...assistedCostState.state.occupiedNodes,
    [nodeId]: {
      owner: playerId,
      level: "city" as const,
    },
  };
  const paidState = withPlayerUpdate(
    {
      ...assistedCostState.state,
      occupiedNodes,
      phase: "build",
    },
    playerId,
    (currentPlayer) => ({
      ...currentPlayer,
      resources: payCostSoft(currentPlayer.resources, buildCosts["upgrade-city"]),
      citiesLeft: currentPlayer.citiesLeft - 1,
      settlementsLeft: currentPlayer.settlementsLeft + 1,
    }),
  );
  const momentumAssistLine =
    assistedCostState.assisted
      ? playerId === "player"
        ? "关键时刻，你像是顺手补齐了升级城市的材料。"
        : `${player.label} 像是悄悄补齐了升级城市的材料。`
      : null;

  return {
    state: determineWinner(
      appendLog(
        refreshVictoryPoints(paidState),
        `${player.label} 把定居点升级成了城市。`,
        ...(momentumAssistLine ? [momentumAssistLine] : []),
        "你仍然可以继续建造或结束回合。",
      ),
    ),
    applied: true,
  } satisfies CatanIntentResult;
}

function buyDevelopmentCard(state: CatanMatchState, playerId: CatanPlayerId) {
  if (state.phase !== "trade" && state.phase !== "build") {
    return { state, applied: false, reason: "当前不是交易或建造阶段。" } satisfies CatanIntentResult;
  }

  const player = state.players[playerId];

  if (!canAffordWithMomentumAssist(state, playerId, developmentCardCost, "development")) {
    return { state, applied: false, reason: "资源不足，无法购买发展卡。" } satisfies CatanIntentResult;
  }

  const assistedCostState = maybeUseMomentumAssist(state, playerId, developmentCardCost, "development");

  const [drawnCardFromDeck, ...remainingDeck] = assistedCostState.state.developmentDeck;

  if (!drawnCardFromDeck) {
    return { state, applied: false, reason: "发展卡牌堆已经抽空了。" } satisfies CatanIntentResult;
  }

  const purchasedState = withPlayerUpdate(assistedCostState.state, playerId, (currentPlayer) => ({
    ...currentPlayer,
    resources: payCostSoft(currentPlayer.resources, developmentCardCost),
    developmentCards: {
      ...currentPlayer.developmentCards,
      [drawnCardFromDeck]: currentPlayer.developmentCards[drawnCardFromDeck] + 1,
    },
    freshDevelopmentCards:
      drawnCardFromDeck === "victoryPoint"
        ? currentPlayer.freshDevelopmentCards
        : {
            ...currentPlayer.freshDevelopmentCards,
            [drawnCardFromDeck]: currentPlayer.freshDevelopmentCards[drawnCardFromDeck] + 1,
          },
    bonusVictoryPoints:
      drawnCardFromDeck === "victoryPoint"
        ? currentPlayer.bonusVictoryPoints + 1
        : currentPlayer.bonusVictoryPoints,
  }));
  const nextState = refreshVictoryPoints({
    ...purchasedState,
    developmentDeck: remainingDeck,
  });

  return {
    state: determineWinner(
      appendLog(
        nextState,
        `${player.label} 购买了一张发展卡。`,
        ...(assistedCostState.assisted
          ? [playerId === "player" ? "关键时刻，你像是顺手补齐了买牌材料。" : `${player.label} 像是悄悄补齐了买牌材料。`]
          : []),
        drawnCardFromDeck === "victoryPoint"
          ? `抽到 ${developmentCardLabels[drawnCardFromDeck]}，立刻获得 1 分。`
          : `抽到 ${developmentCardLabels[drawnCardFromDeck]}，但本回合不能立刻使用。`,
      ),
    ),
    applied: true,
  } satisfies CatanIntentResult;
}

function playKnight(state: CatanMatchState, playerId: CatanPlayerId) {
  if (state.phase !== "trade" && state.phase !== "build") {
    return { state, applied: false, reason: "当前不是交易或建造阶段。" } satisfies CatanIntentResult;
  }

  const player = state.players[playerId];

  if (getUsableDevelopmentCardCount(state, playerId, "knight") <= 0) {
    return { state, applied: false, reason: "你现在没有可用的骑士卡。" } satisfies CatanIntentResult;
  }

  const nextState = refreshVictoryPoints(
    withPlayerUpdate(
      {
        ...state,
        phase: "robber",
      },
      playerId,
      (currentPlayer) => ({
        ...currentPlayer,
        developmentCards: {
          ...currentPlayer.developmentCards,
          knight: currentPlayer.developmentCards.knight - 1,
        },
        freshDevelopmentCards: {
          ...currentPlayer.freshDevelopmentCards,
          knight: Math.max(currentPlayer.freshDevelopmentCards.knight - 1, 0),
        },
        knightsPlayed: currentPlayer.knightsPlayed + 1,
      }),
    ),
  );

  const largestArmyOwner = getLargestArmyOwner(nextState);
  const largestArmyLine = largestArmyOwner
    ? `当前最大骑士力：${nextState.players[largestArmyOwner].label}。`
    : "当前还没有玩家达到最大骑士力条件。";

  return {
    state: determineWinner(
      appendLog(
        nextState,
        `${player.label} 打出了骑士卡。`,
        "请选择一个陆地地块放置强盗。",
        largestArmyLine,
      ),
    ),
    applied: true,
  } satisfies CatanIntentResult;
}

function playHarvest(state: CatanMatchState, playerId: CatanPlayerId, resources: [CatanResource, CatanResource]) {
  if (state.phase !== "trade" && state.phase !== "build") {
    return { state, applied: false, reason: "当前不是交易或建造阶段。" } satisfies CatanIntentResult;
  }

  const player = state.players[playerId];

  if (getUsableDevelopmentCardCount(state, playerId, "harvest") <= 0) {
    return { state, applied: false, reason: "你现在没有可用的丰收卡。" } satisfies CatanIntentResult;
  }

  const nextState = withPlayerUpdate(state, playerId, (currentPlayer) => ({
    ...currentPlayer,
    resources: resources.reduce(
      (nextResources, resource) => addResource(nextResources, resource, 1),
      currentPlayer.resources,
    ),
    developmentCards: {
      ...currentPlayer.developmentCards,
      harvest: currentPlayer.developmentCards.harvest - 1,
    },
    freshDevelopmentCards: {
      ...currentPlayer.freshDevelopmentCards,
      harvest: Math.max(currentPlayer.freshDevelopmentCards.harvest - 1, 0),
    },
  }));

  return {
    state: determineWinner(
      appendLog(
        nextState,
        `${player.label} 打出了丰收卡。`,
        `获得 ${resources.map((resource) => resourceLabels[resource]).join("、")}。`,
      ),
    ),
    applied: true,
  } satisfies CatanIntentResult;
}

function playRoadBuilding(state: CatanMatchState, playerId: CatanPlayerId) {
  if (state.phase !== "trade" && state.phase !== "build") {
    return { state, applied: false, reason: "当前不是交易或建造阶段。" } satisfies CatanIntentResult;
  }

  const player = state.players[playerId];

  if (getUsableDevelopmentCardCount(state, playerId, "roadBuilding") <= 0) {
    return { state, applied: false, reason: "你现在没有可用的道路建设卡。" } satisfies CatanIntentResult;
  }

  const nextState = withPlayerUpdate(
    {
      ...state,
      phase: "build",
      freeRoadBuildsRemaining: 2,
    },
    playerId,
    (currentPlayer) => ({
      ...currentPlayer,
      developmentCards: {
        ...currentPlayer.developmentCards,
        roadBuilding: currentPlayer.developmentCards.roadBuilding - 1,
      },
      freshDevelopmentCards: {
        ...currentPlayer.freshDevelopmentCards,
        roadBuilding: Math.max(currentPlayer.freshDevelopmentCards.roadBuilding - 1, 0),
      },
    }),
  );

  return {
    state: determineWinner(
      appendLog(
        nextState,
        `${player.label} 打出了道路建设卡。`,
        "本回合可免费修建 2 条道路。",
      ),
    ),
    applied: true,
  } satisfies CatanIntentResult;
}

function playMonopoly(state: CatanMatchState, playerId: CatanPlayerId, resource: CatanResource) {
  if (state.phase !== "trade" && state.phase !== "build") {
    return { state, applied: false, reason: "当前不是交易或建造阶段。" } satisfies CatanIntentResult;
  }

  const player = state.players[playerId];

  if (getUsableDevelopmentCardCount(state, playerId, "monopoly") <= 0) {
    return { state, applied: false, reason: "你现在没有可用的垄断卡。" } satisfies CatanIntentResult;
  }

  let totalCollected = 0;
  let nextState = withPlayerUpdate(state, playerId, (currentPlayer) => ({
    ...currentPlayer,
    developmentCards: {
      ...currentPlayer.developmentCards,
      monopoly: currentPlayer.developmentCards.monopoly - 1,
    },
    freshDevelopmentCards: {
      ...currentPlayer.freshDevelopmentCards,
      monopoly: Math.max(currentPlayer.freshDevelopmentCards.monopoly - 1, 0),
    },
  }));

  (Object.keys(state.players) as CatanPlayerId[]).forEach((candidateId) => {
    if (candidateId === playerId) {
      return;
    }

    const available = nextState.players[candidateId].resources[resource];

    if (available <= 0) {
      return;
    }

    totalCollected += available;
    nextState = withPlayerUpdate(nextState, candidateId, (currentPlayer) => ({
      ...currentPlayer,
      resources: {
        ...currentPlayer.resources,
        [resource]: 0,
      },
    }));
  });

  if (totalCollected > 0) {
    nextState = withPlayerUpdate(nextState, playerId, (currentPlayer) => ({
      ...currentPlayer,
      resources: addResource(currentPlayer.resources, resource, totalCollected),
    }));
  }

  return {
    state: determineWinner(
      appendLog(
        nextState,
        `${player.label} 打出了垄断卡。`,
        totalCollected > 0
          ? `拿走了所有对手的 ${resourceLabels[resource]}，共 ${totalCollected} 张。`
          : `对手手里没有 ${resourceLabels[resource]}，这次没有拿到资源。`,
      ),
    ),
    applied: true,
  } satisfies CatanIntentResult;
}

function endTurn(state: CatanMatchState) {
  if (state.phase !== "trade" && state.phase !== "build") {
    return { state, applied: false, reason: "当前还不能结束回合。" } satisfies CatanIntentResult;
  }

  const unlockedState = clearFreshDevelopmentCardsForPlayer(state, state.activePlayerId);
  const advancedState = advanceTurn(unlockedState);

  return {
    state: advancedState,
    applied: true,
  } satisfies CatanIntentResult;
}

export function applyCatanIntent(state: CatanMatchState, intent: CatanIntent): CatanIntentResult {
  if (state.phase === "gameOver") {
    return {
      state,
      applied: false,
      reason: "比赛已经结束。",
    };
  }

  const activePlayerId = state.activePlayerId;
  let result: CatanIntentResult;

  switch (intent.type) {
    case "roll-dice":
      result = rollDice(state, intent.dice);
      break;
    case "move-robber":
      result = moveRobber(state, intent.tileId);
      break;
    case "discard-resource":
      result = discardResource(state, intent.resource);
      break;
    case "steal-from-player":
      result = stealFromPlayer(state, intent.victimId);
      break;
    case "trade-bank":
      result = tradeWithBank(state, activePlayerId, intent.give, intent.receive);
      break;
    case "trade-port":
      result = tradeWithPort(state, activePlayerId, intent.portId, intent.give, intent.receive);
      break;
    case "trade-npc":
      result = tradeWithNpc(state, intent.npcId, intent.receive, intent.demands);
      break;
    case "buy-development-card":
      result = buyDevelopmentCard(state, activePlayerId);
      break;
    case "play-knight":
      result = playKnight(state, activePlayerId);
      break;
    case "play-harvest":
      result = playHarvest(state, activePlayerId, intent.resources);
      break;
    case "play-road-building":
      result = playRoadBuilding(state, activePlayerId);
      break;
    case "play-monopoly":
      result = playMonopoly(state, activePlayerId, intent.resource);
      break;
    case "build-road":
      if (state.phase === "setup-road") {
        result = setupRoad(state, activePlayerId, intent.edgeId);
        break;
      }
      result = buildRoad(state, activePlayerId, intent.edgeId);
      break;
    case "build-settlement":
      if (state.phase === "setup-settlement") {
        result = setupSettlement(state, activePlayerId, intent.nodeId);
        break;
      }
      result = buildSettlement(state, activePlayerId, intent.nodeId);
      break;
    case "upgrade-city":
      result = upgradeCity(state, activePlayerId, intent.nodeId);
      break;
    case "end-turn":
      result = endTurn(state);
      break;
    default:
      result = {
        state,
        applied: false,
        reason: "未知操作。",
      };
      break;
  }

  if (!result.applied) {
    return result;
  }

  return {
    ...result,
    state: syncMomentumPhase(result.state),
  };
}
