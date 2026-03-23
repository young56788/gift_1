import { useMemo, useState } from "react";
import { ScenePanel } from "../../../ui/ScenePanel";
import { TextButton } from "../../../ui/TextButton";
import type { FestivalDialogueStep } from "../config/content";

type FestivalCardProps = {
  title: string;
  subtitle: string;
  progressLabels: string[];
  steps: FestivalDialogueStep[];
  continueLabel: string;
  backLabel: string;
  onBack: () => void;
};

export function FestivalCard({
  title,
  subtitle,
  progressLabels,
  steps,
  continueLabel,
  backLabel,
  onBack,
}: FestivalCardProps) {
  const festivalSteps = useMemo(() => steps, [steps]);
  const [stepIndex, setStepIndex] = useState(0);

  const activeStep = festivalSteps[stepIndex];
  const isLastStep = stepIndex === festivalSteps.length - 1;

  return (
    <ScenePanel title={title} subtitle={subtitle}>
      <div className="festival-stage">
        <div className="festival-stage__lights" />
        <div className="festival-stage__crowd">
          {progressLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>

      <div className="festival-dialogue">
        <p className="eyebrow">{activeStep.speaker}</p>
        <p className="story-copy">{activeStep.line}</p>
      </div>

      <div className="festival-steps">
        {festivalSteps.map((step, index) => (
          <span
            key={`${step.speaker}-${index}`}
            className={index <= stepIndex ? "festival-steps__dot is-active" : "festival-steps__dot"}
          />
        ))}
      </div>

      <div className="button-grid">
        {isLastStep ? (
          <TextButton label={backLabel} onClick={onBack} />
        ) : (
          <TextButton label={continueLabel} onClick={() => setStepIndex((current) => current + 1)} />
        )}
      </div>
    </ScenePanel>
  );
}
