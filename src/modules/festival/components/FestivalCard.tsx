import { useEffect, useMemo, useRef, useState } from "react";
import { ScenePanel } from "../../../ui/ScenePanel";
import { TextButton } from "../../../ui/TextButton";
import type { FestivalCastMember, FestivalDialogueStep } from "../config/content";

type FestivalCardProps = {
  title: string;
  subtitle: string;
  cast: FestivalCastMember[];
  steps: FestivalDialogueStep[];
  continueLabel: string;
  backLabel: string;
  onBack: () => void;
};

type FestivalAudioState = {
  ambience: HTMLAudioElement | null;
  lightOn: HTMLAudioElement | null;
  reveal: HTMLAudioElement | null;
  advance: HTMLAudioElement | null;
};

const FESTIVAL_AUDIO_PATHS = {
  ambience: "/festival/audio/night-ambience.ogg",
  lightOn: "/festival/audio/light-on.ogg",
  reveal: "/festival/audio/reveal.ogg",
  advance: "/festival/audio/advance.ogg",
} as const;

const FESTIVAL_CAST_POSITIONS: Record<
  FestivalCastMember["id"],
  { left: string; top: string }
> = {
  emily: { left: "28%", top: "63%" },
  abigail: { left: "40%", top: "59%" },
  leah: { left: "60%", top: "59%" },
  sam: { left: "72%", top: "63%" },
  player: { left: "50%", top: "76%" },
};

