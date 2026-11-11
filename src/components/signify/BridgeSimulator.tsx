import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Wrench, Play, Square, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useNativeBridge, useSignify } from "@/lib/signify-store";
import type { Alternative } from "@/types/nativeBridge";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Dev-only drawer that drives window.NativeASLBridge with fake data, exactly as the Swift wrapper would. */
export function BridgeSimulator() {
  const s = useSignify();
  const engine = useNativeBridge();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const stop = useRef(false);
  const ref = useRef(s);
  ref.current = s;
  const bridge = () => window.NativeASLBridge!;
  const sign = (gloss: string, confidence: number, alternatives: Alternative[] = []) =>
    bridge().onSignDetected({ gloss, confidence, alternatives, isFinal: true, timestamp: Date.now() });
  const sentence = (naturalEnglish: string, rawGloss = naturalEnglish.toUpperCase()) => bridge().onSentenceTranslated({ rawGloss, naturalEnglish });
  const status = (trackingState: "idle" | "tracking" | "lost") =>
    bridge().onEngineStatusChange({ cameraActive: true, trackingState, inferenceLatencyMs: 38 + Math.round(Math.random() * 20) });

  async function playDemo() {
    setOpen(false);
    stop.current = false;
    setRunning(true);
    const go = async (ms: number) => { await wait(ms); if (stop.current) throw new Error("stopped"); };
    // Pause the demo until the person taps a word in "Which sign did you mean?" (no auto-picking)
    // The barista talking: words stream in from the mic like live speech recognition
    const hear = async (line: string) => {
      const words = line.split(" ");
      for (let i = 1; i <= words.length; i++) {
        bridge().onSpeechTranscribed({ text: words.slice(0, i).join(" "), isFinal: i === words.length });
        await go(i === words.length ? 0 : 260);
      }
    };
    // (also waits while they type the right word instead)
    const waitForPick = async () => { await go(400); while (ref.current.pending || ref.current.awaitingTyped) await go(200); };
    try {
      ref.current.reset();
      // Starts on home — waits for you to tap "Start conversation"
      await nav({ to: "/home" });
      while (window.location.pathname !== "/sign") await go(200);
      await go(1500);
      status("tracking");
      await hear("Hi! What can I get started for you?");
      await go(3000);
      for (const g of ["HELLO", "I", "WANT", "ICED"]) { sign(g, 0.93); await go(1300); }
      sign("LATTE", 0.58, [{ gloss: "MILK", confidence: 0.31 }, { gloss: "COFFEE", confidence: 0.08 }]);
      await waitForPick();
      await go(1500);
      sign("OAT", 0.61, [{ gloss: "OAT-MILK", confidence: 0.28 }]);
      await waitForPick();
      await go(1500);
      const spoken = "Hello! I'd like an iced oat milk latte, please.";
      sentence(spoken, "HELLO I WANT ICED OAT-MILK LATTE");
      bridge().onTTSPlaybackState(true);
      // Like AVSpeechSynthesizer's willSpeakRange: one progress event per word, driving the read-along + waveform
      for (const m of spoken.matchAll(/\S+/g)) {
        bridge().onTTSProgress({ text: spoken, location: m.index ?? 0, length: m[0].length });
        await go(330);
      }
      bridge().onTTSPlaybackState(false);
      await hear("Sure! What size? Small, medium or large?");
      await go(3500);
      sign("MEDIUM", 0.92); await go(1300);
      sign("PLEASE", 0.95); await go(1600);
      sentence("Medium, please.", "MEDIUM PLEASE");
      await go(2500);
      await hear("That's $5.40. It'll be ready in a few minutes!");
      await go(3000);
      sign("THANK-YOU", 0.96); await go(1400);
      sentence("Thank you!", "THANK-YOU");
      // Ends here: tap the back arrow to see the recap
    } catch { /* stopped */ }
    setRunning(false);
  }

  const item = "w-full rounded-full bg-muted px-4 py-2.5 text-left text-sm font-semibold active:bg-secondary";

  // Docked right beside the phone frame (not over it). On narrow screens it falls back to the bottom-right corner.
  return (
    <div className="fixed bottom-5 right-5 z-50 flex w-72 flex-col items-end gap-2 sm:bottom-auto sm:right-auto sm:left-[calc(50%+211px)] sm:top-6 sm:items-start">
      <button
        onClick={() => (running ? (stop.current = true) : setOpen(!open))}
        aria-label={running ? "Stop café demo" : "Bridge Simulator"}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
      >
        {running ? <Square className="h-4 w-4" /> : open ? <X className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
        {running ? "Stop demo" : "Bridge Simulator"}
      </button>
      {open && !running && (
        <div role="dialog" aria-label="Bridge Simulator" className="order-first w-full rounded-[1.75rem] bg-background p-4 shadow-2xl sm:order-none">
          <p className="px-1 text-base font-black">Bridge Simulator</p>
          <p className="mb-3 px-1 text-xs text-muted-foreground">Fakes what the native camera + AI would send.</p>
          <div className="grid gap-2">
            <button onClick={playDemo} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-bold active:scale-[0.98]"><Play className="h-4 w-4" /> Play café demo</button>
            <p className="px-1 pt-1 text-xs font-bold text-muted-foreground">Jump to</p>
            <div className="grid grid-cols-3 gap-2">
              {([["Home", "/home"], ["Conversation", "/sign"], ["Recap", "/recap"]] as const).map(([label, to]) => (
                <button key={to} onClick={() => nav({ to })} className="rounded-full bg-muted py-2.5 text-xs font-semibold active:bg-secondary">{label}</button>
              ))}
            </div>
            <p className="px-1 pt-1 text-xs font-bold text-muted-foreground">Single moments</p>
            <button className={item} onClick={() => sign("HELLO", 0.95)}>Confident sign · HELLO 95%</button>
            <button className={item} onClick={() => sign("LATTE", 0.58, [{ gloss: "MILK", confidence: 0.31 }])}>Unsure sign · LATTE 58%</button>
            <button className={item} onClick={() => bridge().onSpeechTranscribed({ text: "Hi! What can I get started for you?", isFinal: true })}>Barista speaks</button>
            <button className={item} onClick={() => sentence("Can I get an iced oat milk latte?", "I WANT ICED OAT-MILK LATTE")}>Full sentence</button>
            <button className={item} onClick={() => status("lost")}>Hands out of view</button>
            <button className={item} onClick={() => s.reset()}>Clear conversation</button>
            <label className="flex items-center justify-between rounded-full bg-muted py-2 pl-4 pr-2 text-sm font-semibold">
              Dashed camera frames
              <Switch checked={engine.devPreview} onCheckedChange={engine.setDevPreview} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
