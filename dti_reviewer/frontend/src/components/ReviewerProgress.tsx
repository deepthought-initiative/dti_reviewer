import { Check, CircleNotch } from "@phosphor-icons/react"

export interface SearchProgress {
  stage: "scoring" | "reading" | "grouping"
  percent: number
  papers_scored: number
  papers_read?: number
  total_papers?: number
  year?: number
}

export function ReviewerProgress({ progress }: { progress: SearchProgress | null }) {
  const scoring = progress?.stage === "scoring"
  const reading = progress?.stage === "reading"
  const scoringPercent = progress ? (scoring ? progress.percent : 1) : 0
  const readingPercent = progress && !scoring ? progress.percent : 0
  const steps = [
    {
      label: "Score papers",
      percent: scoringPercent,
      active: scoring,
      detail: progress
        ? `${progress.papers_scored.toLocaleString()} papers scored${scoring && progress.year ? ` through ${progress.year}` : ""}`
        : "Waiting to start",
    },
    {
      label: "Read matching papers",
      percent: readingPercent,
      active: reading,
      detail: progress && !scoring
        ? `${(progress.papers_read ?? 0).toLocaleString()} / ${(progress.total_papers ?? 0).toLocaleString()} papers read`
        : "Waiting for scoring",
    },
  ]

  return (
    <div className="reviewer-progress" aria-label="Search progress">
      <div className="progress-heading" role="status">
        <CircleNotch size={20} className="motion-safe:animate-spin" aria-hidden="true" />
        <span>{progress?.stage === "grouping" || (reading && progress.percent === 1)
          ? "Preparing author matches…" : progress ? "Finding relevant papers…" : "Your search is queued…"}</span>
      </div>
      <div className="progress-steps">
        {steps.map((step, index) => (
          <div key={step.label} className="progress-step" data-active={step.active}>
            <div className="progress-label">
              <span className="step-number" data-complete={step.percent === 1}>
                {step.percent === 1 ? <Check weight="bold" size={14} aria-hidden="true" /> : index + 1}
              </span>
              <span>{step.label}</span>
              <span className="progress-percent">{Math.round(step.percent * 100)}%</span>
            </div>
            <div role="progressbar" aria-label={step.label} aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={Math.round(step.percent * 100)} className="progress-track">
              <div className="progress-fill" style={{ width: `${step.percent * 100}%` }} />
            </div>
            <p>{step.detail}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
