import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkItem } from "../domain/types";
import { ItemForm } from "./ItemForm";

afterEach(cleanup);

const existing: WorkItem = {
  id: "i1",
  projectId: "p",
  number: 7,
  title: "Existing",
  description: "desc",
  type: "bug",
  status: "in_review",
  priority: "high",
  labels: ["ui", "api"],
  dueDate: "2026-12-01",
  order: 0,
  createdAt: "",
  updatedAt: "",
};

describe("ItemForm", () => {
  it("submits a new item with parsed labels and defaults", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ItemForm onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText("Title"), "Build login");
    await user.type(screen.getByLabelText("Labels"), "ui, auth ,ui");
    await user.selectOptions(screen.getByLabelText("Priority"), "critical");
    await user.click(screen.getByRole("button", { name: "Create item" }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: "Build login",
      description: "",
      type: "task",
      priority: "critical",
      status: "todo",
      labels: ["ui", "auth"],
      dueDate: undefined,
    });
  });

  it("requires a title", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ItemForm onSubmit={onSubmit} onCancel={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Create item" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a title");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("prefills an existing item", () => {
    render(<ItemForm item={existing} onSubmit={vi.fn()} onCancel={() => {}} />);
    expect(screen.getByLabelText("Title")).toHaveValue("Existing");
    expect(screen.getByLabelText("Labels")).toHaveValue("ui, api");
    expect(screen.getByLabelText("Status")).toHaveValue("in_review");
    expect(screen.getByLabelText("Due date")).toHaveValue("2026-12-01");
  });

  it("asks for confirmation before deleting", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <ItemForm item={existing} onSubmit={vi.fn()} onDelete={onDelete} onCancel={() => {}} />,
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Keep" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("confirms a successful save and uses a custom cancel label", async () => {
    const user = userEvent.setup();
    render(<ItemForm item={existing} onSubmit={vi.fn().mockResolvedValue(undefined)} onCancel={() => {}} cancelLabel="Close" />);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Title"), "!");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows save errors and stays usable", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("Boom"));
    render(<ItemForm item={existing} onSubmit={onSubmit} onCancel={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Boom");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });
});
