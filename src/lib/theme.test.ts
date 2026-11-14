import { beforeEach, describe, expect, it } from "vitest";
import { applyTheme, parseTheme, readStoredTheme, storeTheme, THEME_STORAGE_KEY } from "./theme";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("theme", () => {
  it("only accepts light or dark, and treats anything else as system", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    for (const value of ["system", "", "blue", null, undefined, 5]) expect(parseTheme(value)).toBe("system");
  });

  it("stores an explicit choice and clears it for system", () => {
    storeTheme("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(readStoredTheme()).toBe("dark");
    storeTheme("system");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(readStoredTheme()).toBe("system");
  });

  it("ignores a corrupted stored value", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "purple");
    expect(readStoredTheme()).toBe("system");
  });

  it("sets and clears data-theme on the root element", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    applyTheme("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    applyTheme("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});
