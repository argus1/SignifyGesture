import { describe, expect, it } from "vitest";
import {
  CAPTURE_TOTAL_FRAMES,
  nextTrial,
  simulatedUsablePercentage,
  validatePracticeSearch,
} from "@/lib/practice-capture";

describe("practice capture", () => {
  it("uses exactly 75 frames and finishes with 86% usable frames", () => {
    expect(CAPTURE_TOTAL_FRAMES).toBe(75);
    expect(simulatedUsablePercentage(0)).toBe(0);
    expect(simulatedUsablePercentage(74)).toBeLessThan(86);
    expect(simulatedUsablePercentage(75)).toBe(86);
  });

  it("advances from trial 2 to trial 3 without exceeding five trials", () => {
    expect(nextTrial(2)).toBe(3);
    expect(nextTrial(5)).toBe(5);
  });

  it("accepts a recap sign and rejects unknown sign selections", () => {
    expect(validatePracticeSearch({ sign: "Latte" })).toEqual({ sign: "Latte" });
    expect(validatePracticeSearch({ sign: "Unknown" })).toEqual({});
  });
});
