import type {
  CatanAwardState,
  CatanBoardSnapshot,
  ScriptedAction,
  ScriptedCatanState,
  ScriptedTurn,
} from "./types";
import { developmentCardLabels, resourceLabels } from "./config/script";
import { describeActionTarget } from "./config/targets";

function formatResourceDelta(prefix: string, delta?: Partial<Record<keyof typeof resourceLabels, number>>) {
  if (!delta) {
    return null;
  }

  const segments = Object.entries(delta)
    .filter(([, count]) => Boolean(count))
    .map(([resource, count]) => `${resourceLabels[resource as keyof typeof resourceLabels]} ${count}`);

  return segments.length > 0 ? `${prefix}${segments.join(" / ")}` : null;
}

function createActionPreview(action: ScriptedAction) {
  return [
    action.useDevelopmentCard
      ? `打出 ${developmentCardLabels[action.useDevelopmentCard]}`
      : null,
    action.gainDevelopmentCards
      ? formatDevelopmentCardDelta("获得 ", action.gainDevelopmentCards)
      : null,
    formatResourceDelta("支付 ", action.spend),
    formatResourceDelta("获得 ", action.gain),
    action.pointGain > 0 ? `推进 ${action.pointGain} 分` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join(" · ");
}

function formatDevelopmentCardDelta(
  prefix: string,
  delta?: Partial<Record<keyof typeof developmentCardLabels, number>>,
) {
  if (!delta) {
    return null;
  }

  const segments = Object.entries(delta)
    .filter(([, count]) => Boolean(count))
    .map(
      ([card, count]) =>
        `${developmentCardLabels[card as keyof typeof developmentCardLabels]} ${count}`,
    );

  return segments.length > 0 ? `${prefix}${segments.join(" / ")}` : null;
}

export function createBoardSnapshot(
  game: ScriptedCatanState,
  currentTurn: ScriptedTurn | null,
  availableActions: Array<ScriptedAction & { disabled: boolean }>,
  awards: CatanAwardState,
  scores: { player: number; leah: number; sam: number },
): CatanBoardSnapshot {
  const recommendedAction =
    availableActions.find((action) => action.recommended && !action.disabled) ??
    availableActions.find((action) => !action.disabled) ??
    availableActions[0] ??
    null;

  return {
    turn: currentTurn?.turn ?? 6,
    phase: game.phase,
    title: currentTurn?.title ?? "终局翻盘",
    summary: game.summary,
    activeActionLabel: recommendedAction?.label ?? null,
    completed: game.completed,
    playerPoints: scores.player,
    opponents: {
      leah: scores.leah,
      sam: scores.sam,
    },
    robberTileId: currentTurn?.robber.tileId ?? (game.completed ? 3 : 0),
    robber: currentTurn?.robber ?? {
      tileId: game.completed ? 3 : 0,
      note: "强盗已经停下，整局对抗也随着你的胜利收住了。",
      targetOwner: "sam",
    },
    recentSteal: game.recentSteal,
    recentDevelopmentEvent: game.recentDevelopmentEvent,
    awards,
    dice: currentTurn
      ? {
          left: currentTurn.dice[0],
          right: currentTurn.dice[1],
          total: currentTurn.dice[0] + currentTurn.dice[1],
        }
      : { left: 0, right: 0, total: 0 },
    production: currentTurn?.production ?? {
      note: "终局已经落定，不再进行新的资源分发。",
      activatedTileIds: [],
      player: {},
      opponents: {},
    },
    developmentCards: game.developmentCards,
    roads: game.board.roads,
    nodes: game.board.nodes,
    choices: availableActions.map((action) => ({
      id: action.id,
      label: action.label,
      description: action.description,
      preview: createActionPreview(action) || null,
      targetLabel: describeActionTarget(action.target),
      recommended: Boolean(action.recommended),
      disabled: action.disabled,
      target: action.target,
    })),
    latestLog: game.log.slice(0, 3),
  };
}
