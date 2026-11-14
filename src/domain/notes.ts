import type { Note } from "./types";

/** Number of notes per item id (items with none are absent). */
export function countNotes(notes: Note[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const note of notes) counts[note.itemId] = (counts[note.itemId] ?? 0) + 1;
  return counts;
}

/** All of an item's note text joined and lower-cased, for searching. */
export function indexNotes(notes: Note[]): Record<string, string> {
  const index: Record<string, string> = {};
  for (const note of notes) {
    index[note.itemId] = (index[note.itemId] ? `${index[note.itemId]}\n` : "") + note.body.toLowerCase();
  }
  return index;
}
