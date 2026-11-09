import { describe, expect, it } from "vitest";
import { decideSign, DEFAULT_THRESHOLD, STREAK_LIMIT } from "@/lib/signify-store";

describe("repair agent", () => {
  it("default threshold is 75%", () => expect(DEFAULT_THRESHOLD).toBe(0.75));
  it("asks to confirm a 58% sign", () => expect(decideSign({ gloss: "LATTE", confidence: 0.58 }, 0.75, [], false).kind).toBe("repair"));
  it("accepts a 95% sign", () => expect(decideSign({ gloss: "HELLO", confidence: 0.95 }, 0.75, [], false).kind).toBe("accept"));
  it("skips checking when paused", () => expect(decideSign({ gloss: "LATTE", confidence: 0.58 }, 0.75, [], true).kind).toBe("accept"));
  it("applies learned corrections", () => expect(decideSign({ gloss: "LATTE", confidence: 0.58 }, 0.75, [{ heard: "LATTE", meant: "MILK" }], false)).toEqual({ kind: "learned", text: "MILK" }));
  it("suggests typing after 3 unclear signs", () => expect(STREAK_LIMIT).toBe(3));
});
