import { useEffect, useMemo, useState } from "react";
import { useEventBus } from "../../bus/EventBusContext";
import { PhaserHost } from "../../phaser/PhaserHost";
import { useGameStore } from "../../store/gameStore";
import { ScenePanel } from "../../ui/ScenePanel";
import { TextButton } from "../../ui/TextButton";
import { FestivalMapOverlay } from "../../modules/festival/components/FestivalMapOverlay";
import { appShellContent, mapSceneContent } from "../../modules/map/config/content";
import { shrimpSceneContent } from "../../modules/shrimp/config/content";
import { CatanCard } from "../../modules/catan/components/CatanCard";
import type { FestivalCelebrationStep } from "../../modules/map/config/content";

type SystemErrorPayload = {
  source: string;
  message: string;
  code?: string;
  recoverable?: boolean;
  actionHint?: string;
};

type NoteCard = {
  title: string;
  amountText?: string;
  redeemCode?: string;
  itemText?: string;
};

type PhaserDebugState = {
  reason: string;
  gameReady: boolean;
  managedSceneIds: Array<"map" | "shrimp" | "catan">;
  activeSceneIds: Array<"map" | "shrimp" | "catan">;
  sleepingSceneIds: Array<"map" | "shrimp" | "catan">;
  pendingSceneLoads: Array<"map" | "shrimp" | "catan">;
  pendingSceneUnloads: Array<"map" | "shrimp" | "catan">;
};

function formatRemainingGiftPounds(coinBalance: number) {
  const pounds = Math.max(0, 52 - Math.abs(coinBalance) / 100);
  const text = pounds.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  return `${text}英镑`;
}

