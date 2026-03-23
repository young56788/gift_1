import type { CatanMatchSnapshot, CatanMatchState } from "./engineTypes";

export function createMatchSnapshot(
  state: CatanMatchState,
  options: {
    availableRoadEdges: number[];
    availableSettlementNodes: number[];
    availableCityNodes: number[];
    availableRobberTileIds: number[];
  },
): CatanMatchSnapshot {
  return {
    turnNumber: state.turnNumber,
    phase: state.phase,
    activePlayerId: state.activePlayerId,
    robberTileId: state.robberTileId,
    robberDiscardRemaining: state.robber.discardRemaining,
    robberVictimIds: state.robber.stealableVictimIds,
    setupPendingNodeId: state.setup.pendingRoadNodeId,
    dice: state.dice,
    winnerId: state.winnerId,
    momentumPhase: state.momentumPhase,
    freeRoadBuildsRemaining: state.freeRoadBuildsRemaining,
    players: {
      player: {
        id: state.players.player.id,
        label: state.players.player.label,
        victoryPoints: state.players.player.victoryPoints,
      },
      leah: {
        id: state.players.leah.id,
        label: state.players.leah.label,
        victoryPoints: state.players.leah.victoryPoints,
      },
      sam: {
        id: state.players.sam.id,
        label: state.players.sam.label,
        victoryPoints: state.players.sam.victoryPoints,
      },
    },
    occupiedNodes: state.occupiedNodes,
    occupiedEdges: state.occupiedEdges,
    availableRoadEdges: options.availableRoadEdges,
    availableSettlementNodes: options.availableSettlementNodes,
    availableCityNodes: options.availableCityNodes,
    availableRobberTileIds: options.availableRobberTileIds,
    latestLog: state.latestLog,
  };
}
