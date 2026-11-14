import { describe, expect, it } from "vitest";
import { countNotes, indexNotes } from "./notes";
import type { Note } from "./types";

const note = (id: string, itemId: string, body: string): Note => ({ id, itemId, body, createdAt: "", updatedAt: "" });
const notes = [note("1", "a", "First Note"), note("2", "a", "Second"), note("3", "b", "Other")];

describe("notes helpers", () => {
  it("counts notes per item", () => {
    expect(countNotes(notes)).toEqual({ a: 2, b: 1 });
    expect(countNotes([])).toEqual({});
  });

  it("builds a lower-case search index per item", () => {
    expect(indexNotes(notes)).toEqual({ a: "first note\nsecond", b: "other" });
    expect(indexNotes([])).toEqual({});
  });
});