function useBusBridge(
  onFestivalGiftOpened?: (payload: { amountText: string; redeemCode: string }) => void,
  onReservoirChestOpened?: (payload: { itemId: string; itemLabel: string }) => void,
  onSystemError?: (payload: SystemErrorPayload) => void,
) {
  const bus = useEventBus();
  const currentScene = useGameStore((state) => state.ui.currentScene);
  const mapTimeOfDay = useGameStore((state) => state.ui.mapTimeOfDay);
  const mapCandleLightsOn = useGameStore((state) => state.ui.mapCandleLightsOn);
  const progress = useGameStore((state) => state.progress);
  const playerCoins = useGameStore((state) => state.player.coins);
  const playerPrawnTotal = useGameStore((state) => state.player.prawnTotal);
  const setCurrentScene = useGameStore((state) => state.setCurrentScene);
  const setOverlayMessage = useGameStore((state) => state.setOverlayMessage);
  const setFestivalSequenceActive = useGameStore((state) => state.setFestivalSequenceActive);
  const markShrimpCompleted = useGameStore((state) => state.markShrimpCompleted);

  useEffect(() => {
    return bus.events.subscribe("map/enter-request", ({ target }) => {
      if (target === "festival") {
        if (!progress.festivalUnlocked) {
          setOverlayMessage(appShellContent.overlays.festivalLocked);
          return;
        }

        setCurrentScene("map");
        setOverlayMessage(null);
        setFestivalSequenceActive(true);
        bus.commands.emit("map/festival-mode", { mode: "celebrating" });
        return;
      }

      setFestivalSequenceActive(false);
      bus.commands.emit("map/festival-mode", { mode: "idle" });
      setOverlayMessage(null);
      setCurrentScene(target);
    });
  }, [
    bus.commands,
    bus.events,
    mapSceneContent.festivalCompletedPrompt,
    progress.festivalSeen,
    progress.festivalUnlocked,
    setCurrentScene,
    setFestivalSequenceActive,
    setOverlayMessage,
  ]);

  useEffect(() => {
    return bus.events.subscribe("map/festival-easter-egg-request", () => {
      if (!progress.festivalUnlocked || progress.festivalSeen) {
        return;
      }

      setCurrentScene("map");
      setOverlayMessage(null);
      setFestivalSequenceActive(true);
      bus.commands.emit("map/festival-mode", { mode: "celebrating" });
    });
  }, [
    bus.commands,
    bus.events,
    progress.festivalSeen,
    progress.festivalUnlocked,
    setCurrentScene,
    setFestivalSequenceActive,
    setOverlayMessage,
  ]);

  useEffect(() => {
    return bus.events.subscribe("map/festival-gift-opened", (payload) => {
      setOverlayMessage(appShellContent.overlays.festivalGiftOpened);
      onFestivalGiftOpened?.(payload);
    });
  }, [bus.events, onFestivalGiftOpened, setOverlayMessage]);

  useEffect(() => {
    return bus.events.subscribe("map/reservoir-chest-opened", (payload) => {
      setOverlayMessage(`${appShellContent.overlays.reservoirChestOpened}（${payload.itemLabel}）`);
      onReservoirChestOpened?.(payload);
    });
  }, [bus.events, onReservoirChestOpened, setOverlayMessage]);

  useEffect(() => {
    return bus.events.subscribe("system/error", (payload) => {
      const hint = payload.actionHint ? `（${payload.actionHint}）` : "";
      setOverlayMessage(`系统提示（${payload.source}）：${payload.message}${hint}`);
      onSystemError?.(payload);
    });
  }, [bus.events, onSystemError, setOverlayMessage]);

  useEffect(() => {
    return bus.events.subscribe("shrimp/completed", (payload) => {
      markShrimpCompleted(payload);
      setCurrentScene("map");
      setFestivalSequenceActive(false);
      bus.commands.emit("scene/load", { sceneId: "map" });
      bus.commands.emit("scene/unload", { sceneId: "shrimp" });
      bus.commands.emit("scene/unload", { sceneId: "catan" });
      bus.commands.emit("map/festival-mode", { mode: "idle" });
      setOverlayMessage(
        payload.specialItemFound
          ? shrimpSceneContent.overlayFound
          : shrimpSceneContent.overlayNormal,
      );
    });
  }, [
    bus.commands,
    bus.events,
    markShrimpCompleted,
    setCurrentScene,
    setFestivalSequenceActive,
    setOverlayMessage,
  ]);

  useEffect(() => {
    return bus.events.subscribe("shrimp/exit", () => {
      setCurrentScene("map");
      setFestivalSequenceActive(false);
      bus.commands.emit("scene/load", { sceneId: "map" });
      bus.commands.emit("scene/unload", { sceneId: "shrimp" });
      bus.commands.emit("scene/unload", { sceneId: "catan" });
      bus.commands.emit("map/festival-mode", { mode: "idle" });
      setOverlayMessage(shrimpSceneContent.overlayExit);
    });
  }, [bus.commands, bus.events, setCurrentScene, setFestivalSequenceActive, setOverlayMessage]);

  useEffect(() => {
    bus.commands.emit("map/show-state", {
      shrimpCompleted: progress.shrimpCompleted,
      catanCompleted: progress.catanCompleted,
      festivalUnlocked: progress.festivalUnlocked,
      festivalSeen: progress.festivalSeen,
      fishingChestEligible: progress.fishingChestEligible,
      reservoirChestOpened: progress.reservoirChestOpened,
      timeOfDay: mapTimeOfDay,
      candleLightsOn: mapCandleLightsOn,
    });
  }, [
    bus.commands,
    mapCandleLightsOn,
    mapTimeOfDay,
    progress.catanCompleted,
    progress.fishingChestEligible,
    progress.festivalSeen,
    progress.festivalUnlocked,
    progress.reservoirChestOpened,
    progress.shrimpCompleted,
  ]);

  useEffect(() => {
    if (currentScene === "map") {
      bus.commands.emit("scene/load", { sceneId: "map" });
      bus.commands.emit("scene/unload", { sceneId: "shrimp" });
      bus.commands.emit("scene/unload", { sceneId: "catan" });
      return;
    }

    if (currentScene === "shrimp") {
      bus.commands.emit("shrimp/start", {
        sessionIndex: progress.shrimpSessionsPlayed,
        playerCoins,
        playerPrawnTotal,
      });
      bus.commands.emit("scene/unload", { sceneId: "map" });
      bus.commands.emit("scene/load", { sceneId: "shrimp" });
      bus.commands.emit("scene/unload", { sceneId: "catan" });
      return;
    }

    if (currentScene === "catan") {
      bus.commands.emit("scene/unload", { sceneId: "map" });
      bus.commands.emit("scene/unload", { sceneId: "shrimp" });
      bus.commands.emit("scene/load", { sceneId: "catan" });
      return;
    }

    if (currentScene === "intro" || currentScene === "festival") {
      bus.commands.emit("scene/unload", { sceneId: "map" });
      bus.commands.emit("scene/unload", { sceneId: "shrimp" });
      bus.commands.emit("scene/unload", { sceneId: "catan" });
    }
  }, [bus.commands, currentScene, playerCoins, playerPrawnTotal, progress.shrimpSessionsPlayed]);
}

