import type { ItemType, WorkItem } from "./types";

/**
 * Parent/child rules: only stories can have children; a story cannot itself
 * have a parent; parent and child must be in the same project.
 * Returns a readable error message, or null if the link is allowed.
 */
export function parentError(
  items: WorkItem[],
  child: { type: ItemType; projectId: string },
  parentId: string | undefined,
): string | null {
  if (!parentId) return null;
  if (child.type === "story") return "A story can't belong to another story.";
  const parent = items.find((i) => i.id === parentId);
  if (!parent) return "The parent story no longer exists.";
  if (parent.projectId !== child.projectId) return "The parent story is in a different project.";
  if (parent.type !== "story") return "Only stories can have tasks.";
  return null;
}

/** Direct children of an item, in key order. */
export function childrenOf(items: WorkItem[], parentId: string): WorkItem[] {
  return items.filter((i) => i.parentId === parentId).sort((a, b) => a.number - b.number);
}

export interface StoryProgress {
  done: number;
  total: number;
  /** 0-100, rounded. 0 when there are no tasks. */
  percent: number;
}

export function storyProgress(items: WorkItem[], storyId: string): StoryProgress {
  const children = childrenOf(items, storyId);
  const done = children.filter((c) => c.status === "done").length;
  return {
    done,
    total: children.length,
    percent: children.length === 0 ? 0 : Math.round((done / children.length) * 100),
  };
}

/**
 * Stories that can be chosen as a parent, in key order. Archived stories are left out
 * unless `keepId` is that story (so an item's current parent still shows in its dropdown).
 */
export function storiesIn(items: WorkItem[], excludeId?: string, keepId?: string): WorkItem[] {
  return items
    .filter((i) => i.type === "story" && i.id !== excludeId && (!i.archivedAt || i.id === keepId))
    .sort((a, b) => a.number - b.number);
}

/** Every story, archived or not, in key order. */
export function allStories(items: WorkItem[]): WorkItem[] {
  return items.filter((i) => i.type === "story").sort((a, b) => a.number - b.number);
}
