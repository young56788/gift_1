import type { PropsWithChildren } from "react";

type ScenePanelProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
}>;

export function ScenePanel({ title, subtitle, children }: ScenePanelProps) {
  return (
    <section className="scene-panel">
      {title || subtitle ? (
        <header className="scene-panel__header">
          <div>
            {subtitle ? <p className="eyebrow">{subtitle}</p> : null}
            {title ? <h2>{title}</h2> : null}
          </div>
        </header>
      ) : null}
      <div className="scene-panel__body">{children}</div>
    </section>
  );
}
