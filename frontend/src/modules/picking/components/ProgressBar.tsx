export function ProgressBar({ done, total, label }: { done: number; total: number; label?: string }) {
  const percent = total ? Math.round((done / total) * 100) : 0
  return (
    <div className="pick-progress">
      <div
        className="pick-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={label ?? 'Postęp kompletacji'}
      >
        <div className="pick-progress-bar" style={{ width: `${percent}%` }} />
      </div>
      <span className="pick-progress-text">
        {done}/{total}
      </span>
    </div>
  )
}
