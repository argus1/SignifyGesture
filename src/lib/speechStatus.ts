import type { SpeechRecognitionStatusPayload } from "@/types/nativeBridge";

const BLOCKED = new Set<SpeechRecognitionStatusPayload["state"]>([
  "denied",
  "restricted",
  "unavailable",
  "error",
]);

/** Live captions can't run until the user acts (permission, settings, retry). */
export function captionsBlocked(st: SpeechRecognitionStatusPayload | null): boolean {
  return !!st && BLOCKED.has(st.state);
}

/** What the live-caption (mic) state means for the person reading the screen; null = normal listening. */
export function speechStatusText(
  st: SpeechRecognitionStatusPayload | null,
  micOn: boolean,
): string | null {
  if (!micOn) return "Mic off. Tap the mic to hear them again";
  if (!st) return null;
  switch (st.state) {
    case "listening":
    case "idle":
      return null;
    case "preparing":
      return st.message ?? "Getting live captions ready";
    case "paused":
      return st.message ?? "Captions paused";
    case "denied":
    case "restricted":
      return "Live captions are unavailable. Tap Type to reply";
    case "unavailable":
      return `${st.message ?? "Live captions are unavailable on this device."} Tap Type to reply`;
    case "error":
      return st.message ?? "Captions stopped. Tap the mic to try again";
  }
}
