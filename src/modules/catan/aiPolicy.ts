import {
  buildCosts,
  developmentCardCost,
  type CatanIntent,
  type CatanMatchState,
  type CatanPlayerId,
  type CatanResource,
  type CatanResourceState,
} from "./engineTypes";
import { canAffordWithMomentumAssist } from "./catanEngine";
import {
  getAvailableCityNodes,
  getAvailableRoadEdges,
  getAvailableSetupRoadEdges,
  getAvailableSetupSettlementNodes,
  getAvailableSettlementNodes,
  getNodeProductionWeight,
} from "./placementRules";

const resourcePressureWeight: Partial<Record<CatanMatchState["graph"]["tiles"][number]["type"], number>> = {
  mountains: 3.2,
  fields: 3,
  hills: 2.2,
  forest: 2,
  pasture: 1.6,
};

export function chooseBaselineAiIntent(
  state: CatanMatchState,
  playerId: CatanPlayerId,
): CatanIntent | null {
  if (state.activePlayerId !== playerId) {
    return null;
  }

  if (state.phase === "roll") {
    return { type: "roll-dice" };
  }

  if (state.phase === "robber-discard" || state.phase === "robber-steal") {
    return null;
  }

  if (state.phase === "setup-settlement") {
    const nodeId = [...getAvailableSetupSettlementNodes(state)].sort((left, right) => {
      return getNodeProductionWeight(state.graph, right) - getNodeProductionWeight(state.graph, left);
    })[0];

    return nodeId !== undefined ? { type: "build-settlement", nodeId } : null;
  }

  if (state.phase === "setup-road") {
    const edgeId = getAvailableSetupRoadEdges(state, playerId)[0];
    return edgeId !== undefined ? { type: "build-road", edgeId } : null;
  }

  if (state.phase === "robber") {
    const bestTargetTile = chooseMomentumRobberTile(state);

    return bestTargetTile ? { type: "move-robber", tileId: bestTargetTile.id } : null;
  }

  const player = state.players[playerId];
  const resources = player.resources;
  const usableDevelopmentCards = {
    knight: Math.max(player.developmentCards.knight - player.freshDevelopmentCards.knight, 0),
    harvest: Math.max(player.developmentCards.harvest - player.freshDevelopmentCards.harvest, 0),
    roadBuilding: Math.max(player.developmentCards.roadBuilding - player.freshDevelopmentCards.roadBuilding, 0),
    monopoly: Math.max(player.developmentCards.monopoly - player.freshDevelopmentCards.monopoly, 0),
  };

  const cityNodeId = [...getAvailableCityNodes(state, playerId)].sort((left, right) => {
    return getNodePriorityScore(state, playerId, right, "city") - getNodePriorityScore(state, playerId, left, "city");
  })[0];
  const settlementNodeId = [...getAvailableSettlementNodes(state, playerId)].sort((left, right) => {
    return getNodePriorityScore(state, playerId, right, "settlement") - getNodePriorityScore(state, playerId, left, "settlement");
  })[0];
  const roadEdgeId = [...getAvailableRoadEdges(state, playerId)].sort((left, right) => {
    return getRoadPriorityScore(state, playerId, right) - getRoadPriorityScore(state, playerId, left);
  })[0];

  if (usableDevelopmentCards.knight > 0 && shouldUseKnight(state, playerId)) {
    return { type: "play-knight" };
  }

  if (usableDevelopmentCards.monopoly > 0) {
    const monopolyTarget = chooseMonopolyResource(state, playerId);

    if (monopolyTarget) {
      return { type: "play-monopoly", resource: monopolyTarget };
    }
  }

  if (usableDevelopmentCards.roadBuilding > 0 && roadEdgeId !== undefined) {
    return { type: "play-road-building" };
  }

  const harvestTarget = usableDevelopmentCards.harvest > 0
    ? chooseHarvestResources(resources, cityNodeId !== undefined, settlementNodeId !== undefined)
    : null;

  if (harvestTarget) {
    return { type: "play-harvest", resources: harvestTarget };
  }

  if (state.momentumPhase === "pressure" && roadEdgeId !== undefined && canAffordWithMomentumAssist(state, playerId, buildCosts["build-road"])) {
    return { type: "build-road", edgeId: roadEdgeId };
  }

  if (cityNodeId !== undefined && canAffordWithMomentumAssist(state, playerId, buildCosts["upgrade-city"])) {
    return { type: "upgrade-city", nodeId: cityNodeId };
  }

  if (settlementNodeId !== undefined && canAffordWithMomentumAssist(state, playerId, buildCosts["build-settlement"])) {
    return { type: "build-settlement", nodeId: settlementNodeId };
  }

  if (roadEdgeId !== undefined && (state.freeRoadBuildsRemaining > 0 || canAffordWithMomentumAssist(state, playerId, buildCosts["build-road"]))) {
    return { type: "build-road", edgeId: roadEdgeId };
  }

  if (canAffordWithMomentumAssist(state, playerId, developmentCardCost, "development")) {
    return { type: "buy-development-card" };
  }

  return { type: "end-turn" };
}

