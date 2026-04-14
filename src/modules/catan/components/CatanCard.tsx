import { useEffect, useMemo, useRef, useState } from "react";
import { useEventBus } from "../../../bus/EventBusContext";
import { ScenePanel } from "../../../ui/ScenePanel";
import { TextButton } from "../../../ui/TextButton";
import { chooseBaselineAiIntent } from "../aiPolicy";
import { createInitialCatanState, applyCatanIntent, canAffordWithMomentumAssist } from "../catanEngine";
import { createMatchSnapshot } from "../createMatchSnapshot";
import {
  buildCosts,
  developmentCardCost,
  type CatanIntent,
  type CatanMatchState,
  type CatanPlayerId,
  type CatanResource,
  type CatanResourceState,
} from "../engineTypes";
import {
  getAvailableSetupRoadEdges,
  getAvailableSetupSettlementNodes,
  getAvailableCityNodes,
  getAvailableRoadEdges,
  getAvailableSettlementNodes,
  getNodeProductionWeight,
} from "../placementRules";
import {
  formatDemandSummary,
  getTradeGiveLabel,
  getTradeReceiveLabel,
  getTradeReceiveResources,
  getTradeSources,
  type TradeSource,
} from "../tradeRules";

type CatanCardProps = {
  onComplete: () => void;
  onExit: () => void;
};

const AI_ACTION_DELAY_MS = 1450;

const resourceLabels: Record<CatanResource, string> = {
  wood: "木材",
  brick: "砖块",
  grain: "小麦",
  ore: "矿石",
  wool: "羊毛",
};

const phaseLabels: Record<CatanMatchState["phase"], string> = {
  "setup-settlement": "开局放定居点",
  "setup-road": "开局放道路",
  roll: "掷骰阶段",
  "robber-discard": "强盗弃牌",
  robber: "强盗阶段",
  "robber-steal": "强盗偷牌",
  trade: "交易阶段",
  build: "建造阶段",
  gameOver: "对局结束",
};

function canAfford(resources: CatanResourceState, cost: Partial<CatanResourceState>) {
  return Object.entries(cost).every(([resource, count]) => {
    return resources[resource as CatanResource] >= (count ?? 0);
  });
}

function sortNodesByValue(state: CatanMatchState, nodeIds: number[]) {
  return [...nodeIds].sort((left, right) => {
    return getNodeProductionWeight(state.graph, right) - getNodeProductionWeight(state.graph, left);
  });
}

