interface BalloonProps {
  /** Tailwind colour class for the fill, e.g. "bg-brand-red". */
  className?: string;
  size?: number;
}

/**
 * The "Imagination Balloon": a rounded square with a small rounded
 * square tab at the bottom-right. Fill only, no outline (brand rule 3.5.9).
 */
export function Balloon({ className = "bg-brand-red", size = 40 }: BalloonProps) {
  const tab = Math.round(size * 0.22);
  return (
    <span
      aria-hidden="true"
      className="relative inline-block shrink-0"
      style={{ width: size, height: size }}
    >
      <span className={`absolute inset-0 rounded-[22%] ${className}`} />
      <span
        className={`absolute rounded-[30%] ${className}`}
        style={{ width: tab, height: tab, right: -tab * 0.35, bottom: -tab * 0.35 }}
      />
    </span>
  );
}
