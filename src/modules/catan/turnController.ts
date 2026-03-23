import type { CatanMatchState, CatanPhase, CatanPlayerId } from "./engineTypes";

export function getNextPlayerId(state: CatanMatchState) {
  const currentIndex = state.turnOrder.findIndex((playerId) => playerId === state.activePlayerId);
  const nextIndex = (currentIndex + 1) % state.turnOrder.length;
  return state.turnOrder[nextIndex];
}

export function getPhaseAfterDice(total: number): CatanPhase {
  return total === 7 ? "robber" : "trade";
}

export function advancePhase(state: CatanMatchState, phase: CatanPhase) {
  return {
    ...state,
    phase,
  };
}

export function advanceTurn(state: CatanMatchState) {
  const nextPlayerId = getNextPlayerId(state);

  return {
    ...state,
    activePlayerId: nextPlayerId,
    turnNumber: state.turnNumber + 1,
    phase: "roll" as const,
    dice: null,
    freeRoadBuildsRemaining: 0,
    momentumAidUsed: {
      player: false,
      leah: false,
      sam: false,
    },
    latestLog: [`轮到 ${getPlayerLabel(nextPlayerId)} 掷骰。`],
  };
}

export function advanceSetupTurn(state: CatanMatchState) {
  const nextPlacementIndex = state.setup.placementIndex + 1;
  const nextPlayerId = state.setup.placementOrder[nextPlacementIndex];

  if (!nextPlayerId) {
    return {
      ...state,
      activePlayerId: state.turnOrder[0],
      turnNumber: 1,
      phase: "roll" as const,
      dice: null,
      momentumAidUsed: {
        player: false,
        leah: false,
        sam: false,
      },
      latestLog: [`开局摆放完成，轮到 ${getPlayerLabel(state.turnOrder[0])} 掷骰。`],
      setup: {
        ...state.setup,
        placementIndex: nextPlacementIndex,
        pendingRoadNodeId: null,
        completed: true,
      },
    };
  }

  return {
    ...state,
    activePlayerId: nextPlayerId,
    phase: "setup-settlement" as const,
    momentumAidUsed: {
      player: false,
      leah: false,
      sam: false,
    },
    latestLog: [`轮到 ${getPlayerLabel(nextPlayerId)} 放置第 ${getPlacementRoundLabel(state.setup.placementOrder, nextPlacementIndex, nextPlayerId)} 个起始定居点。`],
    setup: {
      ...state.setup,
      placementIndex: nextPlacementIndex,
      pendingRoadNodeId: null,
    },
  };
}

function getPlayerLabel(playerId: CatanPlayerId) {
  return playerId === "player" ? "你" : playerId === "leah" ? "Leah" : "Sam";
}

function getPlacementRoundLabel(
  placementOrder: CatanPlayerId[],
  placementIndex: number,
  playerId: CatanPlayerId,
) {
  const placementCount = placementOrder
    .slice(0, placementIndex + 1)
    .filter((candidate) => candidate === playerId).length;

  return placementCount === 1 ? "一" : "二";
}
