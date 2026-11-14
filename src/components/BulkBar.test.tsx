import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkItem } from "../domain/types";
import { BulkBar } from "./BulkBar";

afterEach(cleanup);

function item(number: number, extra: Partial<WorkItem> = {}): WorkItem {
  return {
    id: `i${number}`,
    projectId: "p",
    number,
    title: `Item ${number}`,
    description: "",
    type: "task",
    status: "todo",
    priority: "medium",
    labels: [],
    order: 0,
    createdAt: "",
    updatedAt: "",
    ...extra,
  };
}

const stories = [item(10, { type: "story", title: "Checkout" })];

function setup(overrides: Partial<Parameters<typeof BulkBar>[0]> = {}) {
  const props = {
    selected: [item(1), item(2)],
    projectKey: "WM",
    stories,
    busy: false,
    onUpdate: vi.fn(),
    onArchive: vi.fn(),
    onDelete: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  };
  render(<BulkBar {...props} />);
  return props;
}

describe("BulkBar", () => {
  it("shows how many items are selected", () => {
    setup();
    expect(screen.getByRole("region", { name: "Bulk actions" })).toHaveTextContent("2 items selected");
    cleanup();
    setup({ selected: [item(1)] });
    expect(screen.getByRole("region", { name: "Bulk actions" })).toHaveTextContent("1 item selected");
  });

  it("applies a status immediately when one is chosen", async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.selectOptions(screen.getByLabelText("Set status for selected"), "In Review");
    expect(props.onUpdate).toHaveBeenCalledWith({ status: "in_review" }, "moved to In Review");
    // The dropdown goes back to its prompt, ready for the next change.
    expect(screen.getByLabelText("Set status for selected")).toHaveValue("");
  });

  it("applies a priority", async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.selectOptions(screen.getByLabelText("Set priority for selected"), "Critical");
    expect(props.onUpdate).toHaveBeenCalledWith({ priority: "critical" }, "set to Critical priority");
  });

  it("moves into a story or removes from it", async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.selectOptions(screen.getByLabelText("Move selected to a story"), "WM-10 · Checkout");
    expect(props.onUpdate).toHaveBeenLastCalledWith({ parentId: "i10" }, "moved into WM-10");
    await user.selectOptions(screen.getByLabelText("Move selected to a story"), "No story");
    expect(props.onUpdate).toHaveBeenLastCalledWith({ parentId: undefined }, "removed from their story");
  });

  it("hides the story control when there are no stories", () => {
    setup({ stories: [] });
    expect(screen.queryByLabelText("Move selected to a story")).not.toBeInTheDocument();
  });

  it("offers Archive for active items and Unarchive for archived ones, and both when mixed", async () => {
    const user = userEvent.setup();
    const props = setup();
    expect(screen.queryByRole("button", { name: "Unarchive" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(props.onArchive).toHaveBeenCalledWith(true);
    cleanup();

    const archived = { archivedAt: "2026-11-01T00:00:00.000Z" };
    const onlyArchived = setup({ selected: [item(1, archived)] });
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Unarchive" }));
    expect(onlyArchived.onArchive).toHaveBeenCalledWith(false);
    cleanup();

    setup({ selected: [item(1), item(2, archived)] });
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unarchive" })).toBeInTheDocument();
  });

  it("asks before deleting", async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(props.onDelete).not.toHaveBeenCalled();
    expect(screen.getByText(/Delete 2 items\?/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(props.onDelete).toHaveBeenCalledTimes(1);
  });

  it("clears the selection", async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(props.onClear).toHaveBeenCalled();
  });

  it("disables the actions while busy", () => {
    setup({ busy: true });
    const bar = screen.getByRole("region", { name: "Bulk actions" });
    for (const control of [...within(bar).getAllByRole("combobox"), within(bar).getByRole("button", { name: "Archive" })]) {
      expect(control).toBeDisabled();
    }
  });
});
