import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY } from "../lib/theme";
import { ThemeSelect } from "./ThemeSelect";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});
afterEach(cleanup);

describe("ThemeSelect", () => {
  it("defaults to the system theme and leaves the page alone", () => {
    render(<ThemeSelect />);
    expect(screen.getByLabelText("Theme")).toHaveValue("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("applies and remembers a dark choice, then switches back", async () => {
    const user = userEvent.setup();
    render(<ThemeSelect />);
    await user.selectOptions(screen.getByLabelText("Theme"), "Dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    await user.selectOptions(screen.getByLabelText("Theme"), "Light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    await user.selectOptions(screen.getByLabelText("Theme"), "System theme");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("starts from a saved choice", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(<ThemeSelect />);
    expect(screen.getByLabelText("Theme")).toHaveValue("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("falls back to system for an unrecognised saved value", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "neon");
    render(<ThemeSelect />);
    expect(screen.getByLabelText("Theme")).toHaveValue("system");
  });
});
