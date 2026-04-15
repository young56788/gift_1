import { useEffect, useState, useRef } from "react";
import { useEventBus } from "../bus/EventBusContext";
import { setGameInstance } from "./gameRegistry";
import { loadCreatePhaserGame } from "./loadCreatePhaserGame";
import type { SceneId } from "../store/types";

const PHASER_RENDERER_CANVAS = 1;

type PhaserHostProps = {
  activeScene: Extract<SceneId, "map" | "shrimp" | "catan">;
  mapState: {
    shrimpCompleted: boolean;
    catanCompleted: boolean;
    festivalUnlocked: boolean;
    festivalSeen: boolean;
    fishingChestEligible: boolean;
    reservoirChestUnlocked: boolean;
    reservoirChestOpened: boolean;
    playerCoins: number;
    timeOfDay: "day" | "night";
    candleLightsOn: boolean;
  };
};

export function PhaserHost({ activeScene, mapState }: PhaserHostProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const eventBus = useEventBus();
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const container = containerRef.current;
    let cancelled = false;
    let destroyGame: (() => void) | null = null;
    let retryCount = 0;
    const rendererType = PHASER_RENDERER_CANVAS;

    if (!container) {
      return;
    }

    setLoadState("loading");

    const bootGame = () => {
      void loadCreatePhaserGame()
        .then((createPhaserGame) =>
          createPhaserGame(container, eventBus, {
            initialSceneId: activeScene,
            rendererType,
            mapState,
          }),
        )
        .then((game) => {
          if (cancelled) {
            game.destroy(true);
            setGameInstance(null);
            return;
          }

          destroyGame = () => {
            game.destroy(true);
            setGameInstance(null);
          };
          setLoadState("ready");
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }

          if (retryCount < 1) {
            retryCount += 1;
            window.setTimeout(() => {
              if (!cancelled) {
                bootGame();
              }
            }, 160);
            return;
          }

          const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
          eventBus.events.emit("system/error", {
            source: "phaser/bootstrap",
            message,
            code: "phaser_bootstrap_failed",
            recoverable: true,
            actionHint:
              activeScene === "catan"
                ? "点击“重试加载卡坦”重新初始化舞台。"
                : "点击“重试加载地图”重新初始化舞台。",
          });
          console.error("Phaser bootstrap failed", error);
          setLoadState("error");
        });
    };

    bootGame();

    return () => {
      cancelled = true;
      destroyGame?.();
      setGameInstance(null);
    };
  }, [eventBus]);

  return (
    <div className="phaser-host" ref={containerRef}>
      {loadState !== "ready" ? (
        <div className="phaser-host__fallback">
          <p>{loadState === "loading" ? "正在载入 Phaser 舞台…" : "Phaser 舞台加载失败"}</p>
        </div>
      ) : null}
    </div>
  );
}