function canAfford(resources: CatanResourceState, cost: Partial<CatanResourceState>) {
  return Object.entries(cost).every(([resource, count]) => {
    return resources[resource as keyof CatanResourceState] >= (count ?? 0);
  });
}

function getRoadPriorityScore(state: CatanMatchState, playerId: CatanPlayerId, edgeId: number) {
  const edge = state.graph.edges[edgeId];

  if (!edge) {
    return -Infinity;
  }

  const nodeValue = edge.nodeIds.reduce((sum, nodeId) => {
    return sum + getNodeProductionWeight(state.graph, nodeId);
  }, 0);
  const pressureBlock = edge.nodeIds.reduce((sum, nodeId) => {
    const node = state.graph.nodes[nodeId];
    const playerOccupant = state.occupiedNodes[nodeId]?.owner === "player" ? 5 : 0;
    const playerAdjacentRoads = node.adjacentEdgeIds.reduce((count, adjacentEdgeId) => {
      return count + (state.occupiedEdges[adjacentEdgeId] === "player" ? 1 : 0);
    }, 0);

    return sum + playerOccupant + playerAdjacentRoads * 2;
  }, 0);
  const ownFollowUp = edge.nodeIds.reduce((sum, nodeId) => {
    const node = state.graph.nodes[nodeId];
    return sum + node.adjacentEdgeIds.reduce((count, adjacentEdgeId) => {
      return count + (state.occupiedEdges[adjacentEdgeId] === playerId ? 1 : 0);
    }, 0);
  }, 0);
  const baseScore = nodeValue + ownFollowUp * 2.5;

  if (state.momentumPhase === "pressure") {
    return baseScore + pressureBlock * 3;
  }

  if (state.momentumPhase === "release") {
    return baseScore + pressureBlock * 1.2;
  }

  return baseScore - pressureBlock * 2.8;
}

function getNodePriorityScore(
  state: CatanMatchState,
  playerId: CatanPlayerId,
  nodeId: number,
  mode: "settlement" | "city",
) {
  const node = state.graph.nodes[nodeId];

  if (!node) {
    return -Infinity;
  }

  const production = getNodeProductionWeight(state.graph, nodeId);
  const playerAdjacency = node.adjacentEdgeIds.reduce((count, edgeId) => {
    return count + (state.occupiedEdges[edgeId] === "player" ? 1 : 0);
  }, 0);
  const playerNeighboringNodes = node.adjacentNodeIds.reduce((count, adjacentNodeId) => {
    return count + (state.occupiedNodes[adjacentNodeId]?.owner === "player" ? 1 : 0);
  }, 0);
  const ownAdjacency = node.adjacentEdgeIds.reduce((count, edgeId) => {
    return count + (state.occupiedEdges[edgeId] === playerId ? 1 : 0);
  }, 0);
  const baseScore = production + ownAdjacency * (mode === "city" ? 2.4 : 1.8);
  const pressureBlock = playerAdjacency * 3 + playerNeighboringNodes * 2.2;

  if (state.momentumPhase === "pressure") {
    return baseScore + pressureBlock * 2.6;
  }

  if (state.momentumPhase === "release") {
    return baseScore + pressureBlock;
  }

  return baseScore - pressureBlock * 2.4;
}

function shouldUseKnight(state: CatanMatchState, playerId: CatanPlayerId) {
  const playerKnights = state.players[playerId].knightsPlayed;
  const highestOpponentKnights = (Object.keys(state.players) as CatanPlayerId[])
    .filter((candidate) => candidate !== playerId)
    .reduce((highest, candidate) => Math.max(highest, state.players[candidate].knightsPlayed), 0);

  return playerKnights < 3 || playerKnights <= highestOpponentKnights;
}

function chooseHarvestResources(
  resources: CatanResourceState,
  canBuildCitySoon: boolean,
  canBuildSettlementSoon: boolean,
): [CatanResource, CatanResource] | null {
  if (canBuildCitySoon) {
    const deficits: Array<[CatanResource, number]> = [
      ["ore", Math.max(3 - resources.ore, 0)],
      ["grain", Math.max(2 - resources.grain, 0)],
    ];
    const picks = deficits
      .flatMap(([resource, deficit]) => Array.from({ length: Math.min(deficit, 2) }, () => resource))
      .slice(0, 2);

    if (picks.length === 2) {
      return [picks[0], picks[1]];
    }
  }

  if (canBuildSettlementSoon) {
    const picks = (["wood", "brick", "grain", "wool"] as CatanResource[])
      .filter((resource) => {
        const deficit = Math.max(1 - resources[resource], 0);
        return deficit > 0 && deficit <= 2;
      })
      .slice(0, 2);

    if (picks.length === 2) {
      return [picks[0], picks[1]];
    }
  }

  return resources.ore < resources.grain ? ["ore", "ore"] : ["grain", "grain"];
}

