import type { ItemType, Priority } from "../domain/types";
import { PRIORITY_LABELS, TYPE_LABELS } from "../domain/workflow";

const PRIORITY_STYLE: Record<Priority, string> = {
  low: "bg-tint-blue text-ink",
  medium: "bg-tint-yellow text-ink",
  high: "bg-accent-pink text-ink",
  critical: "bg-brand-red text-white",
};

const TYPE_STYLE: Record<ItemType, string> = {
  task: "bg-tint-teal text-ink",
  bug: "bg-tint-pink text-ink",
  story: "bg-tint-green text-ink",
};

const base = "inline-block rounded-md px-2 py-0.5 text-xs font-bold";

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`${base} ${PRIORITY_STYLE[priority]}`}>{PRIORITY_LABELS[priority]}</span>;
}

export function TypeBadge({ type }: { type: ItemType }) {
  return <span className={`${base} ${TYPE_STYLE[type]}`}>{TYPE_LABELS[type]}</span>;
}

export function LabelChip({ label }: { label: string }) {
  return (
    <span className="inline-block rounded-md border border-line px-2 py-0.5 text-xs">{label}</span>
  );
}
