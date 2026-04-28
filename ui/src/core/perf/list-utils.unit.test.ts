import { describe, expect, it } from "vitest";
import { decimateSeriesForDisplay, estimateWindowRows, parseJsonSafe } from "./list-utils";

describe("decimateSeriesForDisplay", () => {
  it("returns the original array when shorter than maxPoints", () => {
    const series = [1, 2, 3, 4, 5];
    expect(decimateSeriesForDisplay(series, 10)).toBe(series);
  });

  it("reduces a long series to at most maxPoints samples", () => {
    const series = Array.from({ length: 200 }, (_, i) => i);
    const result = decimateSeriesForDisplay(series, 20);
    expect(result.length).toBe(20);
    expect(result[0]).toBe(0);
    expect(result[result.length - 1]).toBe(199);
  });
});

describe("parseJsonSafe", () => {
  it("returns the raw string when short enough", () => {
    const raw = '{"x": 1}';
    expect(parseJsonSafe(raw, 1000)).toBe(raw);
  });

  it("truncates oversized input with a notice", () => {
    const raw = "a".repeat(200);
    const result = parseJsonSafe(raw, 100);
    expect(result.startsWith("a".repeat(100))).toBe(true);
    expect(result).toContain("truncated at 100");
  });
});

describe("estimateWindowRows", () => {
  it("adds 2 overscan rows to the computed visible row count", () => {
    expect(estimateWindowRows(320, 32)).toBe(12);
  });
});
