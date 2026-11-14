import { describe, expect, it } from "vitest";
import { cycleTime, formatDateTime, formatDuration } from "./time";

describe("formatDuration", () => {
  it("formats the common ranges", () => {
    expect(formatDuration(0)).toBe("<1m");
    expect(formatDuration(59_000)).toBe("<1m");
    expect(formatDuration(5 * 60_000)).toBe("5m");
    expect(formatDuration(3 * 3_600_000)).toBe("3h");
    expect(formatDuration(3 * 3_600_000 + 20 * 60_000)).toBe("3h 20m");
    expect(formatDuration(2 * 86_400_000)).toBe("2d");
    expect(formatDuration(2 * 86_400_000 + 4 * 3_600_000 + 5 * 60_000)).toBe("2d 4h");
  });

  it("handles invalid input", () => {
    expect(formatDuration(Number.NaN)).toBe("<1m");
    expect(formatDuration(-5)).toBe("<1m");
  });
});

describe("cycleTime", () => {
  it("is null until completed", () => {
    expect(cycleTime("2026-11-14T10:00:00Z")).toBeNull();
  });

  it("is the time between creation and completion", () => {
    expect(cycleTime("2026-11-14T10:00:00Z", "2026-11-16T14:30:00Z")).toBe("2d 4h");
  });
});

describe("formatDateTime", () => {
  it("returns the input for invalid dates", () => {
    expect(formatDateTime("nope")).toBe("nope");
  });

  it("includes the year", () => {
    expect(formatDateTime("2026-11-14T10:00:00Z")).toContain("2026");
  });
});
