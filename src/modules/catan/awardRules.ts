import { scriptedTurns } from "./config/script";
import { getLongestRoadLength } from "./boardRules";
import type { BoardOwner, CatanAwardState, CatanBoardState } from "./types";

const awardOwners: BoardOwner[] = ["player", "leah", "sam"];

function getUniqueLeader(values: Record<BoardOwner, number>, threshold: number) {
  const entries = awardOwners
    .map((owner) => ({ owner, value: values[owner] }))
    .sort((left, right) => right.value - left.value);

  if (entries[0].value < threshold) {
    return null;
  }

  if (entries[0].value === entries[1].value) {
    return null;
  }

  return entries[0].owner;
}

function getKnightCounts(completedTurnCount: number): Record<BoardOwner, number> {
  return scriptedTurns.slice(0, completedTurnCount).reduce<Record<BoardOwner, number>>(
    (counts, turn) => {
      if (turn.robber.targetOwner === "player") {
        return { ...counts, leah: counts.leah + 1 };
      }

      return { ...counts, player: counts.player + 1 };
    },
    { player: 0, leah: 0, sam: 0 },
  );
}

export function deriveAwardState(
  board: CatanBoardState,
  completedTurnCount: number,
): CatanAwardState {
  const roadLengths: Record<BoardOwner, number> = {
    player: getLongestRoadLength(board, "player"),
    leah: getLongestRoadLength(board, "leah"),
    sam: getLongestRoadLength(board, "sam"),
  };
  const knightCounts = getKnightCounts(completedTurnCount);
  const longestRoadOwner = getUniqueLeader(roadLengths, 3);
  const largestArmyOwner = getUniqueLeader(knightCounts, 3);
  const bonusPoints: Record<BoardOwner, number> = { player: 0, leah: 0, sam: 0 };

  if (longestRoadOwner) {
    bonusPoints[longestRoadOwner] += 2;
  }

  if (largestArmyOwner) {
    bonusPoints[largestArmyOwner] += 2;
  }

  return {
    longestRoadOwner,
    largestArmyOwner,
    roadLengths,
    knightCounts,
    bonusPoints,
  };
}
