const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Compact duration such as "5m", "3h 20m" or "2d 4h". Under a minute is "<1m". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < MINUTE) return "<1m";
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const minutes = Math.floor((ms % HOUR) / MINUTE);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

/** Local date and time, e.g. "14 Nov 2026, 07:05". */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Time from creation to completion, or null if the item is not completed. */
export function cycleTime(createdAt: string, completedAt?: string): string | null {
  if (!completedAt) return null;
  return formatDuration(new Date(completedAt).getTime() - new Date(createdAt).getTime());
}
