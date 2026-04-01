import { useEffect, useMemo, useRef, useState } from "react";
import { TextButton } from "../../../ui/TextButton";
import type { FestivalCelebrationStep } from "../../map/config/content";

type FestivalMapOverlayProps = {
  title: string;
  steps: FestivalCelebrationStep[];
  continueLabel: string;
  finishLabel: string;
  skipLabel: string;
  onStepChange?: (step: FestivalCelebrationStep) => void;
  onComplete: () => void;
  onSkip: () => void;
};

export function FestivalMapOverlay({
  title,
  steps,
  continueLabel,
  finishLabel,
  skipLabel,
  onStepChange,
  onComplete,
  onSkip,
}: FestivalMapOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const announcedStepRef = useRef(-1);
  const safeSteps = useMemo<FestivalCelebrationStep[]>(
    () =>
      steps.length > 0
        ? steps
        : [
            {
              speaker: "旁白",
              line: "今晚的广场为你点亮了灯。",
            },
          ],
    [steps],
  );
  const activeStep = safeSteps[Math.min(stepIndex, safeSteps.length - 1)];
  const isLastLine = stepIndex >= safeSteps.length - 1;

  useEffect(() => {
    if (announcedStepRef.current === stepIndex) {
      return;
    }

    announcedStepRef.current = stepIndex;
    onStepChange?.(activeStep);
  }, [activeStep, onStepChange, stepIndex]);

  const handleNext = () => {
    if (isLastLine) {
      onComplete();
      return;
    }

    setStepIndex((current) => current + 1);
  };

  return (
    <div className="festival-map-overlay">
      <div className="festival-map-overlay__panel">
        <div className="festival-map-overlay__meta">
          <p className="festival-map-overlay__title">{title}</p>
          <p className="festival-map-overlay__speaker">{activeStep.speaker}</p>
        </div>
        <p className="festival-map-overlay__line">{activeStep.line}</p>
        <div className="festival-map-overlay__actions">
          <TextButton label={isLastLine ? finishLabel : continueLabel} onClick={handleNext} />
          <TextButton label={skipLabel} onClick={onSkip} />
        </div>
      </div>
    </div>
  );
}
