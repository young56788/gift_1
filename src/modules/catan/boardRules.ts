import type {
  BoardOwner,
  CatanBoardState,
  CatanNodeState,
  CatanRoadState,
  ScriptedAction,
} from "./types";

const roadConnections: Record<number, [number, number]> = {
  0: [0, 1],
  1: [1, 2],
  2: [0, 3],
  3: [2, 5],
  4: [3, 4],
  5: [0, 4],
  6: [4, 5],
  7: [1, 4],
};

const settlementConflicts: Record<number, number[]> = {
  0: [1],
  1: [0, 2],
  2: [1, 5],
  3: [4],
  4: [3, 5],
  5: [2, 4],
};

export const initialBoardState: CatanBoardState = {
  roads: [
    { id: 0, owner: "leah" },
    { id: 1, owner: "sam" },
    { id: 2, owner: "player", emphasis: true },
    { id: 3, owner: "leah" },
  ],
  nodes: [
    { id: 0, owner: "player", level: "settlement" },
    { id: 1, owner: "leah", level: "settlement" },
    { id: 2, owner: "sam", level: "settlement" },
  ],
};

function getRoad(board: CatanBoardState, roadId: number) {
  return board.roads.find((road) => road.id === roadId) ?? null;
}

function getNode(board: CatanBoardState, nodeId: number) {
  return board.nodes.find((node) => node.id === nodeId) ?? null;
}

function playerOwnsNode(board: CatanBoardState, owner: BoardOwner, nodeId: number) {
  return getNode(board, nodeId)?.owner === owner;
}

function playerOwnsRoad(board: CatanBoardState, owner: BoardOwner, roadId: number) {
  return getRoad(board, roadId)?.owner === owner;
}

function playerRoadTouchesNode(board: CatanBoardState, owner: BoardOwner, nodeId: number) {
  return board.roads.some((road) => {
    const endpoints = roadConnections[road.id];
    return road.owner === owner && endpoints && endpoints.includes(nodeId);
  });
}

function nodeConflicts(board: CatanBoardState, nodeId: number) {
  return (settlementConflicts[nodeId] ?? []).some((adjacentNodeId) => Boolean(getNode(board, adjacentNodeId)));
}

function canBuildRoad(board: CatanBoardState, owner: BoardOwner, roadId: number) {
  if (getRoad(board, roadId)) {
    return false;
  }

  const endpoints = roadConnections[roadId];

  if (!endpoints) {
    return false;
  }

  return endpoints.some((nodeId) => {
    if (playerOwnsNode(board, owner, nodeId)) {
      return true;
    }

    return board.roads.some((road) => {
      if (road.owner !== owner) {
        return false;
      }

      const adjacentRoadEndpoints = roadConnections[road.id];
      return adjacentRoadEndpoints?.includes(nodeId);
    });
  });
}

function canBuildSettlement(board: CatanBoardState, owner: BoardOwner, nodeId: number) {
  if (getNode(board, nodeId)) {
    return false;
  }

  if (nodeConflicts(board, nodeId)) {
    return false;
  }

  return playerRoadTouchesNode(board, owner, nodeId);
}

function canBuildCity(board: CatanBoardState, owner: BoardOwner, nodeId: number) {
  const node = getNode(board, nodeId);
  return node?.owner === owner && node.level === "settlement";
}

export function isActionLegal(
  board: CatanBoardState,
  action: ScriptedAction,
  owner: BoardOwner = "player",
) {
  if (!action.build) {
    return true;
  }

  if (action.target.kind === "road" && action.build.kind === "road") {
    return canBuildRoad(board, owner, action.target.id);
  }

  if (action.target.kind === "node" && action.build.kind === "settlement") {
    return canBuildSettlement(board, owner, action.target.id);
  }

  if (action.target.kind === "node" && action.build.kind === "city") {
    return canBuildCity(board, owner, action.target.id);
  }

  return false;
}

export function applyActionToBoard(
  board: CatanBoardState,
  action: ScriptedAction,
  owner: BoardOwner = "player",
) {
  if (!action.build || !isActionLegal(board, action, owner)) {
    return board;
  }

  if (action.build.kind === "road" && action.target.kind === "road") {
    const nextRoad: CatanRoadState = { id: action.target.id, owner, emphasis: true };
    return {
      ...board,
      roads: [...board.roads.filter((road) => road.id !== nextRoad.id), nextRoad].sort(
        (left, right) => left.id - right.id,
      ),
    };
  }

  if (action.build.kind === "settlement" && action.target.kind === "node") {
    const nextNode: CatanNodeState = { id: action.target.id, owner, level: "settlement" };
    return {
      ...board,
      nodes: [...board.nodes.filter((node) => node.id !== nextNode.id), nextNode].sort(
        (left, right) => left.id - right.id,
      ),
    };
  }

  if (action.build.kind === "city" && action.target.kind === "node") {
    const nextNode: CatanNodeState = { id: action.target.id, owner, level: "city" };
    return {
      ...board,
      nodes: [...board.nodes.filter((node) => node.id !== nextNode.id), nextNode].sort(
        (left, right) => left.id - right.id,
      ),
    };
  }

  return board;
}

export function getLongestRoadLength(board: CatanBoardState, owner: BoardOwner) {
  const ownedRoads = board.roads.filter((road) => road.owner === owner);

  if (ownedRoads.length === 0) {
    return 0;
  }

  const roadIds = ownedRoads.map((road) => road.id);
  const adjacency = new Map<number, number[]>();

  roadIds.forEach((roadId) => {
    const currentEndpoints = roadConnections[roadId];
    const neighbors = roadIds.filter((candidateId) => {
      if (candidateId === roadId) {
        return false;
      }

      const candidateEndpoints = roadConnections[candidateId];

      return currentEndpoints.some((endpoint) => candidateEndpoints?.includes(endpoint));
    });

    adjacency.set(roadId, neighbors);
  });

  function dfs(roadId: number, visited: Set<number>): number {
    const nextVisited = new Set(visited);
    nextVisited.add(roadId);
    const neighbors = adjacency.get(roadId) ?? [];
    let longest = 1;

    neighbors.forEach((neighborId) => {
      if (!nextVisited.has(neighborId)) {
        longest = Math.max(longest, 1 + dfs(neighborId, nextVisited));
      }
    });

    return longest;
  }

  return Math.max(...roadIds.map((roadId) => dfs(roadId, new Set<number>())));
}
