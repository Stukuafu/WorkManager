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

  async function newProject(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: "New project" }));
    await user.type(screen.getByLabelText("Name"), "Work Manager");
    await user.click(screen.getByRole("button", { name: "Create project" }));
  }

  async function newItem(user: ReturnType<typeof userEvent.setup>, title: string, extra: { type?: string; priority?: string } = {}) {
    await user.click(await screen.findByRole("button", { name: "+ New item" }));
    await user.type(screen.getByLabelText("Title"), title);
    if (extra.type) await user.selectOptions(screen.getByLabelText("Type"), extra.type);
    if (extra.priority) await user.selectOptions(screen.getByLabelText("Priority"), extra.priority);
    await user.click(screen.getByRole("button", { name: "Create item" }));
  }

  it("sorts the list by clicking column headers", async () => {
    const user = userEvent.setup();
    render(<App />);
    await newProject(user);
    await newItem(user, "Banana", { priority: "low" });
    await newItem(user, "Apple", { priority: "critical" });
    await newItem(user, "Cherry", { priority: "high" });

    const titles = () =>
      within(screen.getByRole("table")).getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("button")[0].textContent);
    const header = (name: RegExp) => screen.getByRole("columnheader", { name });

    // Newest first by default, and the Key column says so.
    expect(titles()).toEqual(["Cherry", "Apple", "Banana"]);
    expect(header(/Key/)).toHaveAttribute("aria-sort", "descending");

    // Priority starts with the most important first, then flips.
    await user.click(screen.getByRole("button", { name: /Priority/ }));
    expect(titles()).toEqual(["Apple", "Cherry", "Banana"]);
    expect(header(/Priority/)).toHaveAttribute("aria-sort", "descending");
    expect(header(/Key/)).not.toHaveAttribute("aria-sort");
    await user.click(screen.getByRole("button", { name: /Priority/ }));
    expect(titles()).toEqual(["Banana", "Cherry", "Apple"]);
    expect(header(/Priority/)).toHaveAttribute("aria-sort", "ascending");

    // Title is A to Z first.
    await user.click(screen.getByRole("button", { name: /Title/ }));
    expect(titles()).toEqual(["Apple", "Banana", "Cherry"]);

    // Sorting works together with filters.
    await user.selectOptions(screen.getByLabelText("Filter by priority"), "critical");
    expect(titles()).toEqual(["Apple"]);
  });

  it("adds an existing task to a story from the story panel", async () => {
    const user = userEvent.setup();
    render(<App />);
    await newProject(user);
    await newItem(user, "Loose task");
    await newItem(user, "Checkout", { type: "story" });

    await user.click(await screen.findByRole("button", { name: "Checkout" }));
    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Add an existing item"), "WM-1 · Loose task");
    await user.click(within(dialog).getByRole("button", { name: "Add to story" }));

    expect(await within(dialog).findByRole("heading", { name: "Tasks (1)" })).toBeInTheDocument();
    // Nothing left to add, so the picker disappears.
    expect(within(dialog).queryByLabelText("Add an existing item")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Close panel" }));
    expect(screen.getByRole("progressbar", { name: "Progress of WM-2" })).toBeInTheDocument();
    expect(screen.getByText("Part of")).toBeInTheDocument();
  });

  it("finds items by text inside their notes and says why they matched", async () => {
    const user = userEvent.setup();
    render(<App />);
    await newProject(user);
    await newItem(user, "Login crash");
    await newItem(user, "Update docs");

    await user.click(await screen.findByRole("button", { name: "Login crash" }));
    await user.type(await screen.findByLabelText("Add a note"), "Reproduced on Safari 17");
    await user.click(screen.getByRole("button", { name: "Add note" }));
    await screen.findByText("Reproduced on Safari 17");
    await user.click(screen.getByRole("button", { name: "Close panel" }));

    const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
    await user.type(screen.getByLabelText("Search items"), "safari");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("Login crash");
    expect(rows()[0]).toHaveTextContent("matches in notes");

    // A match in the title is not labelled as a notes match.
    await user.clear(screen.getByLabelText("Search items"));
    await user.type(screen.getByLabelText("Search items"), "login");
    expect(rows()[0]).not.toHaveTextContent("matches in notes");

    // Editing the note changes what is findable straight away.
    await user.clear(screen.getByLabelText("Search items"));
    await user.click(screen.getByRole("button", { name: "Login crash" }));
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Edit note"));
    await user.type(screen.getByLabelText("Edit note"), "Fixed in build 42");
    await user.click(screen.getByRole("button", { name: "Save note" }));
    await screen.findByText("Fixed in build 42");
    await user.click(screen.getByRole("button", { name: "Close panel" }));
    await user.type(screen.getByLabelText("Search items"), "safari");
    expect(screen.getByText("No items match your filters.")).toBeInTheDocument();
  });

  it("saves, reapplies, replaces and deletes filters, and drops ones that no longer apply", async () => {
    const user = userEvent.setup();
    render(<App />);
    await newProject(user);
    await newItem(user, "Crash on login", { type: "bug", priority: "high" });
    await newItem(user, "Tidy docs", { priority: "low" });
    await newItem(user, "Slow search", { type: "bug", priority: "low" });

    const count = () => within(screen.getByRole("table")).getAllByRole("row").length - 1;

    // Nothing to save until a filter is active.
    expect(screen.queryByRole("button", { name: "Save filters" })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Filter by type"), "bug");
    expect(count()).toBe(2);
    await user.click(screen.getByRole("button", { name: "Save filters" }));
    await user.type(screen.getByLabelText("Name for these filters"), "My bugs");
    await user.click(screen.getByRole("button", { name: "Save" }));

    // It is now selected, and clearing then picking it brings the filter back.
    expect(await screen.findByLabelText("Saved filters")).toHaveValue(
      (screen.getByRole("option", { name: "My bugs" }) as HTMLOptionElement).value,
    );
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(count()).toBe(3);
    await user.selectOptions(screen.getByLabelText("Saved filters"), "My bugs");
    expect(count()).toBe(2);
    expect(screen.getByLabelText("Filter by type")).toHaveValue("bug");

    // Tweak the filters and save under the same name: it replaces rather than duplicates.
    await user.selectOptions(screen.getByLabelText("Filter by priority"), "high");
    expect(count()).toBe(1);
    await user.click(screen.getByRole("button", { name: "Save filters" }));
    await user.type(screen.getByLabelText("Name for these filters"), "my bugs");
    await user.click(screen.getByRole("button", { name: "Replace" }));
    expect(within(screen.getByLabelText("Saved filters")).getAllByRole("option")).toHaveLength(2); // placeholder + 1

    // Saved filters survive a reload.
    cleanup();
    render(<App />);
    await user.click(await screen.findByRole("tab", { name: "list" }));
    await user.selectOptions(await screen.findByLabelText("Saved filters"), "my bugs");
    expect(count()).toBe(1);

    // Delete it.
    await user.click(screen.getByRole("button", { name: "Delete saved filter" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(screen.queryByLabelText("Saved filters")).not.toBeInTheDocument();
  });

  it("archives an item: it leaves the list and board, shows under the archive filter, and can come back", async () => {
    const user = userEvent.setup();
    render(<App />);
    await newProject(user);
    await newItem(user, "Keep me");
    await newItem(user, "Archive me");

    const rowTitles = () =>
      within(screen.getByRole("table")).getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("button")[0].textContent);
    expect(rowTitles()).toEqual(["Archive me", "Keep me"]);

    // Archive from the detail panel.
    await user.click(screen.getByRole("button", { name: "Archive me" }));
    await user.click(await screen.findByRole("button", { name: "Archive item" }));
    expect(await screen.findByText(/It is hidden from the board and list/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close panel" }));

    // Hidden from the list by default, counted in the banner, and absent from the board.
    expect(rowTitles()).toEqual(["Keep me"]);
    expect(screen.getByText("Showing 1 of 1 items")).toBeInTheDocument();
    expect(screen.getByText("Archived", { selector: "dt" }).nextSibling).toHaveTextContent("1");
    await user.click(screen.getByRole("tab", { name: "board" }));
    expect(screen.queryByText("Archive me")).not.toBeInTheDocument();
    expect(screen.getByText("Keep me")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "list" }));

    // The filter can include them or show only them.
    await user.selectOptions(screen.getByLabelText("Archived items"), "include");
    expect(rowTitles()).toEqual(["Archive me", "Keep me"]);
    expect(within(screen.getByRole("table")).getByText("Archived", { selector: "span" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Archived items"), "only");
    expect(rowTitles()).toEqual(["Archive me"]);
    expect(screen.getByText("Showing 1 of 1 items")).toBeInTheDocument();

    // Unarchive via the panel; it goes back to the board.
    await user.click(screen.getByRole("button", { name: "Archive me" }));
    await user.click(await screen.findByRole("button", { name: "Unarchive" }));
    await user.click(screen.getByRole("button", { name: "Close panel" }));
    expect(screen.getByText("No items match your filters.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(rowTitles()).toEqual(["Archive me", "Keep me"]);
    await user.click(screen.getByRole("tab", { name: "board" }));
    expect(screen.getByText("Archive me")).toBeInTheDocument();
  });

  it("saves the archive filter in a saved filter", async () => {
    const user = userEvent.setup();
    render(<App />);
    await newProject(user);
    await newItem(user, "Old thing");
    await user.click(screen.getByRole("button", { name: "Old thing" }));
    await user.click(await screen.findByRole("button", { name: "Archive item" }));
    await user.click(screen.getByRole("button", { name: "Close panel" }));

    await user.selectOptions(screen.getByLabelText("Archived items"), "only");
    await user.click(screen.getByRole("button", { name: "Save filters" }));
    await user.type(screen.getByLabelText("Name for these filters"), "Archive");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("No items match your filters.")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Saved filters"), "Archive");
    expect(screen.getByLabelText("Archived items")).toHaveValue("only");
    expect(screen.getByRole("button", { name: "Old thing" })).toBeInTheDocument();
  });

  it("applies bulk actions to selected rows", async () => {
    const user = userEvent.setup();
    render(<App />);
    await newProject(user);
    await newItem(user, "Checkout", { type: "story" });
    await newItem(user, "Alpha", { priority: "low" });
    await newItem(user, "Beta", { priority: "low" });
    await newItem(user, "Gamma", { priority: "low" });

    const table = () => screen.getByRole("table");
    const rowFor = (title: string) => within(table()).getByRole("button", { name: title }).closest("tr")!;
    const checkboxFor = (title: string) => within(rowFor(title)).getByRole("checkbox");

    // No toolbar until something is selected.
    expect(screen.queryByRole("region", { name: "Bulk actions" })).not.toBeInTheDocument();
    await user.click(checkboxFor("Alpha"));
    await user.click(checkboxFor("Beta"));
    const bar = screen.getByRole("region", { name: "Bulk actions" });
    expect(bar).toHaveTextContent("2 items selected");

    // Status and priority apply to just the selected rows; the selection stays for the next change.
    await user.selectOptions(within(bar).getByLabelText("Set status for selected"), "In Review");
    expect(await screen.findByText("2 items moved to In Review.")).toBeInTheDocument();
    expect(within(rowFor("Alpha")).getByLabelText("Status of WM-2")).toHaveValue("in_review");
    expect(within(rowFor("Beta")).getByLabelText("Status of WM-3")).toHaveValue("in_review");
    expect(within(rowFor("Gamma")).getByLabelText("Status of WM-4")).toHaveValue("todo");
    await user.selectOptions(within(bar).getByLabelText("Set priority for selected"), "Critical");
    expect(await screen.findByText("2 items set to Critical priority.")).toBeInTheDocument();
    expect(within(rowFor("Alpha")).getByText("Critical")).toBeInTheDocument();
    expect(within(rowFor("Gamma")).getByText("Low")).toBeInTheDocument();

    // Move both into the story.
    await user.selectOptions(within(bar).getByLabelText("Move selected to a story"), "WM-1 · Checkout");
    expect(await screen.findByText("2 items moved into WM-1.")).toBeInTheDocument();
    expect(within(rowFor("Alpha")).getByText("WM-1")).toBeInTheDocument();
    expect(within(rowFor("Checkout")).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");

    // Archive them: the selection clears and they leave the list.
    await user.click(within(bar).getByRole("button", { name: "Archive" }));
    expect(await screen.findByText("Archived 2 items.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Bulk actions" })).not.toBeInTheDocument();
    expect(within(table()).queryByRole("button", { name: "Alpha" })).not.toBeInTheDocument();
    expect(within(table()).getByRole("button", { name: "Gamma" })).toBeInTheDocument();
  });

  it("selects all shown rows, and bulk deletes after confirming", async () => {
    const user = userEvent.setup();
    render(<App />);
    await newProject(user);
    for (const title of ["One", "Two", "Three"]) await newItem(user, title);

    const selectAll = screen.getByLabelText("Select all shown items") as HTMLInputElement;
    await user.click(screen.getByLabelText("Select WM-1"));
    expect(selectAll.indeterminate).toBe(true);
    await user.click(selectAll);
    expect(screen.getByRole("region", { name: "Bulk actions" })).toHaveTextContent("3 items selected");
    expect(selectAll.checked).toBe(true);
    await user.click(selectAll);
    expect(screen.queryByRole("region", { name: "Bulk actions" })).not.toBeInTheDocument();

    // Select all only covers what the filters show.
    await user.type(screen.getByLabelText("Search items"), "T"); // Two, Three
    await user.click(selectAll);
    const bar = screen.getByRole("region", { name: "Bulk actions" });
    expect(bar).toHaveTextContent("2 items selected");

    await user.click(within(bar).getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Two")).toBeInTheDocument(); // nothing happens until confirmed
    await user.click(within(bar).getByRole("button", { name: "Yes, delete" }));
    expect(await screen.findByText("Deleted 2 items.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(within(screen.getByRole("table")).getAllByRole("row").slice(1)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "One" })).toBeInTheDocument();
  });

  it("explains a rejected bulk action and changes nothing", async () => {
    const user = userEvent.setup();
    render(<App />);
    await newProject(user);
    await newItem(user, "Checkout", { type: "story" });
    await newItem(user, "Other story", { type: "story" });
    await newItem(user, "Task");

    // Moving a task and a story into a story is not allowed: stories cannot nest.
    await user.click(screen.getByLabelText("Select WM-3"));
    await user.click(screen.getByLabelText("Select WM-2"));
    await user.selectOptions(screen.getByLabelText("Move selected to a story"), "WM-1 · Checkout");
    expect(await screen.findByRole("alert")).toHaveTextContent(/story can't belong to another story/);
    expect(screen.queryAllByText("WM-1", { selector: "span" })).toHaveLength(0); // the task was not moved either
    expect(screen.getByRole("region", { name: "Bulk actions" })).toHaveTextContent("2 items selected");
  });

  it("clears the selection when the filters change", async () => {
    const user = userEvent.setup();
    render(<App />);
    await newProject(user);
    await newItem(user, "One");
    await newItem(user, "Two");
    await user.click(screen.getByLabelText("Select WM-1"));
    expect(screen.getByRole("region", { name: "Bulk actions" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Filter by priority"), "high");
    expect(screen.queryByRole("region", { name: "Bulk actions" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect((screen.getByLabelText("Select WM-1") as HTMLInputElement).checked).toBe(false);
  });
});
