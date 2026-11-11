import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isNativeHost,
  stopTTSPlayback,
  triggerAvatarReplay,
  triggerCameraToggle,
  triggerSpeechRecognition,
  triggerTTSPlayback,
} from "@/lib/nativeBridge";
import { syncSessionToAWS } from "@/services/awsSync";

describe("outbound native bridge", () => {
  afterEach(() => { delete window.webkit; });

  it("is not a native host in a plain browser", () => expect(isNativeHost()).toBe(false));

  it("posts typed messages to the Swift aslBridge handler", () => {
    const postMessage = vi.fn();
    window.webkit = { messageHandlers: { aslBridge: { postMessage } } };
    expect(isNativeHost()).toBe(true);
    triggerCameraToggle(true);
    triggerTTSPlayback("Thank you!", "en-US");
    triggerAvatarReplay(["COFFEE", "ICED"]);
    triggerSpeechRecognition(true);
    stopTTSPlayback();
    triggerSpeechRecognition(false);
    expect(postMessage.mock.calls.map((c) => c[0])).toEqual([
      { type: "triggerCameraToggle", active: true },
      { type: "triggerTTSPlayback", text: "Thank you!", voiceId: "en-US" },
      { type: "triggerAvatarReplay", glossSequence: ["COFFEE", "ICED"] },
      { type: "triggerSpeechRecognition", active: true },
      { type: "stopTTSPlayback" },
      { type: "triggerSpeechRecognition", active: false },
    ]);
  });

  it("does not throw without the native handler", () => expect(() => triggerCameraToggle(false)).not.toThrow());

  it("AWS sync stub resolves", async () => expect((await syncSessionToAWS({ a: 1 })).ok).toBe(true));
});
