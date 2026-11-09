/**
 * Contract between this web UI and the native iOS (Swift) wrapper.
 * Swift calls the inbound methods via `evaluateJavaScript("window.NativeASLBridge.onSignDetected({...})")`.
 * The web UI calls outbound commands, which post to `window.webkit.messageHandlers.aslBridge`.
 */

export type Alternative = { gloss: string; confidence: number };

/** Inbound: one recognized ASL token from Core ML. */
export type SignDetectedPayload = {
  gloss: string;
  confidence: number; // 0–1
  isFinal: boolean;
  timestamp: number; // ms since epoch
  /** Optional extension used by the repair agent: next-best guesses, highest first. */
  alternatives?: Alternative[];
};

/** Inbound: a refined sentence from the LLM / AWS translation step. */
export type SentenceTranslatedPayload = {
  rawGloss: string;
  naturalEnglish: string;
  audioUrl?: string;
};

/** Inbound: the hearing person's speech from the iPhone microphone (native speech recognition). Partial results stream with isFinal=false. */
export type SpeechTranscribedPayload = {
  text: string;
  isFinal: boolean;
};

export type TrackingState = "idle" | "tracking" | "lost";

/** Inbound: camera / tracking / inference status for badges. */
export type EngineStatusPayload = {
  cameraActive: boolean;
  trackingState: TrackingState;
  inferenceLatencyMs: number;
};

export interface NativeASLBridge {
  onSignDetected(payload: SignDetectedPayload): void;
  onSentenceTranslated(payload: SentenceTranslatedPayload): void;
  onEngineStatusChange(status: EngineStatusPayload): void;
  onTTSPlaybackState(isPlaying: boolean): void;
  /** Extension: what the hearing person said. Native should mute the mic while TTS is playing so the app doesn't caption itself. */
  onSpeechTranscribed(payload: SpeechTranscribedPayload): void;
}

/** Outbound: messages posted to the Swift `aslBridge` script message handler. */
export type OutboundMessage =
  | { type: "triggerCameraToggle"; active: boolean }
  | { type: "triggerTTSPlayback"; text: string; voiceId?: string | undefined }
  | { type: "triggerAvatarReplay"; glossSequence: string[] };

declare global {
  interface Window {
    NativeASLBridge?: NativeASLBridge;
    webkit?: { messageHandlers?: { aslBridge?: { postMessage(message: OutboundMessage): void } } };
  }
}
