import type {
  CatanEdgeState,
  CatanGraph,
  CatanNodeState,
  CatanPortState,
  CatanPlayerId,
  CatanTileState,
  CatanTileType,
} from "./engineTypes";

type TileSeed = {
  id: number;
  q: number;
  r: number;
  type: CatanTileType;
  number: number | null;
  centerX: number;
  centerY: number;
};

type PlacementSeed = {
  nodeId: number;
  edgeId: number;
};

type PortSeed = {
  id: number;
  edgeId: number;
  kind: CatanPortState["kind"];
};

export const BOARD_HEX_RADIUS = 54;
export const BOARD_VIEWBOX_WIDTH = 980;
export const BOARD_VIEWBOX_HEIGHT = 860;

const tileSeeds: TileSeed[] = [
  { id: 0, q: -1, r: -2, type: "forest", number: 11, centerX: 368, centerY: 140 },
  { id: 1, q: 0, r: -2, type: "hills", number: 4, centerX: 490, centerY: 140 },
  { id: 2, q: 1, r: -2, type: "pasture", number: 8, centerX: 612, centerY: 140 },
  { id: 3, q: -1, r: -1, type: "mountains", number: 10, centerX: 307, centerY: 245 },
  { id: 4, q: 0, r: -1, type: "fields", number: 9, centerX: 429, centerY: 245 },
  { id: 5, q: 1, r: -1, type: "forest", number: 12, centerX: 551, centerY: 245 },
  { id: 6, q: 2, r: -1, type: "pasture", number: 6, centerX: 673, centerY: 245 },
  { id: 7, q: -2, r: 0, type: "fields", number: 2, centerX: 246, centerY: 350 },
  { id: 8, q: -1, r: 0, type: "forest", number: 8, centerX: 368, centerY: 350 },
  { id: 9, q: 0, r: 0, type: "desert", number: null, centerX: 490, centerY: 350 },
  { id: 10, q: 1, r: 0, type: "pasture", number: 3, centerX: 612, centerY: 350 },
  { id: 11, q: 2, r: 0, type: "mountains", number: 6, centerX: 734, centerY: 350 },
  { id: 12, q: -2, r: 1, type: "hills", number: 5, centerX: 307, centerY: 455 },
  { id: 13, q: -1, r: 1, type: "fields", number: 8, centerX: 429, centerY: 455 },
  { id: 14, q: 0, r: 1, type: "mountains", number: 10, centerX: 551, centerY: 455 },
  { id: 15, q: 1, r: 1, type: "pasture", number: 9, centerX: 673, centerY: 455 },
  { id: 16, q: -1, r: 2, type: "forest", number: 5, centerX: 368, centerY: 560 },
  { id: 17, q: 0, r: 2, type: "fields", number: 11, centerX: 490, centerY: 560 },
  { id: 18, q: 1, r: 2, type: "hills", number: 4, centerX: 612, centerY: 560 },
];

function createHexCorners(centerX: number, centerY: number) {
  const offsets = [
    { x: 0, y: -70 },
    { x: 60.62, y: -35 },
    { x: 60.62, y: 35 },
    { x: 0, y: 70 },
    { x: -60.62, y: 35 },
    { x: -60.62, y: -35 },
  ];

  return offsets.map((offset) => ({
    x: centerX + offset.x,
    y: centerY + offset.y,
  }));
}

function getCornerKey(x: number, y: number) {
  return `${Math.round(x)}:${Math.round(y)}`;
}

function getEdgeKey(left: number, right: number) {
  return `${Math.min(left, right)}:${Math.max(left, right)}`;
}

function buildGraph(): CatanGraph {
  const nodeIdsByKey = new Map<string, number>();
  const edgeIdsByKey = new Map<string, number>();
  const nodeMeta = new Map<number, { x: number; y: number; tileIds: Set<number> }>();
  const edgeMeta = new Map<number, { nodeIds: [number, number]; tileIds: Set<number> }>();

  const tiles: CatanTileState[] = tileSeeds.map((seed) => {
    const corners = createHexCorners(seed.centerX, seed.centerY);
    const nodeIds = corners.map((corner) => {
      const key = getCornerKey(corner.x, corner.y);
      const existingId = nodeIdsByKey.get(key);

      if (existingId !== undefined) {
        nodeMeta.get(existingId)?.tileIds.add(seed.id);
        return existingId;
      }

      const nextId = nodeIdsByKey.size;
      nodeIdsByKey.set(key, nextId);
      nodeMeta.set(nextId, {
        x: corner.x,
        y: corner.y,
        tileIds: new Set([seed.id]),
      });
      return nextId;
    });

    const edgeIds = nodeIds.map((nodeId, index) => {
      const neighborNodeId = nodeIds[(index + 1) % nodeIds.length];
      const key = getEdgeKey(nodeId, neighborNodeId);
      const existingId = edgeIdsByKey.get(key);

      if (existingId !== undefined) {
        edgeMeta.get(existingId)?.tileIds.add(seed.id);
        return existingId;
      }

      const nextId = edgeIdsByKey.size;
      edgeIdsByKey.set(key, nextId);
      edgeMeta.set(nextId, {
        nodeIds: [nodeId, neighborNodeId],
        tileIds: new Set([seed.id]),
      });
      return nextId;
    });

    return {
      id: seed.id,
      q: seed.q,
      r: seed.r,
      type: seed.type,
      number: seed.number,
      x: seed.centerX,
      y: seed.centerY,
      nodeIds,
      edgeIds,
    };
  });

  const edges: CatanEdgeState[] = Array.from(edgeMeta.entries())
    .map(([id, meta]) => ({
      id,
      nodeIds: meta.nodeIds,
      adjacentTileIds: Array.from(meta.tileIds).sort((left, right) => left - right),
    }))
    .sort((left, right) => left.id - right.id);

  const edgeIdsByNode = new Map<number, Set<number>>();
  const adjacentNodesByNode = new Map<number, Set<number>>();

  edges.forEach((edge) => {
    edge.nodeIds.forEach((nodeId, index) => {
      if (!edgeIdsByNode.has(nodeId)) {
        edgeIdsByNode.set(nodeId, new Set());
      }

      edgeIdsByNode.get(nodeId)?.add(edge.id);
      const neighborNodeId = edge.nodeIds[(index + 1) % 2];

      if (!adjacentNodesByNode.has(nodeId)) {
        adjacentNodesByNode.set(nodeId, new Set());
      }

      adjacentNodesByNode.get(nodeId)?.add(neighborNodeId);
    });
  });

  const nodes: CatanNodeState[] = Array.from(nodeMeta.entries())
    .map(([id, meta]) => ({
      id,
      x: meta.x,
      y: meta.y,
      adjacentTileIds: Array.from(meta.tileIds).sort((left, right) => left - right),
      adjacentNodeIds: Array.from(adjacentNodesByNode.get(id) ?? []).sort((left, right) => left - right),
      adjacentEdgeIds: Array.from(edgeIdsByNode.get(id) ?? []).sort((left, right) => left - right),
    }))
    .sort((left, right) => left.id - right.id);

  const ports = buildPorts(edges, nodes);

  return {
    tiles,
    nodes,
    edges,
    ports,
  };
}

