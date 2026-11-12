import { describe, expect, it } from "vitest";
import {
  CAPTURE_TOTAL_FRAMES,
  nextTrial,
  simulatedUsablePercentage,
  validatePracticeSearch,
} from "@/lib/practice-capture";
import { LEARN_SIGNS } from "@/lib/sample-data";

describe("practice capture", () => {
  it("bounds the 120-frame prototype estimate and keeps it separate from actual quality", () => {
    expect(CAPTURE_TOTAL_FRAMES).toBe(120);
    expect(simulatedUsablePercentage(0)).toBe(0);
    expect(simulatedUsablePercentage(119)).toBeLessThan(86);
    expect(simulatedUsablePercentage(120)).toBe(86);
    expect(simulatedUsablePercentage(121)).toBe(86);
  });

  it("advances from trial 2 to trial 3 without exceeding five trials", () => {
    expect(nextTrial(2)).toBe(3);
    expect(nextTrial(5)).toBe(5);
  });

  it("accepts a recap sign and rejects unknown sign selections", () => {
    expect(validatePracticeSearch({ sign: "Develop" })).toEqual({ sign: "Develop" });
    expect(validatePracticeSearch({ sign: "Unknown" })).toEqual({});
  });

  it("uses the five supplied video glosses and their YouTube IDs", () => {
    expect(LEARN_SIGNS).toEqual([
      { gloss: "Develop", videoId: "0bo8d1CqbV8" },
      { gloss: "Decide", videoId: "EDQofKa0Jiw" },
      { gloss: "Cloud", videoId: "Nnr6Mnv2b80" },
      { gloss: "Research", videoId: "8hSsLSpjwDQ" },
      { gloss: "Edit", videoId: "85cA3gbTx_A" },
    ]);
  });
});
