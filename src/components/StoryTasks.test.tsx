import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ItemType, Status, WorkItem } from "../domain/types";
import { StoryTasks } from "./StoryTasks";

afterEach(cleanup);

function item(number: number, type: ItemType, extra: Partial<WorkItem> = {}): WorkItem {
  return {
    id: `i${number}`,
    projectId: "p",
    number,
    title: `Item ${number}`,
    description: "",
    type,
    status: "todo" as Status,
    priority: "medium",
    labels: [],
    order: 0,
    createdAt: "",
    updatedAt: "",
    ...extra,
  };
}

const story = item(1, "story");
const items = [
  story,
  item(2, "task", { parentId: "i1", status: "done", title: "Wire up API" }),
  item(3, "bug", { parentId: "i1", title: "Fix crash" }),
  item(4, "task", { title: "Unrelated" }),
];

function setup(overrides: Partial<Parameters<typeof StoryTasks>[0]> = {}) {
  const props = {
    story,
    projectKey: "WM",
    items,
    onOpen: vi.fn(),
    onAddTask: vi.fn().mockResolvedValue(undefined),
    onLinkTask: vi.fn().mockResolvedValue(undefined),
    onStatusChange: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<StoryTasks {...props} />);
  return props;
}

describe("StoryTasks", () => {
  it("lists only this story's tasks with progress", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Tasks (2)" })).toBeInTheDocument();
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText("Unrelated")).not.toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "Story progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "50");
    expect(bar).toHaveAttribute("aria-valuetext", "1 of 2 done");
  });

  it("shows an empty state without a progress bar", () => {
    setup({ items: [story] });
    expect(screen.getByText(/No tasks yet/)).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("adds a task and clears the box", async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.type(screen.getByLabelText("Add a task"), "Write tests{Enter}");
    expect(props.onAddTask).toHaveBeenCalledWith("i1", "Write tests");
    expect(screen.getByLabelText("Add a task")).toHaveValue("");
  });

  it("requires a title and shows errors from adding", async () => {
    const user = userEvent.setup();
    const props = setup({ onAddTask: vi.fn().mockRejectedValue(new Error("Boom")) });
    await user.click(screen.getByRole("button", { name: "Add task" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a title");
    expect(props.onAddTask).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Add a task"), "x");
    await user.click(screen.getByRole("button", { name: "Add task" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Boom");
    expect(screen.getByLabelText("Add a task")).toHaveValue("x");
  });

  it("opens a task and changes its status", async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByRole("button", { name: "Fix crash" }));
    expect(props.onOpen).toHaveBeenCalledWith("i3");
    await user.selectOptions(screen.getByLabelText("Status of WM-3"), "in_review");
    expect(props.onStatusChange).toHaveBeenCalledWith(expect.objectContaining({ id: "i3" }), "in_review");
  });

  describe("adding an existing item", () => {
    it("offers only tasks and bugs that have no story yet", () => {
      setup({
        items: [
          ...items,
          item(5, "story", { title: "Other story" }),
          item(6, "task", { title: "Belongs elsewhere", parentId: "i5" }),
        ],
      });
      const options = within(screen.getByLabelText("Add an existing item"))
        .getAllByRole("option")
        .map((o) => o.textContent);
      expect(options).toEqual(["Choose a task or bug…", "WM-4 · Unrelated"]);
    });

    it("links the chosen item and resets the picker", async () => {
      const user = userEvent.setup();
      const props = setup();
      await user.selectOptions(screen.getByLabelText("Add an existing item"), "WM-4 · Unrelated");
      await user.click(screen.getByRole("button", { name: "Add to story" }));
      expect(props.onLinkTask).toHaveBeenCalledWith("i1", "i4");
      expect(screen.getByLabelText("Add an existing item")).toHaveValue("");
    });

    it("asks for a choice, and shows linking errors", async () => {
      const user = userEvent.setup();
      const props = setup({ onLinkTask: vi.fn().mockRejectedValue(new Error("Nope")) });
      await user.click(screen.getByRole("button", { name: "Add to story" }));
      expect(screen.getByRole("alert")).toHaveTextContent("Choose an item");
      expect(props.onLinkTask).not.toHaveBeenCalled();
      await user.selectOptions(screen.getByLabelText("Add an existing item"), "WM-4 · Unrelated");
      await user.click(screen.getByRole("button", { name: "Add to story" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Nope");
    });

    it("is hidden when there is nothing to add", () => {
      setup({ items: items.filter((i) => i.id !== "i4") });
      expect(screen.queryByLabelText("Add an existing item")).not.toBeInTheDocument();
    });
  });
});