function buildPorts(edges: CatanEdgeState[], nodes: CatanNodeState[]): CatanPortState[] {
  const boardCenterX = 490;
  const boardCenterY = 350;
  const portSeeds: PortSeed[] = [
    { id: 0, edgeId: 0, kind: "wool" },
    { id: 1, edgeId: 11, kind: "ore" },
    { id: 2, edgeId: 27, kind: "three-for-one" },
    { id: 3, edgeId: 46, kind: "grain" },
    { id: 4, edgeId: 60, kind: "three-for-one" },
    { id: 5, edgeId: 67, kind: "brick" },
    { id: 6, edgeId: 64, kind: "wood" },
    { id: 7, edgeId: 51, kind: "three-for-one" },
    { id: 8, edgeId: 19, kind: "three-for-one" },
  ];

  return portSeeds.map((seed) => {
    const edge = edges[seed.edgeId];
    const [leftNodeId, rightNodeId] = edge.nodeIds;
    const leftNode = nodes[leftNodeId];
    const rightNode = nodes[rightNodeId];
    const midX = (leftNode.x + rightNode.x) / 2;
    const midY = (leftNode.y + rightNode.y) / 2;
    const outwardX = midX - boardCenterX;
    const outwardY = midY - boardCenterY;
    const length = Math.hypot(outwardX, outwardY) || 1;
    const offset = 56;

    return {
      id: seed.id,
      kind: seed.kind,
      x: midX + (outwardX / length) * offset,
      y: midY + (outwardY / length) * offset,
      edgeId: seed.edgeId,
      nodeIds: edge.nodeIds,
    };
  });
}

function chooseStartingPlacements(graph: CatanGraph): Record<CatanPlayerId, PlacementSeed> {
  const sortedNodes = [...graph.nodes].sort((left, right) => {
    if (left.x !== right.x) {
      return left.x - right.x;
    }

    return left.y - right.y;
  });

  const playerNode = sortedNodes[0];
  const leahNode = sortedNodes[sortedNodes.length - 1];
  const samNode = [...graph.nodes].sort((left, right) => right.y - left.y)[0];

  function pickEdgeForNode(nodeId: number) {
    const node = graph.nodes.find((item) => item.id === nodeId);
    const centerDistanceSorted = [...(node?.adjacentEdgeIds ?? [])].sort((leftId, rightId) => {
      const leftEdge = graph.edges[leftId];
      const rightEdge = graph.edges[rightId];
      const leftX = (graph.nodes[leftEdge.nodeIds[0]].x + graph.nodes[leftEdge.nodeIds[1]].x) / 2;
      const leftY = (graph.nodes[leftEdge.nodeIds[0]].y + graph.nodes[leftEdge.nodeIds[1]].y) / 2;
      const rightX = (graph.nodes[rightEdge.nodeIds[0]].x + graph.nodes[rightEdge.nodeIds[1]].x) / 2;
      const rightY = (graph.nodes[rightEdge.nodeIds[0]].y + graph.nodes[rightEdge.nodeIds[1]].y) / 2;
      const leftDistance = Math.abs(leftX) + Math.abs(leftY);
      const rightDistance = Math.abs(rightX) + Math.abs(rightY);
      return leftDistance - rightDistance;
    });

    return centerDistanceSorted[0];
  }

  return {
    player: {
      nodeId: playerNode.id,
      edgeId: pickEdgeForNode(playerNode.id),
    },
    leah: {
      nodeId: leahNode.id,
      edgeId: pickEdgeForNode(leahNode.id),
    },
    sam: {
      nodeId: samNode.id,
      edgeId: pickEdgeForNode(samNode.id),
    },
  };
}

export const fixedBoardGraph = buildGraph();

export const fixedBoardStartingPlacements = chooseStartingPlacements(fixedBoardGraph);
