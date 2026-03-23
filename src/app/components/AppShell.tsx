import { useEffect, useMemo } from "react";
import { useEventBus } from "../../bus/EventBusContext";
import { getItemLabel } from "../../config/resources";
import { PhaserHost } from "../../phaser/PhaserHost";
import { useGameStore } from "../../store/gameStore";
import { ScenePanel } from "../../ui/ScenePanel";
import { TextButton } from "../../ui/TextButton";
import { FestivalCard } from "../../modules/festival/components/FestivalCard";
import {
  buildFestivalSteps,
  festivalContent,
} from "../../modules/festival/config/content";
import {
  appShellContent,
} from "../../modules/map/config/content";
import { shrimpSceneContent } from "../../modules/shrimp/config/content";
import { CatanCard } from "../../modules/catan/components/CatanCard";

function useBusBridge() {
  const bus = useEventBus();
  const currentScene = useGameStore((state) => state.ui.currentScene);
  const progress = useGameStore((state) => state.progress);
  const setCurrentScene = useGameStore((state) => state.setCurrentScene);
  const setOverlayMessage = useGameStore((state) => state.setOverlayMessage);
  const markShrimpCompleted = useGameStore((state) => state.markShrimpCompleted);

  useEffect(() => {
    return bus.events.subscribe("map/enter-request", ({ target }) => {
      if (target === "festival" && !progress.festivalUnlocked) {
        setOverlayMessage(appShellContent.overlays.festivalLocked);
        return;
      }

      setOverlayMessage(null);
      setCurrentScene(target);
    });
  }, [bus.events, progress.festivalUnlocked, setCurrentScene, setOverlayMessage]);

  useEffect(() => {
    return bus.events.subscribe("shrimp/completed", (payload) => {
      markShrimpCompleted(payload);
      setCurrentScene("map");
      setOverlayMessage(
        payload.specialItemFound
          ? shrimpSceneContent.overlayFound
          : shrimpSceneContent.overlayNormal,
      );
    });
  }, [bus.events, markShrimpCompleted, setCurrentScene, setOverlayMessage]);

  useEffect(() => {
    return bus.events.subscribe("shrimp/exit", () => {
      setCurrentScene("map");
      setOverlayMessage(shrimpSceneContent.overlayExit);
    });
  }, [bus.events, setCurrentScene, setOverlayMessage]);

  useEffect(() => {
    bus.commands.emit("map/show-state", {
      shrimpCompleted: progress.shrimpCompleted,
      catanCompleted: progress.catanCompleted,
      festivalUnlocked: progress.festivalUnlocked,
    });
  }, [
    bus.commands,
    progress.catanCompleted,
    progress.festivalUnlocked,
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
  }, [bus.commands, currentScene]);
}

export function AppShell() {
  useBusBridge();

  const playerName = useGameStore((state) => state.player.name);
  const progress = useGameStore((state) => state.progress);
  const inventory = useGameStore((state) => state.inventory);
  const ui = useGameStore((state) => state.ui);
  const setCurrentScene = useGameStore((state) => state.setCurrentScene);
  const setOverlayMessage = useGameStore((state) => state.setOverlayMessage);
  const markCatanCompleted = useGameStore((state) => state.markCatanCompleted);
  const markFestivalSeen = useGameStore((state) => state.markFestivalSeen);
  const activePhaserScene =
    ui.currentScene === "map" || ui.currentScene === "shrimp" || ui.currentScene === "catan"
      ? ui.currentScene
      : null;

  useEffect(() => {
    if (ui.currentScene === "festival") {
      markFestivalSeen();
    }
  }, [markFestivalSeen, ui.currentScene]);

  const festivalSteps = useMemo(
    () => buildFestivalSteps(playerName, inventory.specialItemFound),
    [inventory.specialItemFound, playerName],
  );
  const specialItemLabel = getItemLabel(inventory.specialItemId);
  const isCatanScene = ui.currentScene === "catan";
  const isMapScene = ui.currentScene === "map";
  const mapDynamicItems = useMemo(
    () => [
      ui.overlayMessage ?? appShellContent.hud.dynamicFallback,
      `${appShellContent.hud.shrimpStatusLabel}：${progress.shrimpCompleted ? "已完成" : "待前往"}`,
      `${appShellContent.hud.catanStatusLabel}：${progress.catanCompleted ? "已完成" : "待前往"}`,
      `${appShellContent.hud.festivalStatusLabel}：${progress.festivalUnlocked ? "已解锁" : "未解锁"}`,
      `${appShellContent.hud.specialItemLabel}：${
        inventory.specialItemFound
          ? specialItemLabel ?? appShellContent.hud.specialItemMissing
          : appShellContent.hud.specialItemMissing
      }`,
    ],
    [
      inventory.specialItemFound,
      progress.catanCompleted,
      progress.festivalUnlocked,
      progress.shrimpCompleted,
      specialItemLabel,
      ui.overlayMessage,
    ],
  );

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
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="app-shell__body">
        <div className="play-column">
          {ui.currentScene === "catan" ? (
            <div className="catan-workspace">
              <div className="catan-workspace__board">
                <ScenePanel>
                  <PhaserHost
                    activeScene="catan"
                    mapState={{
                      shrimpCompleted: progress.shrimpCompleted,
                      catanCompleted: progress.catanCompleted,
                      festivalUnlocked: progress.festivalUnlocked,
                    }}
                  />
                </ScenePanel>
              </div>
              <div className="catan-workspace__sidebar">
                <CatanCard
                  onComplete={() => {
                    markCatanCompleted();
                    setOverlayMessage(appShellContent.overlays.catanCompleted);
                  }}
                  onExit={() => setCurrentScene("map")}
                />
              </div>
            </div>
          ) : (
            <>
              <ScenePanel>
                {activePhaserScene ? (
                  <PhaserHost
                    activeScene={activePhaserScene}
                    mapState={{
                      shrimpCompleted: progress.shrimpCompleted,
                      catanCompleted: progress.catanCompleted,
                      festivalUnlocked: progress.festivalUnlocked,
                    }}
                  />
                ) : (
                  <div className="phaser-idle-state">
                    <p className="story-copy">
                      {appShellContent.panels.phaserIdle}
                    </p>
                  </div>
                )}
              </ScenePanel>

              {ui.overlayMessage ? (
                <p className="overlay-note">{ui.overlayMessage}</p>
              ) : null}
            </>
          )}

          {ui.currentScene === "intro" ? (
            <ScenePanel
              title={appShellContent.panels.introTitle}
              subtitle={appShellContent.panels.introSubtitle}
            >
              <p className="story-copy">
                {appShellContent.panels.introBody}
              </p>
              <TextButton
                label={appShellContent.actions.enterMap}
                onClick={() => {
                  setCurrentScene("map");
                  setOverlayMessage(null);
                }}
              />
            </ScenePanel>
          ) : null}

          {ui.currentScene === "festival" ? (
            <FestivalCard
              title={festivalContent.title}
              subtitle={festivalContent.stageSubtitle}
              progressLabels={festivalContent.progressLabels}
              steps={festivalSteps}
              continueLabel={festivalContent.actions.advance}
              backLabel={festivalContent.actions.backToMap}
              onBack={() => setCurrentScene("map")}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
