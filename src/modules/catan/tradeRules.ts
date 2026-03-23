import type {
  CatanMatchState,
  CatanPlayerId,
  CatanResource,
  CatanResourceState,
} from "./engineTypes";

export type TradeSource =
  | {
      id: "bank";
      type: "bank";
      label: string;
      rate: number;
      giveResources: CatanResource[];
    }
  | {
      id: "coast";
      type: "coast";
      label: string;
      rate: number;
      giveResources: CatanResource[];
    }
  | {
      id: `npc-${Exclude<CatanPlayerId, "player">}`;
      type: "npc";
      label: string;
      npcId: Exclude<CatanPlayerId, "player">;
      demands: Partial<CatanResourceState>;
      giveResources: CatanResource[];
      reason: string;
    };

const resourceLabels: Record<CatanResource, string> = {
  wood: "木材",
  brick: "砖块",
  grain: "小麦",
  ore: "矿石",
  wool: "羊毛",
};

export function playerHasCoastalTradeAccess(state: CatanMatchState, playerId: CatanPlayerId) {
  return state.graph.nodes.some((node) => {
    if (node.adjacentTileIds.length >= 3) {
      return false;
    }

    return state.occupiedNodes[node.id]?.owner === playerId;
  });
}

export function getTradeSources(state: CatanMatchState, playerId: CatanPlayerId): TradeSource[] {
  const player = state.players[playerId];
  const resources = Object.entries(player.resources) as Array<[CatanResource, number]>;
  const sources: TradeSource[] = [];

  const bankGiveResources = resources
    .filter(([, count]) => count >= 4)
    .map(([resource]) => resource);

  sources.push({
    id: "bank",
    type: "bank",
    label: "银行 4:1",
    rate: 4,
    giveResources: bankGiveResources,
  });

  if (playerHasCoastalTradeAccess(state, playerId)) {
    const giveResources = resources
      .filter(([, count]) => count >= 3)
      .map(([resource]) => resource);
    sources.push({
      id: "coast",
      type: "coast",
      label: "海岸贸易 3:1",
      rate: 3,
      giveResources,
    });
  }

  sources.push(...getNpcTradeSources(state));

  return sources;
}

function getNpcTradeSources(state: CatanMatchState): TradeSource[] {
  return (["leah", "sam"] as const).map((npcId) => createNpcTradeSource(state, npcId));
}

function createNpcTradeSource(
  state: CatanMatchState,
  npcId: Exclude<CatanPlayerId, "player">,
): TradeSource {
  const npc = state.players[npcId];
  const player = state.players.player;
  const demandedResources = buildNpcDemandBundle(player.resources, state.momentumPhase);
  const receiveResources = (Object.keys(resourceLabels) as CatanResource[]).filter((resource) => {
    return npc.resources[resource] > 0 && !Boolean(demandedResources[resource]);
  });

  const shouldRefuse =
    state.momentumPhase === "pressure"
      ? receiveResources.length === 0 || getDemandCount(demandedResources) < 5
      : getDemandCount(demandedResources) < 3 || receiveResources.length === 0;

  if (shouldRefuse) {
    return {
      id: `npc-${npcId}`,
      type: "npc",
      label: `${npc.label} 拒绝交易`,
      npcId,
      demands: demandedResources,
      giveResources: [],
      reason:
        receiveResources.length === 0
          ? `${npc.label} 没有可松口的资源。`
          : state.momentumPhase === "pressure"
            ? `${npc.label} 现在根本不想让你顺利补牌。`
            : `${npc.label} 觉得你的筹码不够。`,
    };
  }

  return {
    id: `npc-${npcId}`,
    type: "npc",
      label:
      state.momentumPhase === "pressure"
        ? `${npc.label} 几乎不肯交易`
        : state.momentumPhase === "release"
          ? `${npc.label} 勉强松口`
          : `${npc.label} 愿意让一点步`,
    npcId,
    demands: demandedResources,
    giveResources: receiveResources,
    reason:
      state.momentumPhase === "pressure"
        ? `${npc.label} 故意要你先交出 ${formatDemandSummary(demandedResources)}，几乎不想让你补牌。`
        : state.momentumPhase === "release"
          ? `${npc.label} 要求你先交出 ${formatDemandSummary(demandedResources)}。`
          : `${npc.label} 开价明显松了点，只要 ${formatDemandSummary(demandedResources)}。`,
  };
}

function buildNpcDemandBundle(resources: CatanResourceState, momentumPhase: CatanMatchState["momentumPhase"]) {
  const sortedResources = (Object.entries(resources) as Array<[CatanResource, number]>).sort((left, right) => {
    return right[1] - left[1];
  });
  const demands: Partial<CatanResourceState> = {};
  let remaining =
    momentumPhase === "pressure"
      ? sortedResources[0]?.[1] >= 6
        ? 5
        : 4
      : momentumPhase === "release"
        ? 3
        : 2;

  for (const [resource, count] of sortedResources) {
    if (remaining <= 0) {
      break;
    }

    if (count <= 0) {
      continue;
    }

    const take = Math.min(count, remaining, resource === sortedResources[0]?.[0] ? remaining : 1);

    if (take <= 0) {
      continue;
    }

    demands[resource] = take;
    remaining -= take;
  }

  return demands;
}

function getDemandCount(demands: Partial<CatanResourceState>) {
  return Object.values(demands).reduce((sum, count) => sum + (count ?? 0), 0);
}

export function formatDemandSummary(demands: Partial<CatanResourceState>) {
  return (Object.entries(demands) as Array<[CatanResource, number]>)
    .filter(([, count]) => count > 0)
    .map(([resource, count]) => `${resourceLabels[resource]} x${count}`)
    .join("，");
}

export function getTradeReceiveResources(give: CatanResource) {
  return (Object.keys(resourceLabels) as CatanResource[]).filter((resource) => resource !== give);
}

export function getTradeGiveLabel(resource: CatanResource, rate: number) {
  return `交出 ${rate} ${resourceLabels[resource]}`;
}

export function getTradeReceiveLabel(resource: CatanResource) {
  return `换取 1 ${resourceLabels[resource]}`;
}
