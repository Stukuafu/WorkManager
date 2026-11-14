import { describe, expect, it } from "vitest";
import {
  formatItemKey,
  isValidProjectKey,
  normalizeProjectKey,
  parseItemKey,
  suggestProjectKey,
} from "./keys";

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

describe("suggestProjectKey", () => {
  it("uses initials for multi-word names", () => {
    expect(suggestProjectKey("Work Manager")).toBe("WM");
    expect(suggestProjectKey("a b c d e f g")).toBe("ABCDE");
  });

  it("uses leading letters for single words", () => {
    expect(suggestProjectKey("Billing")).toBe("BILL");
    expect(suggestProjectKey("QA")).toBe("QA");
  });

  it("ignores digits and punctuation, and handles empty input", () => {
    expect(suggestProjectKey("Q3 Roadmap!")).toBe("QR");
    expect(suggestProjectKey("123")).toBe("");
    expect(suggestProjectKey("")).toBe("");
  });
});
