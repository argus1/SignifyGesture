import { SIGNS } from "@/lib/sample-data";

export const CAPTURE_TOTAL_FRAMES = 120;
export const CAPTURE_INTERVAL_MS = 1_000 / 12;
export const TARGET_USABLE_PERCENT = 86;
export const INITIAL_TRIAL = 2;
export const MAX_TRIALS = 5;

/** Prototype estimates only; real capture quality must come from the native recorder. */
export function simulatedUsablePercentage(frameCount: number) {
  const frames = Math.max(0, Math.min(CAPTURE_TOTAL_FRAMES, Math.floor(frameCount)));
  return Math.round((frames / CAPTURE_TOTAL_FRAMES) * TARGET_USABLE_PERCENT);
}

export function nextTrial(trial: number) {
  return Math.min(MAX_TRIALS, trial + 1);
}

/** Only known practice signs may be selected through a link. */
export function validatePracticeSearch(search: Record<string, unknown>): { sign?: string } {
  return typeof search["sign"] === "string" && SIGNS.includes(search["sign"])
    ? { sign: search["sign"] }
    : {};
}
