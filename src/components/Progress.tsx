import type { StoryProgress } from "../domain/hierarchy";

interface ProgressProps {
  progress: StoryProgress;
  label: string;
  /** Compact variant for table rows and cards: "2/5" plus a thin bar. */
  compact?: boolean;
}

export function Progress({ progress, label, compact }: ProgressProps) {
  if (progress.total === 0) return null;
  return (
    <div className={compact ? "inline-flex items-center gap-2" : "w-full"}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        aria-valuetext={`${progress.done} of ${progress.total} done`}
        className={`overflow-hidden rounded-full bg-tint-green/50 ${compact ? "h-1.5 w-16" : "h-2.5 w-full"}`}
      >
        <div className="h-full rounded-full bg-brand-red transition-all" style={{ width: `${progress.percent}%` }} />
      </div>
      <span className={compact ? "text-xs" : "mt-1 block text-sm"}>
        {compact ? `${progress.done}/${progress.total}` : `${progress.done} of ${progress.total} done`}
      </span>
    </div>
  );
}
