import type {
  CatanBuildingLevel,
  CatanGraph,
  CatanMatchState,
  CatanPlayerId,
} from "./engineTypes";

function getNodeOccupant(state: CatanMatchState, nodeId: number) {
  return state.occupiedNodes[nodeId];
}

function getEdgeOwner(state: CatanMatchState, edgeId: number) {
  return state.occupiedEdges[edgeId];
}

export function isRoadConnectedToPlayerNetwork(
  state: CatanMatchState,
  playerId: CatanPlayerId,
  edgeId: number,
) {
  const edge = state.graph.edges[edgeId];

  if (!edge || getEdgeOwner(state, edgeId)) {
    return false;
  }

  return edge.nodeIds.some((nodeId) => {
    const node = getNodeOccupant(state, nodeId);

    if (node?.owner === playerId) {
      return true;
    }

    return state.graph.nodes[nodeId].adjacentEdgeIds.some(
      (adjacentEdgeId) => getEdgeOwner(state, adjacentEdgeId) === playerId,
    );
  });
}

export function canBuildRoad(state: CatanMatchState, playerId: CatanPlayerId, edgeId: number) {
  if (state.players[playerId].roadsLeft <= 0) {
    return false;
  }

  return isRoadConnectedToPlayerNetwork(state, playerId, edgeId);
}

export function canBuildSettlement(
  state: CatanMatchState,
  playerId: CatanPlayerId,
  nodeId: number,
) {
  const node = state.graph.nodes[nodeId];

  if (!node || state.players[playerId].settlementsLeft <= 0) {
    return false;
  }

  if (getNodeOccupant(state, nodeId)) {
    return false;
  }

  const touchesExistingSettlement = node.adjacentNodeIds.some(
    (adjacentNodeId) => Boolean(getNodeOccupant(state, adjacentNodeId)),
  );

  if (touchesExistingSettlement) {
    return false;
  }

  return node.adjacentEdgeIds.some(
    (edgeId) => getEdgeOwner(state, edgeId) === playerId,
  );
}

export function canBuildSetupSettlement(state: CatanMatchState, playerId: CatanPlayerId, nodeId: number) {
  const node = state.graph.nodes[nodeId];

  if (!node || state.players[playerId].settlementsLeft <= 0 || getNodeOccupant(state, nodeId)) {
    return false;
  }

  return !node.adjacentNodeIds.some((adjacentNodeId) => Boolean(getNodeOccupant(state, adjacentNodeId)));
}

export function canBuildSetupRoad(state: CatanMatchState, playerId: CatanPlayerId, edgeId: number) {
  const edge = state.graph.edges[edgeId];
  const pendingNodeId = state.setup.pendingRoadNodeId;

  if (!edge || pendingNodeId === null || getEdgeOwner(state, edgeId)) {
    return false;
  }

  return edge.nodeIds.includes(pendingNodeId) && state.players[playerId].roadsLeft > 0;
}

export function canUpgradeCity(state: CatanMatchState, playerId: CatanPlayerId, nodeId: number) {
  const node = getNodeOccupant(state, nodeId);

  return (
    state.players[playerId].citiesLeft > 0 &&
    node?.owner === playerId &&
    node.level === "settlement"
  );
}

export function getBuildingVictoryPoints(level: CatanBuildingLevel) {
  return level === "city" ? 2 : 1;
}

export function getAvailableRoadEdges(state: CatanMatchState, playerId: CatanPlayerId) {
  return state.graph.edges
    .filter((edge) => canBuildRoad(state, playerId, edge.id))
    .map((edge) => edge.id);
}

export function getAvailableSettlementNodes(state: CatanMatchState, playerId: CatanPlayerId) {
  return state.graph.nodes
    .filter((node) => canBuildSettlement(state, playerId, node.id))
    .map((node) => node.id);
}

export function getAvailableSetupSettlementNodes(state: CatanMatchState) {
  return state.graph.nodes
    .filter((node) => canBuildSetupSettlement(state, state.activePlayerId, node.id))
    .map((node) => node.id);
}

export function getAvailableSetupRoadEdges(state: CatanMatchState, playerId: CatanPlayerId) {
  return state.graph.edges
    .filter((edge) => canBuildSetupRoad(state, playerId, edge.id))
    .map((edge) => edge.id);
}

export function getAvailableCityNodes(state: CatanMatchState, playerId: CatanPlayerId) {
  return state.graph.nodes
    .filter((node) => canUpgradeCity(state, playerId, node.id))
    .map((node) => node.id);
}

export function getNodeProductionWeight(graph: CatanGraph, nodeId: number) {
  const node = graph.nodes[nodeId];

  if (!node) {
    return 0;
  }

  const probabilityWeights: Record<number, number> = {
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

  return node.adjacentTileIds.reduce((total, tileId) => {
    const tile = graph.tiles[tileId];
    return total + (tile?.number ? probabilityWeights[tile.number] ?? 0 : 0);
  }, 0);
}
