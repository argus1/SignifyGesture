import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignifyProvider, useNativeBridge, useSignify } from "@/lib/signify-store";
import { SpeakingIndicator, VoiceWaveform } from "@/routes/sign";
import { speechStatusText } from "@/lib/speechStatus";

function Probe() {
  const s = useSignify();
  const e = useNativeBridge();
  return (
    <div>
      <p data-testid="captions">{s.captions.map((c) => `${c.speaker}:${c.text}`).join("|")}</p>
      <p data-testid="speech">{e.speechStatus?.state ?? "none"}</p>
      <p data-testid="cue">{e.ttsCue?.kind ?? "none"}</p>
      <p data-testid="progress">
        {e.ttsProgress
          ? e.ttsProgress.text.slice(
              e.ttsProgress.location,
              e.ttsProgress.location + e.ttsProgress.length,
            )
          : ""}
      </p>
      <button onClick={() => s.say("Medium, please.", "sam", { typed: true })}>say</button>
      <VoiceWaveform hearing={false} speaking={e.ttsPlaying} dim={false} native />
      {e.ttsPlaying && <SpeakingIndicator />}
    </div>
  );
}

describe("speech captions and TTS bridge", () => {
  let root: Root | undefined;
  let container: HTMLDivElement;
  const text = (id: string) => container.querySelector(`[data-testid="${id}"]`)?.textContent;
  const level = () =>
    container.querySelector('[data-testid="voice-waveform"]')?.getAttribute("data-level");
  const bridge = () => window.NativeASLBridge!;
  const render = (postMessage = vi.fn()) => {
    window.webkit = { messageHandlers: { aslBridge: { postMessage } } };
    container = document.createElement("div");
    root = createRoot(container);
    act(() =>
      root?.render(
        <SignifyProvider>
          <Probe />
        </SignifyProvider>,
      ),
    );
    return postMessage;
  };

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = undefined;
    delete window.webkit;
    delete window.NativeASLBridge;
    document.documentElement.removeAttribute("data-native-host");
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("captions the hearing person but never the app's own voice", () => {
    const postMessage = render();
    act(() => bridge().onSpeechTranscribed({ text: "What size", isFinal: false }));
    act(() => bridge().onSpeechTranscribed({ text: "What size?", isFinal: true }));
    expect(text("captions")).toBe("other:What size?");

    act(() => container.querySelector("button")?.click());
    expect(postMessage).toHaveBeenLastCalledWith({
      type: "triggerTTSPlayback",
      text: "Medium, please.",
    });
    act(() => bridge().onTTSPlaybackState(true));
    act(() => bridge().onSpeechTranscribed({ text: "Medium please", isFinal: true }));
    expect(text("captions")).toBe("other:What size?|sam:Medium, please.");
  });

  it("shows start/end cues, read-along progress, and a Stop speaking control", () => {
    vi.useFakeTimers();
    const postMessage = render();
    act(() => bridge().onTTSPlaybackState(true));
    expect(text("cue")).toBe("start");
    act(() => bridge().onTTSProgress({ text: "Medium, please.", location: 8, length: 6 }));
    expect(text("progress")).toBe("please");
    expect(Number(level())).toBeGreaterThan(0.5);
    act(() => vi.advanceTimersByTime(200));
    expect(Number(level())).toBeCloseTo(0.2);

    const stop = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Stop speaking"),
    );
    act(() => stop?.click());
    expect(postMessage).toHaveBeenLastCalledWith({ type: "stopTTSPlayback" });

    act(() => bridge().onTTSPlaybackState(false));
    expect(text("cue")).toBe("end");
    expect(text("progress")).toBe("");
    expect(level()).toBe("0.00");
    expect(container.textContent).not.toContain("Stop speaking");
  });

  it("drives the waveform from mic levels and drops them when listening stops", () => {
    render();
    act(() => bridge().onSpeechRecognitionStatusChange({ state: "listening", onDevice: true }));
    act(() => bridge().onAudioLevel({ source: "mic", level: 0.8 }));
    expect(level()).toBe("0.80");
    act(() => bridge().onAudioLevel({ source: "mic", level: 4 }));
    expect(level()).toBe("1.00");
    act(() => bridge().onSpeechRecognitionStatusChange({ state: "denied" }));
    expect(text("speech")).toBe("denied");
    expect(level()).toBe("0.00");
  });

  it("vibrates on TTS start and end in a browser without the native host", () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    container = document.createElement("div");
    root = createRoot(container);
    act(() =>
      root?.render(
        <SignifyProvider>
          <Probe />
        </SignifyProvider>,
      ),
    );
    act(() => bridge().onTTSPlaybackState(true));
    act(() => bridge().onTTSPlaybackState(true));
    act(() => bridge().onTTSPlaybackState(false));
    expect(vibrate.mock.calls).toEqual([[60], [[40, 60, 40]]]);
    delete (navigator as { vibrate?: unknown }).vibrate;
  });

  it("explains every live-caption state in words", () => {
    expect(speechStatusText(null, false)).toMatch(/Mic off/);
    expect(speechStatusText({ state: "listening" }, true)).toBeNull();
    expect(speechStatusText({ state: "denied" }, true)).toBe(
      "Live captions are unavailable. Tap Type to reply",
    );
    expect(speechStatusText({ state: "restricted" }, true)).toMatch(/Tap Type/);
    expect(speechStatusText({ state: "unavailable", message: "No speech model." }, true)).toBe(
      "No speech model. Tap Type to reply",
    );
    expect(
      speechStatusText(
        { state: "paused", message: "Captions paused while Signify is in the background." },
        true,
      ),
    ).toMatch(/background/);
    expect(speechStatusText({ state: "error" }, true)).toMatch(/Tap the mic/);
  });
});
