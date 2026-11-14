import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StatusChange, WorkItem } from "../domain/types";
import { ItemPanel } from "./ItemPanel";

afterEach(cleanup);

const item: WorkItem = {
  id: "i1",
  projectId: "p",
  number: 7,
  title: "Ship it",
  description: "",
  type: "task",
  status: "done",
  priority: "medium",
  labels: [],
  order: 0,
  createdAt: "2026-11-14T10:00:00.000Z",
  updatedAt: "2026-11-16T14:30:00.000Z",
  completedAt: "2026-11-16T14:30:00.000Z",
};

const history: StatusChange[] = [
  { id: "c1", itemId: "i1", from: null, to: "todo", at: "2026-11-14T10:00:00.000Z" },
  { id: "c2", itemId: "i1", from: "todo", to: "in_progress", at: "2026-11-15T09:00:00.000Z" },
  { id: "c3", itemId: "i1", from: "in_progress", to: "done", at: "2026-11-16T14:30:00.000Z" },
];

function renderPanel(overrides: Partial<Parameters<typeof ItemPanel>[0]> = {}) {
  const props = {
    projectKey: "WM",
    item,
    loadHistory: vi.fn().mockResolvedValue(history),
    loadNotes: vi.fn().mockResolvedValue([]),
    onAddNote: vi.fn(),
    onUpdateNote: vi.fn(),
    onDeleteNote: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<ItemPanel {...props} />);
  return props;
}

describe("ItemPanel", () => {
  it("shows the key, details and cycle time", async () => {
    renderPanel();
    expect(screen.getByRole("dialog", { name: "WM-7 · Edit item" })).toBeInTheDocument();
    expect(screen.getByText("Time to complete")).toBeInTheDocument();
    expect(screen.getByText("2d 4h")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("lists the status history newest first", async () => {
    renderPanel();
    const list = await screen.findByRole("list");
    const entries = within(list).getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(entries[0]).toContain("In Progress → Done");
    expect(entries[1]).toContain("To Do → In Progress");
    expect(entries[2]).toContain("Created in To Do");
  });

  it("hides completion details for open items", async () => {
    renderPanel({ item: { ...item, status: "todo", completedAt: undefined } });
    await screen.findByRole("list");
    expect(screen.queryByText("Time to complete")).not.toBeInTheDocument();
    expect(screen.queryByText("Completed")).not.toBeInTheDocument();
  });

  it("shows an empty state when there is no history", async () => {
    renderPanel({ loadHistory: vi.fn().mockResolvedValue([]) });
    expect(await screen.findByText("No history yet.")).toBeInTheDocument();
  });

  it("saves without closing, and closes via the close button and Escape", async () => {
    const user = userEvent.setup();
    const props = renderPanel();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(props.onSave).toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Close panel" }));
    await user.keyboard("{Escape}");
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it("reloads history when the item is updated", async () => {
    const loadHistory = vi.fn().mockResolvedValue(history);
    const props = renderPanel({ loadHistory });
    expect(loadHistory).toHaveBeenCalledTimes(1);
    cleanup();
    render(<ItemPanel {...props} loadHistory={loadHistory} item={{ ...item, updatedAt: "2026-11-17T00:00:00.000Z" }} />);
    expect(loadHistory).toHaveBeenCalledTimes(2);
  });
});
