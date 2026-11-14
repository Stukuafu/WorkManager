import { cleanup, render, screen } from "@testing-library/react";
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
});