function chooseMonopolyResource(state: CatanMatchState, playerId: CatanPlayerId) {
  const totals = (["wood", "brick", "grain", "ore", "wool"] as CatanResource[]).map((resource) => ({
    resource,
    count: (Object.keys(state.players) as CatanPlayerId[])
      .filter((candidate) => candidate !== playerId)
      .reduce((sum, candidate) => sum + state.players[candidate].resources[resource], 0),
  }));
  const best = totals.sort((left, right) => right.count - left.count)[0];
  return best && best.count > 0 ? best.resource : null;
}

function chooseMomentumRobberTile(state: CatanMatchState) {
  if (state.momentumPhase === "pressure") {
    return choosePressureRobberTile(state);
  }

  if (state.momentumPhase === "release") {
    return chooseReleaseRobberTile(state);
  }

  return chooseComebackRobberTile(state);
}

function choosePressureRobberTile(state: CatanMatchState) {
  const playerFocusedTiles = state.graph.tiles
    .filter((tile) => tile.id !== state.robberTileId)
    .map((tile) => ({
      tile,
      score: getPlayerPressureTileScore(state, tile.id),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  if (playerFocusedTiles.length > 0) {
    return playerFocusedTiles[0].tile;
  }

  return [...state.graph.tiles]
    .filter((tile) => tile.id !== state.robberTileId)
    .sort((left, right) => {
      const leftWeight = left.nodeIds.reduce(
        (total, nodeId) => total + getNodeProductionWeight(state.graph, nodeId),
        0,
      );
      const rightWeight = right.nodeIds.reduce(
        (total, nodeId) => total + getNodeProductionWeight(state.graph, nodeId),
        0,
      );
      return rightWeight - leftWeight;
    })[0];
}

function chooseReleaseRobberTile(state: CatanMatchState) {
  return [...state.graph.tiles]
    .filter((tile) => tile.id !== state.robberTileId)
    .map((tile) => ({
      tile,
      score: getPlayerPressureTileScore(state, tile.id) * 0.55 + getGeneralTileScore(state, tile.id) * 0.45,
    }))
    .sort((left, right) => right.score - left.score)[0]?.tile;
}

function chooseComebackRobberTile(state: CatanMatchState) {
  const nonPlayerTiles = state.graph.tiles
    .filter((tile) => tile.id !== state.robberTileId)
    .map((tile) => ({
      tile,
      playerScore: getPlayerPressureTileScore(state, tile.id),
      generalScore: getGeneralTileScore(state, tile.id),
    }))
    .filter((entry) => entry.playerScore === 0)
    .sort((left, right) => right.generalScore - left.generalScore);

  if (nonPlayerTiles.length > 0) {
    return nonPlayerTiles[0].tile;
  }

  return [...state.graph.tiles]
    .filter((tile) => tile.id !== state.robberTileId)
    .sort((left, right) => getGeneralTileScore(state, right.id) - getGeneralTileScore(state, left.id))[0];
}

function getPlayerPressureTileScore(state: CatanMatchState, tileId: number) {
  const tile = state.graph.tiles[tileId];

  if (!tile || tile.type === "desert") {
    return 0;
  }

  const tileWeight = resourcePressureWeight[tile.type] ?? 1;
  const numberWeight = tile.number ? getNumberPressureWeight(tile.number) : 0;

  return tile.nodeIds.reduce((total, nodeId) => {
    const occupant = state.occupiedNodes[nodeId];

    if (!occupant || occupant.owner !== "player") {
      return total;
    }

    const buildingWeight = occupant.level === "city" ? 2.1 : 1;
    return total + tileWeight * numberWeight * buildingWeight;
  }, 0);
}

function getGeneralTileScore(state: CatanMatchState, tileId: number) {
  const tile = state.graph.tiles[tileId];

  if (!tile || tile.type === "desert") {
    return 0;
  }

  const tileWeight = resourcePressureWeight[tile.type] ?? 1;
  const numberWeight = tile.number ? getNumberPressureWeight(tile.number) : 0;

  return tile.nodeIds.reduce((total, nodeId) => {
    const occupant = state.occupiedNodes[nodeId];

    if (!occupant || occupant.owner === "player") {
      return total;
    }

    const buildingWeight = occupant.level === "city" ? 2 : 1;
    return total + tileWeight * numberWeight * buildingWeight;
  }, 0);
}

function getNumberPressureWeight(value: number) {
  const distributionWeight: Partial<Record<number, number>> = {
    2: 1,
    3: 2,
    4: 3,
    5: 4,
    6: 5,
    8: 5,
    9: 4,
    10: 3,
    11: 2,
    12: 1,
  };

  return distributionWeight[value] ?? 0;
}
