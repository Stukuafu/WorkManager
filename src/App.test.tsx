import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "./App";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe("App projects flow", () => {
  it("creates a project from the empty state and shows it", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "New project" }));
    await user.type(screen.getByLabelText("Name"), "Work Manager");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByRole("heading", { name: "Work Manager", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Project" })).toHaveDisplayValue("WM · Work Manager");
  });

  it("creates, filters, edits and deletes work items", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "New project" }));
    await user.type(screen.getByLabelText("Name"), "Work Manager");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    // Empty list state, then create two items.
    expect(await screen.findByText("No work items yet")).toBeInTheDocument();
    for (const [title, priority] of [["Build login", "high"], ["Fix crash", "low"]]) {
      await user.click(screen.getByRole("button", { name: "+ New item" }));
      await user.type(screen.getByLabelText("Title"), title);
      await user.selectOptions(screen.getByLabelText("Priority"), priority);
      await user.click(screen.getByRole("button", { name: "Create item" }));
    }

    const table = await screen.findByRole("table");
    const rows = () => within(table).getAllByRole("row").slice(1);
    expect(rows()).toHaveLength(2);
    // Newest first, with generated keys.
    expect(rows()[0]).toHaveTextContent("WM-2");
    expect(rows()[1]).toHaveTextContent("WM-1");

    // Search and filter.
    await user.type(screen.getByLabelText("Search items"), "login");
    expect(rows()).toHaveLength(1);
    expect(screen.getByText("Showing 1 of 2 items")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await user.selectOptions(screen.getByLabelText("Filter by priority"), "low");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("Fix crash");
    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    // Inline status change shows up on the board.
    await user.selectOptions(screen.getByLabelText("Status of WM-1"), "done");
    await user.click(screen.getByRole("tab", { name: "board" }));
    expect(within(screen.getByRole("region", { name: "Done" })).getByText("Build login")).toBeInTheDocument();

    // Edit via the detail panel, which stays open after saving and shows history.
    await user.click(screen.getByRole("button", { name: /Build login/ }));
    expect(await screen.findByText("To Do → Done")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Build sign-in");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("✓ Saved")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "WM-1 · Edit item" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close panel" }));
    expect(await screen.findByText("Build sign-in")).toBeInTheDocument();

    // Delete, and the key is not reused.
    await user.click(screen.getByRole("button", { name: /Build sign-in/ }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(screen.queryByText("Build sign-in")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "+ New item" }));
    await user.type(screen.getByLabelText("Title"), "Third");
    await user.click(screen.getByRole("button", { name: "Create item" }));
    await user.click(screen.getByRole("tab", { name: "list" }));
    expect(await screen.findByText("WM-3")).toBeInTheDocument();
    expect(screen.queryByText("WM-1")).not.toBeInTheDocument();
  });

  it("supports keyboard shortcuts and restores focus after closing a dialog", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "New project" }));
    await user.type(screen.getByLabelText("Name"), "Work Manager");
    await user.click(screen.getByRole("button", { name: "Create project" }));
    await screen.findByText("No work items yet");

    // "c" opens the new item dialog, but typing "c" into a field does not.
    await user.keyboard("c");
    const title = await screen.findByLabelText("Title");
    await user.type(title, "cc");
    expect(title).toHaveValue("cc");
    await user.type(title, "{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // "/" jumps to search once there are items.
    await user.keyboard("c");
    await user.type(await screen.findByLabelText("Title"), "First");
    await user.click(screen.getByRole("button", { name: "Create item" }));
    await user.click(screen.getByRole("tab", { name: "board" }));
    await user.keyboard("/");
    await waitFor(() => expect(screen.getByLabelText("Search items")).toHaveFocus());
  });

  it("shows project stats in the banner", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "New project" }));
    await user.type(screen.getByLabelText("Name"), "Work Manager");
    await user.click(screen.getByRole("button", { name: "Create project" }));
    await user.click(await screen.findByRole("button", { name: "New item" }));
    await user.type(screen.getByLabelText("Title"), "Late one");
    await user.type(screen.getByLabelText("Due date"), "2020-01-01");
    await user.click(screen.getByRole("button", { name: "Create item" }));
    expect(await screen.findByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("Overdue").nextSibling).toHaveTextContent("1");
    expect(screen.getByText("Open").nextSibling).toHaveTextContent("1");
  });

  it("keeps notes on an item and shows the count on the list and board", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "New project" }));
    await user.type(screen.getByLabelText("Name"), "Work Manager");
    await user.click(screen.getByRole("button", { name: "Create project" }));
    await user.click(await screen.findByRole("button", { name: "New item" }));
    await user.type(screen.getByLabelText("Title"), "Needs notes");
    await user.click(screen.getByRole("button", { name: "Create item" }));

    await user.click(await screen.findByRole("button", { name: "Needs notes" }));
    await user.type(await screen.findByLabelText("Add a note"), "First thought");
    await user.click(screen.getByRole("button", { name: "Add note" }));
    await user.type(screen.getByLabelText("Add a note"), "Second thought");
    await user.click(screen.getByRole("button", { name: "Add note" }));
    expect(await screen.findByRole("heading", { name: "Notes (2)" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close panel" }));

    expect(await screen.findByText("2 notes")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "board" }));
    expect(screen.getByText("2 notes")).toBeInTheDocument();

    // Notes persist and go away with the item.
    await user.click(screen.getByRole("button", { name: "Needs notes" }));
    expect(await screen.findByText("Second thought")).toBeInTheDocument();
    // The form's item-level Delete comes before each note's own Delete button.
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(screen.queryByText("2 notes")).not.toBeInTheDocument();
    expect(screen.queryByText("Needs notes")).not.toBeInTheDocument();
  });

  it("builds a story with tasks, shows progress, and keeps tasks when the story is deleted", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "New project" }));
    await user.type(screen.getByLabelText("Name"), "Work Manager");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    // Create a story.
    await user.click(await screen.findByRole("button", { name: "New item" }));
    await user.type(screen.getByLabelText("Title"), "Checkout");
    await user.selectOptions(screen.getByLabelText("Type"), "story");
    await user.click(screen.getByRole("button", { name: "Create item" }));

    // Open it and add two tasks from the story panel.
    await user.click(await screen.findByRole("button", { name: "Checkout" }));
    await user.type(await screen.findByLabelText("Add a task"), "Pay button{Enter}");
    await user.type(screen.getByLabelText("Add a task"), "Receipt email{Enter}");
    expect(await screen.findByRole("heading", { name: "Tasks (2)" })).toBeInTheDocument();

    // Finish one task from the story panel: progress updates.
    await user.selectOptions(within(screen.getByRole("dialog")).getByLabelText("Status of WM-2"), "done");
    expect(await screen.findByText("1 of 2 done")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close panel" }));

    // List shows the compact progress and the parent chip on tasks; filter by story works.
    expect(screen.getByRole("progressbar", { name: "Progress of WM-1" })).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getAllByText("Part of").length).toBe(2);
    await user.selectOptions(screen.getByLabelText("Filter by story"), "WM-1 · Checkout");
    expect(screen.getByText("Showing 2 of 3 items")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    // Open a task, jump to its story.
    await user.click(screen.getByRole("button", { name: "Pay button" }));
    await user.click(await screen.findByRole("button", { name: "WM-1 · Checkout" }));
    expect(await screen.findByRole("heading", { name: "Tasks (2)" })).toBeInTheDocument();

    // Deleting the story keeps the tasks.
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay button" })).toBeInTheDocument();
    expect(screen.queryByText("Part of")).not.toBeInTheDocument();
  });

  it("explains why a story with tasks cannot become a task", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "New project" }));
    await user.type(screen.getByLabelText("Name"), "Work Manager");
    await user.click(screen.getByRole("button", { name: "Create project" }));
    await user.click(await screen.findByRole("button", { name: "New item" }));
    await user.type(screen.getByLabelText("Title"), "Checkout");
    await user.selectOptions(screen.getByLabelText("Type"), "story");
    await user.click(screen.getByRole("button", { name: "Create item" }));
    await user.click(await screen.findByRole("button", { name: "Checkout" }));
    await user.type(await screen.findByLabelText("Add a task"), "One{Enter}");
    await screen.findByRole("heading", { name: "Tasks (1)" });

    await user.selectOptions(screen.getAllByLabelText("Type")[0], "task");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText(/still has 1 task/)).toBeInTheDocument();
  });
});
