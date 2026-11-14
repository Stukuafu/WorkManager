import type { Status, WorkItem } from "./types";
import { STATUSES } from "./workflow";

export type Columns = Record<Status, string[]>;

export interface MoveChange {
  id: string;
  status: Status;
  order: number;
}

function sortedColumn(items: WorkItem[], status: Status, excludeId?: string): WorkItem[] {
  // Archived items are not on the board, so they take no part in column positions.
  return items
    .filter((i) => i.status === status && i.id !== excludeId && !i.archivedAt)
    .sort((a, b) => a.order - b.order || a.number - b.number);
}

/** Item ids per status column, in display order. Archived items are left out. */
export function buildColumns(items: WorkItem[]): Columns {
  const columns = {} as Columns;
  for (const status of STATUSES) columns[status] = sortedColumn(items, status).map((i) => i.id);
  return columns;
}

/**
 * Work out the changes needed to move an item to `toStatus` at `toIndex`
 * (0 = top of the column). Affected columns are renumbered 0..n-1.
 * Only entries whose status or order actually change are returned.
 */
export function planMove(
  items: WorkItem[],
  itemId: string,
  toStatus: Status,
  toIndex: number,
): MoveChange[] {
  const moved = items.find((i) => i.id === itemId);
  if (!moved) throw new Error("Item not found");

  const target = sortedColumn(items, toStatus, itemId);
  const index = Math.max(0, Math.min(toIndex, target.length));
  target.splice(index, 0, moved);

  const proposed: MoveChange[] = target.map((item, order) => ({ id: item.id, status: toStatus, order }));
  if (moved.status !== toStatus) {
    sortedColumn(items, moved.status, itemId).forEach((item, order) =>
      proposed.push({ id: item.id, status: moved.status, order }),
    );
  }

  const byId = new Map(items.map((i) => [i.id, i]));
  return proposed.filter((change) => {
    const current = byId.get(change.id);
    return current?.status !== change.status || current?.order !== change.order;
  });
}
