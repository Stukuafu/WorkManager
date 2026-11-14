import { describe, expect, it } from "vitest";
import { formatItemKey, isValidProjectKey, normalizeProjectKey, parseItemKey } from "./keys";

describe("project keys", () => {
  it("normalizes input", () => {
    expect(normalizeProjectKey("  wm ")).toBe("WM");
  });

  it("accepts 2-5 uppercase letters only", () => {
    expect(isValidProjectKey("WM")).toBe(true);
    expect(isValidProjectKey("WORKS")).toBe(true);
    expect(isValidProjectKey("W")).toBe(false);
    expect(isValidProjectKey("TOOLONG")).toBe(false);
    expect(isValidProjectKey("W1")).toBe(false);
    expect(isValidProjectKey("wm")).toBe(false);
  });
});

describe("item keys", () => {
  it("formats keys", () => {
    expect(formatItemKey("WM", 12)).toBe("WM-12");
  });

  it("parses keys", () => {
    expect(parseItemKey("wm-12")).toEqual({ projectKey: "WM", number: 12 });
    expect(parseItemKey("WM-0")).toBeNull();
    expect(parseItemKey("WM12")).toBeNull();
    expect(parseItemKey("")).toBeNull();
  });
});
