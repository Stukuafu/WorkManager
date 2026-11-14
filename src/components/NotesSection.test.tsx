import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../domain/types";
import { NotesSection } from "./NotesSection";

afterEach(cleanup);

function note(id: string, body: string, createdAt = "2026-11-14T10:00:00.000Z", updatedAt = createdAt): Note {
  return { id, itemId: "i1", body, createdAt, updatedAt };
}

/** A tiny in-memory backend so the component's refresh-after-change loop is exercised. */
function setup(initial: Note[] = []) {
  let notes = [...initial];
  let counter = 0;
  const api = {
    loadNotes: vi.fn(async () => [...notes]),
    onAdd: vi.fn(async (itemId: string, body: string) => {
      if (!body.trim()) throw new Error("Write something in the note first");
      const created = note(`n${++counter}`, body.trim(), `2026-11-15T10:00:0${counter}.000Z`);
      created.itemId = itemId;
      notes.push(created);
      return created;
    }),
    onUpdate: vi.fn(async (id: string, body: string) => {
      const target = notes.find((n) => n.id === id)!;
      target.body = body;
      target.updatedAt = "2026-12-01T00:00:00.000Z";
      return target;
    }),
    onDelete: vi.fn(async (id: string) => {
      notes = notes.filter((n) => n.id !== id);
    }),
  };
  render(<NotesSection itemId="i1" {...api} />);
  return api;
}

describe("NotesSection", () => {
  it("shows an empty state, then the notes newest first with a count", async () => {
    setup([note("a", "older"), note("b", "newer", "2026-11-15T10:00:00.000Z")]);
    const items = await screen.findAllByRole("listitem");
    expect(items[0]).toHaveTextContent("newer");
    expect(items[1]).toHaveTextContent("older");
    expect(screen.getByRole("heading", { name: "Notes (2)" })).toBeInTheDocument();
  });

  it("says when there are no notes", async () => {
    setup();
    expect(await screen.findByText("No notes yet.")).toBeInTheDocument();
  });

  it("adds a note, clears the box and lists it", async () => {
    const user = userEvent.setup();
    const api = setup();
    await screen.findByText("No notes yet.");
    await user.type(screen.getByLabelText("Add a note"), "  Blocked on API  ");
    await user.click(screen.getByRole("button", { name: "Add note" }));
    expect(await screen.findByText("Blocked on API")).toBeInTheDocument();
    expect(api.onAdd).toHaveBeenCalledWith("i1", "  Blocked on API  ");
    expect(screen.getByLabelText("Add a note")).toHaveValue("");
  });

  it("adds with Ctrl+Enter and keeps line breaks", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("No notes yet.");
    await user.type(screen.getByLabelText("Add a note"), "line one{Shift>}{Enter}{/Shift}line two{Control>}{Enter}{/Control}");
    const body = await screen.findByText(/line one/);
    expect(body.textContent).toBe("line one\nline two");
    expect(body.className).toContain("whitespace-pre-wrap");
  });

  it("will not add an empty note", async () => {
    const user = userEvent.setup();
    const api = setup();
    await screen.findByText("No notes yet.");
    await user.click(screen.getByRole("button", { name: "Add note" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Write something");
    expect(api.onAdd).not.toHaveBeenCalled();
  });

  it("edits a note and marks it as edited", async () => {
    const user = userEvent.setup();
    const api = setup([note("a", "typo")]);
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const box = screen.getByLabelText("Edit note");
    expect(box).toHaveValue("typo");
    await user.clear(box);
    await user.type(box, "fixed");
    await user.click(screen.getByRole("button", { name: "Save note" }));
    expect(await screen.findByText("fixed")).toBeInTheDocument();
    expect(api.onUpdate).toHaveBeenCalledWith("a", "fixed");
    expect(screen.getByText(/edited/)).toBeInTheDocument();
  });

  it("can cancel an edit without saving", async () => {
    const user = userEvent.setup();
    const api = setup([note("a", "keep me")]);
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await user.type(screen.getByLabelText("Edit note"), " changed");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("keep me")).toBeInTheDocument();
    expect(api.onUpdate).not.toHaveBeenCalled();
  });

  it("asks before deleting a note", async () => {
    const user = userEvent.setup();
    const api = setup([note("a", "remove me")]);
    const item = await screen.findByRole("listitem");
    await user.click(within(item).getByRole("button", { name: "Delete" }));
    expect(api.onDelete).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Keep" }));
    await user.click(within(item).getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(await screen.findByText("No notes yet.")).toBeInTheDocument();
    expect(api.onDelete).toHaveBeenCalledWith("a");
  });

  it("shows load errors", async () => {
    render(
      <NotesSection
        itemId="i1"
        loadNotes={vi.fn().mockRejectedValue(new Error("Stored data is corrupted"))}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("corrupted");
  });
});
