import { cleanup, render, screen, within } from "@testing-library/react";
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
});
