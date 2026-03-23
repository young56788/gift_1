import { useEffect, useState, useRef } from "react";
import { useEventBus } from "../bus/EventBusContext";
import { setGameInstance } from "./gameRegistry";
import type { SceneId } from "../store/types";

type PhaserHostProps = {
  activeScene: Extract<SceneId, "map" | "shrimp" | "catan">;
  mapState: {
    shrimpCompleted: boolean;
    catanCompleted: boolean;
    festivalUnlocked: boolean;
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

    if (!container) {
      return;
    }

    setLoadState("loading");

    void import("./createPhaserGame")
      .then(async ({ createPhaserGame }) => {
        if (cancelled) {
          return;
        }

        const game = await createPhaserGame(container, eventBus, {
          initialSceneId: activeScene,
          mapState,
        });

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
      .catch(() => {
        if (!cancelled) {
          setLoadState("error");
        }
      });

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