export function AppShell() {
  const bus = useEventBus();
  const [noteCard, setNoteCard] = useState<NoteCard | null>(null);
  const [phaserHostNonce, setPhaserHostNonce] = useState(0);
  const [mapRuntimeError, setMapRuntimeError] = useState<string | null>(null);
  const [catanRuntimeError, setCatanRuntimeError] = useState<string | null>(null);
  const [phaserDebugState, setPhaserDebugState] = useState<PhaserDebugState | null>(null);

  const progress = useGameStore((state) => state.progress);
  const player = useGameStore((state) => state.player);
  const ui = useGameStore((state) => state.ui);
  const setCurrentScene = useGameStore((state) => state.setCurrentScene);
  const setOverlayMessage = useGameStore((state) => state.setOverlayMessage);
  const setFestivalSequenceActive = useGameStore((state) => state.setFestivalSequenceActive);
  const markReservoirChestOpened = useGameStore((state) => state.markReservoirChestOpened);
  const markCatanCompleted = useGameStore((state) => state.markCatanCompleted);
  const markFestivalSeen = useGameStore((state) => state.markFestivalSeen);

  useBusBridge(
    ({ amountText, redeemCode }) => {
      setNoteCard({
        title: "礼物纸条",
        amountText: player.coins < 0 ? formatRemainingGiftPounds(player.coins) : amountText,
        redeemCode,
      });
    },
    ({ itemLabel }) => {
      markReservoirChestOpened();
      setNoteCard({
        title: "玉石宝箱",
        itemText: itemLabel,
      });
    },
    (payload) => {
      if (payload.source.includes("phaser/bootstrap") && ui.currentScene !== "catan") {
        const hint = payload.actionHint ? `\n${payload.actionHint}` : "";
        setMapRuntimeError(`${payload.message}${hint}`);
      }

      if (
        payload.source.includes("map") ||
        payload.source.includes("scene/load:map") ||
        payload.code?.startsWith("map_")
      ) {
        const hint = payload.actionHint ? `\n${payload.actionHint}` : "";
        setMapRuntimeError(`${payload.message}${hint}`);
      }

      if (
        payload.source.includes("catan") ||
        (payload.source.includes("phaser/bootstrap") && ui.currentScene === "catan")
      ) {
        const hint = payload.actionHint ? `\n${payload.actionHint}` : "";
        setCatanRuntimeError(`${payload.message}${hint}`);
      }
    },
  );

  const activePhaserScene =
    ui.currentScene === "map" || ui.currentScene === "shrimp" || ui.currentScene === "catan"
      ? ui.currentScene
      : null;
  const isCatanScene = ui.currentScene === "catan";
  const isMapScene = ui.currentScene === "map";
  const showDevPreviewActions = import.meta.env.DEV;
  const showPhaserDebug =
    import.meta.env.DEV && new URLSearchParams(window.location.search).get("debugPhaser") === "1";

  useEffect(() => {
    if (!showPhaserDebug) {
      setPhaserDebugState(null);
      return;
    }

    return bus.events.subscribe("phaser/debug-state", (payload) => {
      setPhaserDebugState(payload);
    });
  }, [bus.events, showPhaserDebug]);

  useEffect(() => {
    if (!isMapScene || !ui.festivalSequenceActive) {
      return;
    }

    bus.commands.emit("map/festival-mode", { mode: "celebrating" });
  }, [bus.commands, isMapScene, ui.festivalSequenceActive]);

  useEffect(() => {
    if (ui.currentScene === "map" || !ui.festivalSequenceActive) {
      return;
    }

    setFestivalSequenceActive(false);
    bus.commands.emit("map/festival-mode", { mode: "idle" });
  }, [bus.commands, setFestivalSequenceActive, ui.currentScene, ui.festivalSequenceActive]);

  useEffect(() => {
    if (ui.currentScene === "map") {
      return;
    }

    setNoteCard(null);
  }, [ui.currentScene]);

  useEffect(() => {
    if (ui.currentScene === "map") {
      return;
    }

    setMapRuntimeError(null);
  }, [ui.currentScene]);

  useEffect(() => {
    if (ui.currentScene === "catan") {
      return;
    }

    setCatanRuntimeError(null);
  }, [ui.currentScene]);

  const mapDynamicItems = useMemo(
    () => [`${appShellContent.hud.coinsLabel}：${player.coins}`],
    [player.coins],
  );

  const finishFestivalSequence = () => {
    if (!ui.festivalSequenceActive) {
      return;
    }

    markFestivalSeen();
    setFestivalSequenceActive(false);
    setOverlayMessage(appShellContent.overlays.festivalCompleted);
    bus.commands.emit("map/festival-mode", { mode: "settled" });
  };

  const skipFestivalSequence = () => {
    if (!ui.festivalSequenceActive) {
      return;
    }

    setFestivalSequenceActive(false);
    markFestivalSeen();
    setOverlayMessage(appShellContent.overlays.festivalCompleted);
    bus.commands.emit("map/festival-mode", { mode: "settled" });
  };

  const handleFestivalStepChange = (step: FestivalCelebrationStep) => {
    if (!ui.festivalSequenceActive || !step.crowdCue) {
      return;
    }

    bus.commands.emit("map/festival-crowd-cue", {
      cue: step.crowdCue,
    });
  };

  const previewFestivalScene = () => {
    setCurrentScene("map");
    setOverlayMessage("已进入晚会场景预览。");
    setFestivalSequenceActive(true);
    bus.commands.emit("map/festival-mode", { mode: "celebrating" });
  };

  const retryCatanHost = () => {
    setOverlayMessage(null);
    setCatanRuntimeError(null);
    setPhaserHostNonce((value) => value + 1);
  };

  const exitCatanToMap = () => {
    setOverlayMessage(null);
    setFestivalSequenceActive(false);
    bus.commands.emit("map/festival-mode", { mode: "idle" });
    setMapRuntimeError(null);
    setCurrentScene("map");
  };

  const retryMapHost = () => {
    setOverlayMessage(null);
    setMapRuntimeError(null);
    setPhaserHostNonce((value) => value + 1);
  };

  return (
    <div className={`app-shell${isCatanScene ? " app-shell--catan" : ""}`}>
      {!isCatanScene ? (
        <div className={`app-shell__hud${isMapScene ? " app-shell__hud--with-dynamic" : ""}`}>
          <div>
            <h1>{appShellContent.hud.title}</h1>
            {appShellContent.hud.subtitle ? <p className="lede">{appShellContent.hud.subtitle}</p> : null}
          </div>
          {isMapScene ? (
            <div className="status-card status-card--dynamic">
              <div className="panel-heading">
                <h3>{appShellContent.hud.dynamicTitle}</h3>
              </div>
              <ul className="story-log">
                {mapDynamicItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="map-preview-actions">
                <TextButton label="预览晚会场景" onClick={previewFestivalScene} />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="app-shell__body">
        <div className="play-column">
          {showPhaserDebug ? (
            <div className="phaser-debug-panel">
              <p>currentScene: {ui.currentScene}</p>
              <p>gameReady: {phaserDebugState ? String(phaserDebugState.gameReady) : "unknown"}</p>
              <p>
                activeScenes:{" "}
                {phaserDebugState && phaserDebugState.activeSceneIds.length > 0
                  ? phaserDebugState.activeSceneIds.join(", ")
                  : "none"}
              </p>
              <p>
                managedScenes:{" "}
                {phaserDebugState && phaserDebugState.managedSceneIds.length > 0
                  ? phaserDebugState.managedSceneIds.join(", ")
                  : "none"}
              </p>
              <p>
                sleepingScenes:{" "}
                {phaserDebugState && phaserDebugState.sleepingSceneIds.length > 0
                  ? phaserDebugState.sleepingSceneIds.join(", ")
                  : "none"}
              </p>
              <p>
                pendingLoad:{" "}
                {phaserDebugState && phaserDebugState.pendingSceneLoads.length > 0
                  ? phaserDebugState.pendingSceneLoads.join(", ")
                  : "none"}
              </p>
              <p>
                pendingUnload:{" "}
                {phaserDebugState && phaserDebugState.pendingSceneUnloads.length > 0
                  ? phaserDebugState.pendingSceneUnloads.join(", ")
                  : "none"}
              </p>
              <p>reason: {phaserDebugState?.reason ?? "none"}</p>
            </div>
          ) : null}
          <div className={`catan-workspace${isCatanScene ? "" : " catan-workspace--map"}`}>
            <div className="catan-workspace__board">
              <ScenePanel>
                {activePhaserScene ? (
                  <div className={isCatanScene ? "catan-stage" : "map-stage"}>
                    <PhaserHost
                      key={`phaser-host-${phaserHostNonce}`}
                      activeScene={activePhaserScene}
                      mapState={{
                        shrimpCompleted: progress.shrimpCompleted,
                        catanCompleted: progress.catanCompleted,
                        festivalUnlocked: progress.festivalUnlocked,
                        festivalSeen: progress.festivalSeen,
                        fishingChestEligible: progress.fishingChestEligible,
                        reservoirChestOpened: progress.reservoirChestOpened,
                        timeOfDay: ui.mapTimeOfDay,
                        candleLightsOn: ui.mapCandleLightsOn,
                      }}
                    />
                    {isCatanScene && catanRuntimeError ? (
                      <div className="catan-runtime-alert">
                        <p>{catanRuntimeError}</p>
                        <TextButton label="重试加载卡坦" onClick={retryCatanHost} />
                      </div>
                    ) : null}
                    {isMapScene && mapRuntimeError ? (
                      <div className="catan-runtime-alert">
                        <p>{mapRuntimeError}</p>
                        <TextButton label="重试加载地图" onClick={retryMapHost} />
                      </div>
                    ) : null}
                    {isMapScene && ui.festivalSequenceActive ? (
                      <FestivalMapOverlay
                        title={mapSceneContent.festivalCelebration.title}
                        steps={mapSceneContent.festivalCelebration.steps}
                        continueLabel={mapSceneContent.festivalCelebration.continueAction}
                        finishLabel={mapSceneContent.festivalCelebration.finishAction}
                        skipLabel={mapSceneContent.festivalCelebration.skipAction}
                        onStepChange={handleFestivalStepChange}
                        onComplete={finishFestivalSequence}
                        onSkip={skipFestivalSequence}
                      />
                    ) : null}
                    {isMapScene && noteCard ? (
                      <div className="gift-note-overlay">
                        <div className="gift-note-paper">
                          <p className="gift-note-paper__title">{noteCard.title}</p>
                          {noteCard.amountText ? (
                            <p className="gift-note-paper__line">金额：{noteCard.amountText}</p>
                          ) : null}
                          {noteCard.itemText ? (
                            <p className="gift-note-paper__line">内容：{noteCard.itemText}</p>
                          ) : null}
                          {noteCard.redeemCode ? (
                            <p className="gift-note-paper__line">暗号：{noteCard.redeemCode}</p>
                          ) : null}
                          <div className="gift-note-paper__actions">
                            <TextButton label="收好纸条" onClick={() => setNoteCard(null)} />
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="phaser-idle-state">
                    <p className="story-copy">{appShellContent.panels.phaserIdle}</p>
                  </div>
                )}
              </ScenePanel>
            </div>
            {isCatanScene ? (
              <div className="catan-workspace__sidebar">
                <CatanCard
                  onComplete={() => {
                    markCatanCompleted();
                    setOverlayMessage(appShellContent.overlays.catanCompleted);
                  }}
                  onExit={exitCatanToMap}
                />
              </div>
            ) : null}
          </div>

          {ui.currentScene === "intro" ? (
            <ScenePanel
              title={appShellContent.panels.introTitle}
              subtitle={appShellContent.panels.introSubtitle}
            >
              <p className="story-copy">
                {appShellContent.panels.introBody}
              </p>
              <div className="intro-actions">
                <TextButton
                  label={appShellContent.actions.enterMap}
                  onClick={() => {
                    setCurrentScene("map");
                    setOverlayMessage(null);
                  }}
                />
                {showDevPreviewActions ? (
                  <TextButton
                    label={appShellContent.actions.previewFestival}
                    onClick={() => {
                      setCurrentScene("map");
                      setOverlayMessage(null);
                      setFestivalSequenceActive(true);
                      bus.commands.emit("map/festival-mode", { mode: "celebrating" });
                    }}
                  />
                ) : null}
              </div>
            </ScenePanel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
