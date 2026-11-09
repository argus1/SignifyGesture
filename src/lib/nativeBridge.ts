import type { OutboundMessage } from "@/types/nativeBridge";

/** True when running inside the iOS wrapper (WKWebView with the aslBridge handler). */
export function isNativeHost(): boolean {
  return typeof window !== "undefined" && !!window.webkit?.messageHandlers?.aslBridge;
}

function post(message: OutboundMessage) {
  if (typeof window === "undefined") return;
  const handler = window.webkit?.messageHandlers?.aslBridge;
  if (handler) handler.postMessage(message);
  else console.debug("[NativeASLBridge → native, browser stub]", message);
}

/** Start/stop native camera capture (AVFoundation). */
export function triggerCameraToggle(active: boolean) {
  post({ type: "triggerCameraToggle", active });
}

/** Ask Swift (AVSpeechSynthesizer) or AWS Polly to speak a sentence. */
export function triggerTTSPlayback(text: string, voiceId?: string) {
  post({ type: "triggerTTSPlayback", text, voiceId });
}

/** Ask the native signing-mirror layer to replay a sequence of signs. */
export function triggerAvatarReplay(glossSequence: string[]) {
  post({ type: "triggerAvatarReplay", glossSequence });
}
