import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FILTERS } from "../domain/filter";
import type { ItemFilters, SavedFilter } from "../domain/types";
import { SavedFilters } from "./SavedFilters";

afterEach(cleanup);

const bugs: ItemFilters = { ...DEFAULT_FILTERS, type: "bug" };
const saved: SavedFilter[] = [
  { id: "f1", projectId: "p", name: "My bugs", filters: bugs, createdAt: "", updatedAt: "" },
  { id: "f2", projectId: "p", name: "Done", filters: { ...DEFAULT_FILTERS, status: "done" }, createdAt: "", updatedAt: "" },
];

function setup(overrides: Partial<Parameters<typeof SavedFilters>[0]> = {}) {
  const props = {
    saved: [] as SavedFilter[],
    current: DEFAULT_FILTERS,
    active: false,
    onApply: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<SavedFilters {...props} />);
  return props;
}

describe("SavedFilters", () => {
  it("shows nothing when there is nothing to save or pick", () => {
    setup();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("offers to save once filters are active, and saves under the chosen name", async () => {
    const user = userEvent.setup();
    const props = setup({ current: bugs, active: true });
    await user.click(screen.getByRole("button", { name: "Save filters" }));
    await user.type(screen.getByLabelText("Name for these filters"), "  Bugs only ");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(props.onSave).toHaveBeenCalledWith("  Bugs only ");
    expect(screen.queryByLabelText("Name for these filters")).not.toBeInTheDocument();
  });

  it("lists saved filters and applies the one you choose", async () => {
    const user = userEvent.setup();
    const props = setup({ saved });
    const select = screen.getByLabelText("Saved filters");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["Saved filters…", "My bugs", "Done"]);
    await user.selectOptions(select, "Done");
    expect(props.onApply).toHaveBeenCalledWith(saved[1].filters);
  });

  it("selects the saved filter that matches the current filters and offers to delete it", async () => {
    const user = userEvent.setup();
    const props = setup({ saved, current: { ...bugs, query: "  " }, active: true });
    expect(screen.getByLabelText("Saved filters")).toHaveValue("f1");
    // Already saved, so there is no "Save filters" button.
    expect(screen.queryByRole("button", { name: "Save filters" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete saved filter" }));
    expect(props.onDelete).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Keep" }));
    await user.click(screen.getByRole("button", { name: "Delete saved filter" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(props.onDelete).toHaveBeenCalledWith("f1");
  });

  it("warns that saving under an existing name replaces it", async () => {
    const user = userEvent.setup();
    setup({ saved, current: { ...DEFAULT_FILTERS, priority: "high" }, active: true });
    await user.click(screen.getByRole("button", { name: "Save filters" }));
    await user.type(screen.getByLabelText("Name for these filters"), "my BUGS");
    expect(screen.getByText(/Replaces the saved filter/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replace" })).toBeInTheDocument();
  });

  it("shows errors from saving and keeps the form open", async () => {
    const user = userEvent.setup();
    setup({ current: bugs, active: true, onSave: vi.fn().mockRejectedValue(new Error("Give these filters a name.")) });
    await user.click(screen.getByRole("button", { name: "Save filters" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Give these filters a name");
    expect(screen.getByLabelText("Name for these filters")).toBeInTheDocument();
  });

  it("cancels naming with the button or Escape", async () => {
    const user = userEvent.setup();
    setup({ current: bugs, active: true });
    await user.click(screen.getByRole("button", { name: "Save filters" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Name for these filters")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save filters" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByLabelText("Name for these filters")).not.toBeInTheDocument();
  });
});