export function CatanCard({ onComplete, onExit }: CatanCardProps) {
  const manualQaEnabled = import.meta.env.DEV;
  const bus = useEventBus();
  const [match, setMatch] = useState(() => createInitialCatanState());
  const [uiNote, setUiNote] = useState<string | null>(null);
  const [tradeMenuOpen, setTradeMenuOpen] = useState(false);
  const [developmentMenuOpen, setDevelopmentMenuOpen] = useState(false);
  const [selectedDevelopmentAction, setSelectedDevelopmentAction] = useState<"harvest" | "monopoly" | null>(null);
  const [developmentResourceSelection, setDevelopmentResourceSelection] = useState<CatanResource[]>([]);
  const [selectedTradeSource, setSelectedTradeSource] = useState<TradeSource | null>(null);
  const [tradeGiveResource, setTradeGiveResource] = useState<CatanResource | null>(null);
  const [selectedBuildAction, setSelectedBuildAction] = useState<"road" | "settlement" | "city" | null>(null);
  const completionReportedRef = useRef(false);

  useEffect(() => {
    if (match.winnerId === "player" && !completionReportedRef.current) {
      completionReportedRef.current = true;
      onComplete();
    }
  }, [match.winnerId, onComplete]);

  useEffect(() => {
    if (match.phase === "gameOver" || match.activePlayerId === "player") {
      return;
    }

    const aiIntent = chooseBaselineAiIntent(match, match.activePlayerId);

    if (!aiIntent) {
      return;
    }

    const timer = window.setTimeout(() => {
      setMatch((currentState) => {
        if (
          currentState.phase !== match.phase ||
          currentState.activePlayerId !== match.activePlayerId
        ) {
          return currentState;
        }

        return applyCatanIntent(currentState, aiIntent).state;
      });
    }, AI_ACTION_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [match]);

  const player = match.players.player;
  const canPlayerAct = match.activePlayerId === "player" && match.phase !== "gameOver";
  const canPlayerResolveRobberDiscard =
    match.phase === "robber-discard" && match.robber.discardRemaining > 0;
  const canPlayerResolveRobberSteal =
    match.phase === "robber-steal" && match.robber.stealableVictimIds.length > 0;
  const usableDevelopmentCards = {
    knight: Math.max(player.developmentCards.knight - player.freshDevelopmentCards.knight, 0),
    harvest: Math.max(player.developmentCards.harvest - player.freshDevelopmentCards.harvest, 0),
    roadBuilding: Math.max(player.developmentCards.roadBuilding - player.freshDevelopmentCards.roadBuilding, 0),
    monopoly: Math.max(player.developmentCards.monopoly - player.freshDevelopmentCards.monopoly, 0),
  };
  const hasAnyDevelopmentCard =
    usableDevelopmentCards.knight > 0 ||
    usableDevelopmentCards.harvest > 0 ||
    usableDevelopmentCards.roadBuilding > 0 ||
    usableDevelopmentCards.monopoly > 0;
  const affordableRoad = canAffordWithMomentumAssist(match, "player", buildCosts["build-road"]);
  const affordableSettlement = canAffordWithMomentumAssist(match, "player", buildCosts["build-settlement"]);
  const affordableCity = canAffordWithMomentumAssist(match, "player", buildCosts["upgrade-city"]);
  const affordableDevelopmentCard = canAffordWithMomentumAssist(match, "player", developmentCardCost, "development");
  const largestArmyOwner = useMemo(() => {
    const entries = (Object.keys(match.players) as Array<keyof typeof match.players>).map((playerId) => ({
      playerId,
      count: match.players[playerId].knightsPlayed,
    }));
    const maxCount = Math.max(...entries.map((entry) => entry.count), 0);

    if (maxCount < 3) {
      return null;
    }

    const leaders = entries.filter((entry) => entry.count === maxCount);
    return leaders.length === 1 ? leaders[0].playerId : null;
  }, [match.players]);
  const longestRoadInfo = useMemo(() => getLongestRoadInfo(match), [match]);

  const availableRoadEdges = useMemo(
    () => {
      if (match.phase === "setup-road") {
      return getAvailableSetupRoadEdges(match, "player");
      }

      return affordableRoad || match.freeRoadBuildsRemaining > 0 ? getAvailableRoadEdges(match, "player") : [];
    },
    [affordableRoad, match],
  );
  const availableSettlementNodes = useMemo(
    () => {
      if (match.phase === "setup-settlement") {
        return sortNodesByValue(match, getAvailableSetupSettlementNodes(match));
      }

      return affordableSettlement ? sortNodesByValue(match, getAvailableSettlementNodes(match, "player")) : [];
    },
    [affordableSettlement, match],
  );
  const availableCityNodes = useMemo(
    () => (affordableCity ? sortNodesByValue(match, getAvailableCityNodes(match, "player")) : []),
    [affordableCity, match],
  );
  const availableRobberTileIds = useMemo(
    () =>
      match.phase === "robber"
        ? match.graph.tiles
            .filter((tile) => tile.id !== match.robberTileId)
            .map((tile) => tile.id)
        : [],
    [match.graph.tiles, match.phase, match.robberTileId],
  );
  const tradeSources = useMemo(
    () => getTradeSources(match, "player"),
    [match],
  );
  const tradeGiveOptions = selectedTradeSource?.giveResources ?? [];
  const tradeReceiveOptions = useMemo(
    () =>
      tradeGiveResource
        ? getTradeReceiveResources(tradeGiveResource)
        : [],
    [tradeGiveResource],
  );
  const resourceSummary = useMemo(
    () =>
      (Object.entries(player.resources) as Array<[CatanResource, number]>)
        .map(([resource, count]) => `${resourceLabels[resource]} ${count}`)
        .join(" / "),
    [player.resources],
  );
  const developmentSummary = useMemo(() => {
    const entries: string[] = [];

    if (player.developmentCards.knight > 0) {
      entries.push(`骑士 ${player.developmentCards.knight}`);
    }

    if (player.developmentCards.harvest > 0) {
      entries.push(`丰收 ${player.developmentCards.harvest}`);
    }

    if (player.developmentCards.roadBuilding > 0) {
      entries.push(`道路建设 ${player.developmentCards.roadBuilding}`);
    }

    if (player.developmentCards.monopoly > 0) {
      entries.push(`垄断 ${player.developmentCards.monopoly}`);
    }

    if (player.bonusVictoryPoints > 0) {
      entries.push(`得分 +${player.bonusVictoryPoints}`);
    }

    return entries.join(" / ");
  }, [player.bonusVictoryPoints, player.developmentCards]);
  const boardSnapshot = useMemo(
    () =>
      createMatchSnapshot(match, {
        availableRoadEdges:
          canPlayerAct &&
          selectedBuildAction === "road" &&
          (match.phase === "trade" || match.phase === "build" || match.phase === "setup-road")
            ? availableRoadEdges
            : [],
        availableSettlementNodes:
          canPlayerAct &&
          selectedBuildAction === "settlement" &&
          (match.phase === "trade" || match.phase === "build" || match.phase === "setup-settlement")
            ? availableSettlementNodes
            : [],
        availableCityNodes:
          canPlayerAct && selectedBuildAction === "city" && (match.phase === "trade" || match.phase === "build")
            ? availableCityNodes
            : [],
        availableRobberTileIds: canPlayerAct && match.phase === "robber" ? availableRobberTileIds : [],
      }),
    [
      availableCityNodes,
      availableRoadEdges,
      availableRobberTileIds,
      availableSettlementNodes,
      canPlayerAct,
      match,
      selectedBuildAction,
    ],
  );

  useEffect(() => {
    if (match.phase === "setup-settlement") {
      setSelectedBuildAction("settlement");
      return;
    }

    if (match.phase === "setup-road") {
      setSelectedBuildAction("road");
      return;
    }

    if (match.phase !== "trade" && match.phase !== "build") {
      setSelectedBuildAction(null);
      setTradeMenuOpen(false);
      setDevelopmentMenuOpen(false);
      setSelectedDevelopmentAction(null);
      setDevelopmentResourceSelection([]);
      setSelectedTradeSource(null);
      setTradeGiveResource(null);
    }
  }, [match.phase]);

  useEffect(() => {
    bus.commands.emit("catan/rebuild-show-state", boardSnapshot);
  }, [boardSnapshot, bus.commands]);

  useEffect(() => {
    return bus.events.subscribe("catan/rebuild-request-state", () => {
      bus.commands.emit("catan/rebuild-show-state", boardSnapshot);
    });
  }, [boardSnapshot, bus.commands, bus.events]);

  useEffect(() => {
    return bus.events.subscribe("catan/rebuild-intent-selected", ({ intent }) => {
      runIntent(intent);
    });
  }, [bus.events, match.activePlayerId, match.phase]);

  useEffect(() => {
    if (!manualQaEnabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }

      if (event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        finishForManualQa();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [manualQaEnabled]);

  function runIntent(intent: CatanIntent) {
    let nextNote: string | null = null;
    let shouldClearSelection = false;

    setMatch((currentState) => {
      const result = applyCatanIntent(currentState, intent);
      nextNote = result.applied ? null : result.reason ?? "这一步当前无法执行。";
      shouldClearSelection =
        result.applied &&
        ((intent.type === "build-road" && result.state.freeRoadBuildsRemaining <= 0) ||
          intent.type === "build-settlement" ||
          intent.type === "upgrade-city");
      return result.state;
    });

    setUiNote(nextNote);

    if (shouldClearSelection) {
      setSelectedBuildAction(null);
    }
  }

  function finishForManualQa() {
    setUiNote(null);
    setTradeMenuOpen(false);
    setDevelopmentMenuOpen(false);
    setSelectedDevelopmentAction(null);
    setDevelopmentResourceSelection([]);
    setSelectedTradeSource(null);
    setTradeGiveResource(null);
    setSelectedBuildAction(null);

    setMatch((currentState) => {
      if (currentState.phase === "gameOver" && currentState.winnerId === "player") {
        return currentState;
      }

      return {
        ...currentState,
        activePlayerId: "player",
        phase: "gameOver",
        winnerId: "player",
        latestLog: ["已快速结束对局，当前判定玩家获胜。"],
        players: {
          ...currentState.players,
          player: {
            ...currentState.players.player,
            victoryPoints: Math.max(currentState.players.player.victoryPoints, 10),
          },
        },
      };
    });
  }

  const phaseSummary = match.phase === "gameOver"
    ? match.winnerId === "player"
      ? "你赢下了这一局。"
      : `${match.players[match.winnerId ?? "leah"].label} 获胜。`
    : match.activePlayerId === "player"
      ? phaseLabels[match.phase]
      : `${match.players[match.activePlayerId].label}行动`;
  const statusLog = [uiNote, ...match.latestLog]
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, 6);
  const actionButtons = [
    {
      key: "roll",
      label: "掷骰",
      onClick: () => runIntent({ type: "roll-dice" }),
      disabled: !canPlayerAct || match.phase !== "roll",
    },
    {
      key: "development",
      label: "发展卡",
      onClick: () => {
        setTradeMenuOpen(false);
        setSelectedTradeSource(null);
        setTradeGiveResource(null);
        setSelectedBuildAction(null);
        setDevelopmentMenuOpen((open) => !open);
        setSelectedDevelopmentAction(null);
        setDevelopmentResourceSelection([]);
        setUiNote(null);
      },
      disabled:
        !canPlayerAct ||
        (match.phase !== "trade" && match.phase !== "build") ||
        (!affordableDevelopmentCard && !hasAnyDevelopmentCard),
    },
    {
      key: "trade",
      label: "交易",
      onClick: () => {
        if (!tradeSources.some((source) => source.giveResources.length > 0)) {
          setUiNote("当前没有可用交易。");
          return;
        }

        setSelectedBuildAction(null);
        setDevelopmentMenuOpen(false);
        setSelectedDevelopmentAction(null);
        setDevelopmentResourceSelection([]);
        setTradeMenuOpen((open) => !open);
        setSelectedTradeSource(null);
        setTradeGiveResource(null);
        setUiNote(null);
      },
      disabled: !canPlayerAct || (match.phase !== "trade" && match.phase !== "build"),
    },
    {
      key: "road",
      label: "道路",
      onClick: () => {
        setTradeMenuOpen(false);
        setDevelopmentMenuOpen(false);
        setSelectedDevelopmentAction(null);
        setDevelopmentResourceSelection([]);
        setSelectedTradeSource(null);
        setTradeGiveResource(null);
        setSelectedBuildAction("road");
        setUiNote(null);
      },
      disabled:
        !canPlayerAct ||
        !(
          match.phase === "setup-road" ||
          ((match.phase === "trade" || match.phase === "build") &&
            (affordableRoad || match.freeRoadBuildsRemaining > 0))
        ),
    },
    {
      key: "settlement",
      label: "村庄",
      onClick: () => {
        setTradeMenuOpen(false);
        setDevelopmentMenuOpen(false);
        setSelectedDevelopmentAction(null);
        setDevelopmentResourceSelection([]);
        setSelectedTradeSource(null);
        setTradeGiveResource(null);
        setSelectedBuildAction("settlement");
        setUiNote(null);
      },
      disabled:
        !canPlayerAct ||
        !(
          match.phase === "setup-settlement" ||
          ((match.phase === "trade" || match.phase === "build") && affordableSettlement)
        ),
    },
    {
      key: "city",
      label: "城市",
      onClick: () => {
        setTradeMenuOpen(false);
        setDevelopmentMenuOpen(false);
        setSelectedDevelopmentAction(null);
        setDevelopmentResourceSelection([]);
        setSelectedTradeSource(null);
        setTradeGiveResource(null);
        setSelectedBuildAction("city");
        setUiNote(null);
      },
      disabled: !canPlayerAct || !(match.phase === "trade" || match.phase === "build") || !affordableCity,
    },
  ];
  const discardOptions = (Object.keys(resourceLabels) as CatanResource[]).filter(
    (resource) => player.resources[resource] > 0,
  );

  return (
    <ScenePanel>
      <div className="catan-sidebar-layout">
        <div className="catan-sidebar-grid">
          <section className="resource-panel catan-status-panel">
            <div className="panel-heading">
              <h3>状态</h3>
              <span>{player.victoryPoints} / 10 分</span>
            </div>
            <p className="catan-resource-line">{resourceSummary}</p>
            {developmentSummary ? (
              <p className="catan-resource-line catan-resource-line--development">{developmentSummary}</p>
            ) : null}
            <div className="catan-note-stack">
              <p className="catan-panel-note catan-panel-note--trade">海岸边点位可进行 3:1 贸易。</p>
              {Object.values(player.freshDevelopmentCards).some((count) => count > 0) ? (
                <p className="catan-panel-note catan-panel-note--trade">
                  新购发展卡本回合不可用
                  {player.freshDevelopmentCards.knight > 0 ? ` / 骑士 ${player.freshDevelopmentCards.knight}` : ""}
                  {player.freshDevelopmentCards.harvest > 0 ? ` / 丰收 ${player.freshDevelopmentCards.harvest}` : ""}
                  {player.freshDevelopmentCards.roadBuilding > 0 ? ` / 道路建设 ${player.freshDevelopmentCards.roadBuilding}` : ""}
                  {player.freshDevelopmentCards.monopoly > 0 ? ` / 垄断 ${player.freshDevelopmentCards.monopoly}` : ""}
                </p>
              ) : null}
              <p className="catan-panel-note catan-panel-note--army">
                已打出骑士 {player.knightsPlayed}
                {largestArmyOwner ? ` / 最大骑士力：${match.players[largestArmyOwner].label}` : ""}
              </p>
              <p className="catan-panel-note catan-panel-note--army">
                最长道路 {longestRoadInfo.length}
                {longestRoadInfo.owner ? ` / 道路王：${match.players[longestRoadInfo.owner].label}` : ""}
              </p>
              {match.freeRoadBuildsRemaining > 0 ? (
                <p className="catan-panel-note catan-panel-note--bonus">道路建设生效中：还可免费修路 {match.freeRoadBuildsRemaining} 次。</p>
              ) : null}
              <p className="catan-panel-note catan-panel-note--builds">剩余可修 路 {player.roadsLeft} / 村 {player.settlementsLeft} / 城 {player.citiesLeft}</p>
            </div>
          </section>

          <section className="resource-panel catan-actions-panel">
            <div className="panel-heading">
              <h3>操作</h3>
              <span>{phaseLabels[match.phase]}</span>
            </div>
            <div className="catan-action-column">
            {canPlayerResolveRobberDiscard ? (
              <>
                <p className="catan-panel-note catan-panel-note--army">
                  你需要弃掉 {match.robber.discardRemaining} 张手牌。
                </p>
                {discardOptions.map((resource) => (
                  <TextButton
                    key={`discard-${resource}`}
                    label={`弃掉 1 ${resourceLabels[resource]} (${player.resources[resource]})`}
                    onClick={() => runIntent({ type: "discard-resource", resource })}
                  />
                ))}
              </>
            ) : canPlayerResolveRobberSteal ? (
              <>
                <p className="catan-panel-note catan-panel-note--army">请选择一名相邻玩家进行偷取。</p>
                {match.robber.stealableVictimIds.map((victimId) => (
                  <TextButton
                    key={`victim-${victimId}`}
                    label={`偷取 ${match.players[victimId].label}`}
                    onClick={() => runIntent({ type: "steal-from-player", victimId })}
                  />
                ))}
              </>
            ) : developmentMenuOpen ? (
              <>
                <TextButton
                  label="返回"
                  onClick={() => {
                    setDevelopmentMenuOpen(false);
                    setSelectedDevelopmentAction(null);
                    setDevelopmentResourceSelection([]);
                  }}
                />
                <TextButton
                  label="买发展卡"
                  onClick={() => {
                    runIntent({ type: "buy-development-card" });
                    setSelectedDevelopmentAction(null);
                    setDevelopmentResourceSelection([]);
                  }}
                  disabled={!affordableDevelopmentCard}
                />
                <TextButton
                  label={`打出骑士${player.developmentCards.knight > 0 ? ` (${player.developmentCards.knight})` : ""}`}
                  onClick={() => {
                    runIntent({ type: "play-knight" });
                    setDevelopmentMenuOpen(false);
                    setSelectedDevelopmentAction(null);
                    setDevelopmentResourceSelection([]);
                  }}
                  disabled={usableDevelopmentCards.knight <= 0 || match.phase === "robber"}
                />
                <TextButton
                  label={`打出丰收${player.developmentCards.harvest > 0 ? ` (${player.developmentCards.harvest})` : ""}`}
                  onClick={() => {
                    setSelectedDevelopmentAction((current) => (current === "harvest" ? null : "harvest"));
                    setDevelopmentResourceSelection([]);
                  }}
                  disabled={usableDevelopmentCards.harvest <= 0}
                />
                <TextButton
                  label={`打出道路建设${player.developmentCards.roadBuilding > 0 ? ` (${player.developmentCards.roadBuilding})` : ""}`}
                  onClick={() => {
                    runIntent({ type: "play-road-building" });
                    setSelectedBuildAction("road");
                    setDevelopmentMenuOpen(false);
                    setSelectedDevelopmentAction(null);
                    setDevelopmentResourceSelection([]);
                  }}
                  disabled={usableDevelopmentCards.roadBuilding <= 0}
                />
                <TextButton
                  label={`打出垄断${player.developmentCards.monopoly > 0 ? ` (${player.developmentCards.monopoly})` : ""}`}
                  onClick={() => {
                    setSelectedDevelopmentAction((current) => (current === "monopoly" ? null : "monopoly"));
                    setDevelopmentResourceSelection([]);
                  }}
                  disabled={usableDevelopmentCards.monopoly <= 0}
                />
                {selectedDevelopmentAction === "harvest" ? (
                  <>
                    <p className="catan-panel-note catan-panel-note--development">
                      选择 2 个资源
                      {developmentResourceSelection.length > 0
                        ? `：${developmentResourceSelection.map((resource) => resourceLabels[resource]).join("、")}`
                        : ""}
                    </p>
                    {(Object.keys(resourceLabels) as CatanResource[]).map((resource) => (
                      <TextButton
                        key={`harvest-${resource}`}
                        label={`选择 ${resourceLabels[resource]}`}
                        onClick={() => {
                          setDevelopmentResourceSelection((current) =>
                            current.length >= 2 ? current : [...current, resource],
                          );
                        }}
                      />
                    ))}
                    <TextButton
                      label="清空丰收选择"
                      onClick={() => setDevelopmentResourceSelection([])}
                      disabled={developmentResourceSelection.length === 0}
                    />
                    <TextButton
                      label="确认打出丰收"
                      onClick={() => {
                        runIntent({
                          type: "play-harvest",
                          resources: [
                            developmentResourceSelection[0]!,
                            developmentResourceSelection[1]!,
                          ],
                        });
                        setDevelopmentMenuOpen(false);
                        setSelectedDevelopmentAction(null);
                        setDevelopmentResourceSelection([]);
                      }}
                      disabled={developmentResourceSelection.length !== 2}
                    />
                  </>
                ) : null}
                {selectedDevelopmentAction === "monopoly" ? (
                  <>
                    <p className="catan-panel-note catan-panel-note--development">选择一种资源，拿走其他玩家的全部该类资源。</p>
                    {(Object.keys(resourceLabels) as CatanResource[]).map((resource) => (
                      <TextButton
                        key={`monopoly-${resource}`}
                        label={`垄断 ${resourceLabels[resource]}`}
                        onClick={() => {
                          runIntent({ type: "play-monopoly", resource });
                          setDevelopmentMenuOpen(false);
                          setSelectedDevelopmentAction(null);
                          setDevelopmentResourceSelection([]);
                        }}
                      />
                    ))}
                  </>
                ) : null}
              </>
            ) : (
              <>
                {actionButtons.map((action) => (
                  <TextButton
                    key={action.key}
                    label={action.label}
                    onClick={action.onClick}
                    disabled={action.disabled}
                  />
                ))}
                {tradeMenuOpen
                  ? selectedTradeSource === null
                    ? tradeSources.map((source) => (
                        <TextButton
                          key={source.id}
                          label={source.type === "npc" ? `${source.label} · ${source.reason}` : source.label}
                          onClick={() => {
                            setSelectedTradeSource(source);
                            setTradeGiveResource(null);
                          }}
                          disabled={source.giveResources.length === 0}
                        />
                      ))
                    : selectedTradeSource.type === "npc"
                      ? (
                          <>
                            <p className="catan-panel-note catan-panel-note--trade">
                              {match.players[selectedTradeSource.npcId].label} 开价：{formatDemandSummary(selectedTradeSource.demands)}
                            </p>
                            {selectedTradeSource.giveResources.map((resource) => (
                              <TextButton
                                key={`npc-${selectedTradeSource.npcId}-${resource}`}
                                label={`交出 ${formatDemandSummary(selectedTradeSource.demands)} / 换取 1 ${resourceLabels[resource]}`}
                                onClick={() => {
                                  runIntent({
                                    type: "trade-npc",
                                    npcId: selectedTradeSource.npcId,
                                    receive: resource,
                                    demands: selectedTradeSource.demands,
                                  });
                                  setTradeMenuOpen(false);
                                  setSelectedTradeSource(null);
                                  setTradeGiveResource(null);
                                }}
                              />
                            ))}
                          </>
                        )
                      : tradeGiveResource === null
                        ? tradeGiveOptions.map((resource) => (
                            <TextButton
                              key={resource}
                              label={getTradeGiveLabel(resource, selectedTradeSource.rate)}
                              onClick={() => setTradeGiveResource(resource)}
                            />
                          ))
                        : tradeReceiveOptions.map((resource) => (
                            <TextButton
                              key={`${tradeGiveResource}-${resource}`}
                              label={getTradeReceiveLabel(resource)}
                              onClick={() => {
                                if (selectedTradeSource.type === "bank") {
                                  runIntent({ type: "trade-bank", give: tradeGiveResource, receive: resource });
                                } else {
                                  runIntent({
                                    type: "trade-port",
                                    portId: 0,
                                    give: tradeGiveResource,
                                    receive: resource,
                                  });
                                }
                                setTradeMenuOpen(false);
                                setSelectedTradeSource(null);
                                setTradeGiveResource(null);
                              }}
                            />
                          ))
                  : null}
                {tradeMenuOpen && (selectedTradeSource !== null || tradeGiveResource !== null) ? (
                  <TextButton
                    label="返回交易"
                    onClick={() => {
                      if (tradeGiveResource !== null) {
                        setTradeGiveResource(null);
                        return;
                      }

                      setSelectedTradeSource(null);
                    }}
                  />
                ) : null}
                <TextButton
                  label="结束回合"
                  onClick={() => runIntent({ type: "end-turn" })}
                  disabled={!canPlayerAct || (match.phase !== "trade" && match.phase !== "build")}
                />
              </>
            )}
            </div>
          </section>
        </div>
        <section className="resource-panel catan-log-panel">
          <div className="panel-heading">
            <h3>动态</h3>
          </div>
          <ul className="story-log">
            {statusLog.length > 0 ? (
              statusLog.map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)
            ) : (
              <li>等待这一局开始。</li>
            )}
          </ul>
        </section>
        <div className="catan-sidebar-footer">
          {manualQaEnabled ? (
            <TextButton label="快速胜利并返回地图 (Shift+K)" onClick={finishForManualQa} />
          ) : null}
          <TextButton label="返回地图" onClick={onExit} />
        </div>
      </div>
    </ScenePanel>
  );
}

function getLongestRoadInfo(match: CatanMatchState) {
  const entries = (Object.keys(match.players) as CatanPlayerId[]).map((playerId) => ({
    playerId,
    length: getPlayerLongestRoad(match, playerId),
  }));
  const maxLength = Math.max(...entries.map((entry) => entry.length), 0);
  const leaders = entries.filter((entry) => entry.length === maxLength && entry.length > 5);

  return {
    owner: leaders.length === 1 ? leaders[0].playerId : null,
    length: maxLength,
  };
}

function getPlayerLongestRoad(match: CatanMatchState, playerId: CatanPlayerId) {
  const ownedEdges = match.graph.edges.filter((edge) => match.occupiedEdges[edge.id] === playerId);

  if (ownedEdges.length === 0) {
    return 0;
  }

  const adjacentOwnedEdges = new Map<number, number[]>();

  match.graph.nodes.forEach((node) => {
    adjacentOwnedEdges.set(
      node.id,
      node.adjacentEdgeIds.filter((edgeId) => match.occupiedEdges[edgeId] === playerId),
    );
  });

  function blocked(nodeId: number) {
    const occupant = match.occupiedNodes[nodeId];
    return Boolean(occupant && occupant.owner !== playerId);
  }

  function dfs(edgeId: number, comingFromNodeId: number | null, visited: Set<number>): number {
    const edge = match.graph.edges[edgeId];

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

      if (blocked(nodeId)) {
        return;
      }

      (adjacentOwnedEdges.get(nodeId) ?? []).forEach((candidateEdgeId) => {
        if (nextVisited.has(candidateEdgeId)) {
          return;
        }

        best = Math.max(best, 1 + dfs(candidateEdgeId, nodeId, nextVisited));
      });
    });

    return best;
  }

  return ownedEdges.reduce((best, edge) => {
    return Math.max(best, dfs(edge.id, null, new Set()));
  }, 0);
}
