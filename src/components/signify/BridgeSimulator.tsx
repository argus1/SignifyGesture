import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Wrench, Play, Square } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useSignify } from "@/lib/signify-store";
import { Pill } from "./ui";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function BridgeSimulator() {
  const s = useSignify();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const stop = useRef(false);
  const ref = useRef(s);
  ref.current = s;
  const bridge = () => window.NativeASLBridge!;

  async function playDemo() {
    setOpen(false);
    stop.current = false;
    setRunning(true);
    const go = async (ms: number) => { await wait(ms); if (stop.current) throw new Error("stopped"); };
    try {
      ref.current.reset();
      await nav({ to: "/sign" });
      await go(800);
      bridge().onEngineStatusChange("listening");
      bridge().onEngineStatusChange("tracking");
      ref.current.addCaption("other", "Hi! What can I get for you?");
      await go(1600);
      for (const g of ["HELLO", "I", "WANT", "ICED"]) { bridge().onSignDetected({ gloss: g, confidence: 0.93, alternatives: [], isFinal: true }); await go(600); }
      bridge().onSignDetected({ gloss: "LATTE", confidence: 0.58, alternatives: [{ gloss: "MILK", confidence: 0.31 }, { gloss: "COFFEE", confidence: 0.08 }] });
      await go(2600);
      ref.current.resolveRepair("LATTE");
      await go(700);
      bridge().onSignDetected({ gloss: "OAT", confidence: 0.61, alternatives: [{ gloss: "OAT-MILK", confidence: 0.28 }] });
      await go(2400);
      ref.current.resolveRepair("OAT-MILK");
      await go(600);
      bridge().onSentenceTranslated({ text: "Hello! I'd like an iced oat milk latte, please." });
      bridge().onTTSPlaybackState("playing");
      await go(1800);
      bridge().onTTSPlaybackState("idle");
      ref.current.addCaption("other", "Sure! What size — small, medium or large?");
      await go(2000);
      bridge().onSentenceTranslated({ text: "Medium, please." });
      await go(1500);
      ref.current.addCaption("other", "That's $5.40. It'll be ready in a few minutes!");
      await go(1800);
      bridge().onSentenceTranslated({ text: "Thank you!" });
      await go(1500);
      await nav({ to: "/recap" });
    } catch { /* stopped */ }
    setRunning(false);
  }

  return (
    <>
      <button
        onClick={() => (running ? (stop.current = true) : setOpen(true))}
        aria-label={running ? "Stop café demo" : "Open Bridge Simulator"}
        className="absolute bottom-3 left-3 z-40 grid h-11 w-11 place-items-center rounded-full border-2 border-foreground bg-background/90 shadow"
      >
        {running ? <Square className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto max-w-[390px] rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="headline text-2xl">Bridge Simulator</SheetTitle>
            <SheetDescription>Sends fake data through window.NativeASLBridge, like the native camera would.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-2 px-4 pb-6">
            <Pill variant="mint" onClick={playDemo}><Play className="h-4 w-4" /> Play café demo</Pill>
            <Pill size="sm" onClick={() => bridge().onSignDetected({ gloss: "HELLO", confidence: 0.95, alternatives: [] })}>Confident sign (HELLO 95%)</Pill>
            <Pill size="sm" onClick={() => bridge().onSignDetected({ gloss: "LATTE", confidence: 0.58, alternatives: [{ gloss: "MILK", confidence: 0.31 }] })}>Uncertain sign (LATTE 58% / MILK 31%)</Pill>
            <Pill size="sm" onClick={() => bridge().onSentenceTranslated({ text: "Can I get an iced oat milk latte?" })}>Full sentence</Pill>
            <Pill size="sm" onClick={() => bridge().onEngineStatusChange("lost")}>Tracking lost</Pill>
            <Pill size="sm" variant="ghost" onClick={() => s.reset()}>Clear conversation</Pill>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
