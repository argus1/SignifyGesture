import type { MemoryRequest } from "@/types/memory";

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
  latencyMs?: number;
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

export type SpeechRecognitionState =
  "idle" | "preparing" | "listening" | "paused" | "denied" | "restricted" | "unavailable" | "error";

/** Inbound: live-caption (microphone + speech recognition) lifecycle. `onDevice` is true when audio never leaves the phone. */
export type SpeechRecognitionStatusPayload = {
  state: SpeechRecognitionState;
  message?: string;
  onDevice?: boolean;
};

/** Inbound: normalized loudness (0–1, ~15 Hz) that drives the visual waveform for Deaf/HoH users. */
export type AudioLevelPayload = {
  source: "mic" | "tts";
  level: number;
};

/** Inbound: the word TTS is about to speak (UTF-16 range into `text`), for visual read-along. */
export type TTSProgressPayload = {
  text: string;
  location: number;
  length: number;
};

export type TrackingState = "idle" | "tracking" | "lost";

export type RecognitionStatus =
  "modelUnavailable" | "confidenceThresholdNotValidated" | "noResult" | "unsupportedGloss";

/** Inbound: recognition readiness and explicit no-result reasons. */
export type RecognitionStatusPayload = {
  state: RecognitionStatus;
  message?: string;
  latencyMs?: number;
};

/** Inbound: camera / tracking / inference status for badges. */
export type EngineStatusPayload = {
  cameraActive: boolean;
  trackingState: TrackingState;
  inferenceLatencyMs: number;
};

export type NativeErrorPayload = {
  feature: string;
  message: string;
};

export interface NativeASLBridge {
  onMemoryResult(payload: unknown): void;
  onSignDetected(payload: SignDetectedPayload): void;
  onSentenceTranslated(payload: SentenceTranslatedPayload): void;
  onEngineStatusChange(status: EngineStatusPayload): void;
  onRecognitionStatusChange(status: RecognitionStatusPayload): void;
  onTTSPlaybackState(isPlaying: boolean): void;
  onNativeError(error: NativeErrorPayload): void;
  /** Extension: what the hearing person said. Native should mute the mic while TTS is playing so the app doesn't caption itself. */
  onSpeechTranscribed(payload: SpeechTranscribedPayload): void;
  onSpeechRecognitionStatusChange(status: SpeechRecognitionStatusPayload): void;
  onAudioLevel(payload: AudioLevelPayload): void;
  onTTSProgress(payload: TTSProgressPayload): void;
}

/** Outbound: messages posted to the Swift `aslBridge` script message handler. */
export type OutboundMessage =
  | MemoryRequest
  | { type: "triggerCameraToggle"; active: boolean }
  | { type: "triggerSpeechRecognition"; active: boolean }
  | { type: "triggerTTSPlayback"; text: string; voiceId?: string | undefined }
  | { type: "stopTTSPlayback" }
  | { type: "triggerAvatarReplay"; glossSequence: string[] };

declare global {
  interface Window {
    NativeASLBridge?: NativeASLBridge;
    webkit?: { messageHandlers?: { aslBridge?: { postMessage(message: OutboundMessage): void } } };
  }
}