export function FestivalCard({
  title,
  subtitle,
  cast,
  steps,
  continueLabel,
  backLabel,
  onBack,
}: FestivalCardProps) {
  const festivalSteps = useMemo(() => steps, [steps]);
  const [stepIndex, setStepIndex] = useState(0);
  const [sceneEntered, setSceneEntered] = useState(false);
  const audioRef = useRef<FestivalAudioState>({
    ambience: null,
    lightOn: null,
    reveal: null,
    advance: null,
  });
  const revealPlayedRef = useRef(false);
  const lightOnPlayedRef = useRef(false);

  const activeStep = festivalSteps[Math.min(stepIndex, Math.max(festivalSteps.length - 1, 0))];
  const isLastStep = stepIndex >= festivalSteps.length - 1;

  useEffect(() => {
    if (!activeStep) {
      setSceneEntered(true);
      return;
    }

    setSceneEntered(false);
    const timeoutId = window.setTimeout(() => {
      setSceneEntered(true);
    }, activeStep.autoEnterMs ?? 520);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeStep, stepIndex]);

  useEffect(() => {
    const ambience = new Audio(FESTIVAL_AUDIO_PATHS.ambience);
    ambience.loop = true;
    ambience.volume = 0.34;
    ambience.preload = "auto";

    const lightOn = new Audio(FESTIVAL_AUDIO_PATHS.lightOn);
    lightOn.volume = 0.48;
    lightOn.preload = "auto";

    const reveal = new Audio(FESTIVAL_AUDIO_PATHS.reveal);
    reveal.volume = 0.5;
    reveal.preload = "auto";

    const advance = new Audio(FESTIVAL_AUDIO_PATHS.advance);
    advance.volume = 0.42;
    advance.preload = "auto";

    audioRef.current = {
      ambience,
      lightOn,
      reveal,
      advance,
    };

    return () => {
      Object.values(audioRef.current).forEach((audio) => {
        if (!audio) {
          return;
        }

        audio.pause();
        audio.currentTime = 0;
      });
      revealPlayedRef.current = false;
      lightOnPlayedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!activeStep) {
      return;
    }

    const { reveal, lightOn } = audioRef.current;
    const phase = activeStep.phase;

    if (phase === "reveal" && reveal && !revealPlayedRef.current) {
      reveal.currentTime = 0;
      void reveal.play().catch(() => {});
      revealPlayedRef.current = true;
    }

    if (phase === "gathering" && lightOn && !lightOnPlayedRef.current) {
      lightOn.currentTime = 0;
      void lightOn.play().catch(() => {});
      lightOnPlayedRef.current = true;
    }
  }, [activeStep]);

  const playAdvanceAudio = () => {
    const { advance, ambience } = audioRef.current;
    if (advance) {
      advance.currentTime = 0;
      void advance.play().catch(() => {});
    }
    if (ambience && ambience.paused) {
      void ambience.play().catch(() => {});
    }
  };

  const handleAdvance = () => {
    if (!sceneEntered || isLastStep) {
      return;
    }

    playAdvanceAudio();
    setStepIndex((current) => current + 1);
  };

  const handleBack = () => {
    if (!sceneEntered) {
      return;
    }

    playAdvanceAudio();
    onBack();
  };

  if (!activeStep) {
    return (
      <ScenePanel title={title} subtitle={subtitle}>
        <p className="story-copy">宴会内容暂时为空。</p>
        <div className="button-grid">
          <TextButton label={backLabel} onClick={onBack} />
        </div>
      </ScenePanel>
    );
  }

  const stageClassName = [
    "festival-stage",
    `festival-stage--${activeStep.phase}`,
    `festival-stage--focus-${activeStep.focusTarget}`,
    `festival-stage--motion-${activeStep.enterMotion}`,
    sceneEntered ? "is-entered" : "",
  ].join(" ");

  return (
    <ScenePanel title={title} subtitle={subtitle}>
      <div className={stageClassName}>
        <div className="festival-stage__backdrop" />
        <div className="festival-stage__stars" />
        <div className="festival-stage__moon" />
        <div className="festival-stage__night-wash" />
        <div className="festival-stage__lights" />
        <div className="festival-stage__garland" />
        <div className="festival-stage__spotlight" />

        <div className="festival-stage__square">
          <span className="festival-stage__plaza festival-stage__plaza--rear" />
          <span className="festival-stage__path festival-stage__path--left" />
          <span className="festival-stage__path festival-stage__path--right" />
          <span className="festival-stage__plaza festival-stage__plaza--front" />
        </div>

        <div className="festival-stage__scenery">
          <span className="festival-stage__house festival-stage__house--left" />
          <span className="festival-stage__house festival-stage__house--right" />
          <span className="festival-stage__well" />
          <span className="festival-stage__tree festival-stage__tree--left" />
          <span className="festival-stage__tree festival-stage__tree--right" />
          <span className="festival-stage__rock festival-stage__rock--left" />
          <span className="festival-stage__rock festival-stage__rock--right" />
          <span className="festival-stage__flowers festival-stage__flowers--left" />
          <span className="festival-stage__flowers festival-stage__flowers--right" />
        </div>

        <div className="festival-stage__table">
          <span className="festival-stage__table-base" aria-hidden="true" />
          <span className="festival-stage__table-prop" aria-hidden="true" />
          <div className="festival-prop festival-prop--gift">
            <span className="festival-prop__sprite" aria-hidden="true" />
            <span className="festival-prop__label">礼物</span>
          </div>
          <div className="festival-prop festival-prop--cake">
            <span className="festival-prop__sprite" aria-hidden="true" />
            <span className="festival-prop__label">蛋糕</span>
          </div>
        </div>

        <div className="festival-stage__cast">
          {cast.map((member, index) => {
            const position = FESTIVAL_CAST_POSITIONS[member.id];
            const isSpeaker = member.id === activeStep.speakerId;
            const isFocused =
              (activeStep.focusTarget === "crowd" && member.id !== "player") ||
              (activeStep.focusTarget === "player" && member.id === "player");
            const className = [
              "festival-villager",
              `festival-villager--${member.id}`,
              isSpeaker ? "is-active" : "",
              isFocused ? "is-focused" : "",
              member.id === "player" ? "is-player" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <span
                key={member.id}
                className={className}
                style={{
                  left: position.left,
                  top: position.top,
                  transitionDelay: `${index * 60}ms`,
                }}
              >
                <span className="festival-villager__card">
                  <span
                    className="festival-villager__sprite"
                    aria-hidden="true"
                    style={{ backgroundImage: `url(${member.spritePath})` }}
                  />
                  <span className="festival-villager__label">{member.label}</span>
                </span>
              </span>
            );
          })}
        </div>
      </div>

      <div className="festival-dialogue">
        <div className="festival-dialogue__speaker-tag">
          <span className="festival-dialogue__speaker-text">{activeStep.speakerLabel}</span>
        </div>
        {activeStep.beat ? <p className="festival-dialogue__beat">{activeStep.beat}</p> : null}
        <p className="story-copy">{activeStep.line}</p>
        {activeStep.focusLabel ? (
          <p className="festival-dialogue__focus">此刻聚焦：{activeStep.focusLabel}</p>
        ) : null}
        <p className="festival-dialogue__hint">
          {sceneEntered ? "点击继续推进剧情。" : "镜头推进中…"}
        </p>
      </div>

      <div className="button-grid">
        {isLastStep ? (
          <TextButton label={backLabel} onClick={handleBack} disabled={!sceneEntered} />
        ) : (
          <TextButton label={continueLabel} onClick={handleAdvance} disabled={!sceneEntered} />
        )}
      </div>
    </ScenePanel>
  );
}
