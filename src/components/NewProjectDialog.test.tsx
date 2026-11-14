import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NewProjectDialog } from "./NewProjectDialog";

afterEach(cleanup);

describe("NewProjectDialog", () => {
  it("suggests a key from the name and submits normalized values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<NewProjectDialog onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText("Name"), "Work Manager");
    expect(screen.getByLabelText("Key")).toHaveValue("WM");

    await user.click(screen.getByRole("button", { name: "Create project" }));
    expect(onSubmit).toHaveBeenCalledWith({ key: "WM", name: "Work Manager" });
  });

  it("stops auto-suggesting once the key is edited by hand", async () => {
    const user = userEvent.setup();
    render(<NewProjectDialog onSubmit={vi.fn()} onCancel={() => {}} />);
    await user.type(screen.getByLabelText("Name"), "Work");
    await user.clear(screen.getByLabelText("Key"));
    await user.type(screen.getByLabelText("Key"), "zz");
    await user.type(screen.getByLabelText("Name"), " Manager");
    expect(screen.getByLabelText("Key")).toHaveValue("ZZ");
  });

  it("validates before submitting", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<NewProjectDialog onSubmit={onSubmit} onCancel={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Create project" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a project name");

    await user.type(screen.getByLabelText("Name"), "x");
    await user.click(screen.getByRole("button", { name: "Create project" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Key must be 2-5 letters");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows errors from the server and allows retry", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("Project key WM is already in use"));
    render(<NewProjectDialog onSubmit={onSubmit} onCancel={() => {}} />);
    await user.type(screen.getByLabelText("Name"), "Work Manager");
    await user.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already in use");
    expect(screen.getByRole("button", { name: "Create project" })).toBeEnabled();
  });

  it("cancels with Escape", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<NewProjectDialog onSubmit={vi.fn()} onCancel={onCancel} />);
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();
  });
});
