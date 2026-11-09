import { useState, type ReactNode } from "react";
import { Bot, Undo2, Check, Pause, Play, Keyboard, X as XIcon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { useSignify, type AgentStep } from "@/lib/signify-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AgentIcon } from "./AgentIcon";

const STEPS: { id: AgentStep; label: string; says: string }[] = [
  { id: "translate", label: "Translate", says: "Turning your signs into English." },
  { id: "check", label: "Check", says: "Double-checking a sign it isn’t sure about." },
  { id: "repair", label: "Repair", says: "Waiting for you to pick the right word." },
  { id: "recap", label: "Recap", says: "Summing up the conversation." },
];

/** Where the agent is right now: 4 steps, current one highlighted, with a plain sentence underneath. */
export function Pipeline() {
  const { step, paused } = useSignify();
  const current = STEPS.find((s) => s.id === step) ?? STEPS[0]!;
  return (
    <div>
      <ol className="grid grid-cols-4 rounded-full bg-muted p-1" aria-label="Agent steps">
        {STEPS.map((s) => (
          <li key={s.id} aria-current={step === s.id ? "step" : undefined}
            className={cn("rounded-full py-2 text-center text-xs font-bold transition-colors", step === s.id ? "bg-background shadow-sm" : "text-muted-foreground")}>
            {s.label}
          </li>
        ))}
      </ol>
      <p className="mt-2 px-1 text-sm text-muted-foreground">{paused ? "Paused. Your signs go straight through, unchecked." : current.says}</p>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2 px-1 text-sm font-bold">{children}</p>;
}

/**
 * What the agent does, as one plain paragraph. The step it's on right now is highlighted in the sentence,
 * so the four steps (translate, check, repair, recap) read as a story instead of a row of tabs.
 */
function AgentStory() {
  const { step, paused } = useSignify();
  const steps: { id: AgentStep; verb: string; rest: string }[] = [
    { id: "translate", verb: "Translates", rest: "your signs into English" },
    { id: "check", verb: "Checks", rest: "signs it isn’t sure about" },
    { id: "repair", verb: "Asks you", rest: "to fix them first" },
    { id: "recap", verb: "Recaps", rest: "the conversation at the end" },
  ];
  // Same text on and off, so nothing shifts; when off, no step is highlighted
  return (
    <ol className="space-y-1.5">
      {steps.map((x, i) => {
        const now = !paused && step === x.id;
        return (
          <li key={x.id} aria-current={now ? "step" : undefined}
            className={cn("flex items-center gap-3 rounded-full py-1 pl-1 pr-3 transition-colors", now && "bg-accent")}>
            <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors", now ? "bg-primary text-foreground" : "bg-muted text-muted-foreground")}>{i + 1}</span>
            <span className="text-[15px] leading-snug text-muted-foreground">
              <span className={cn("font-bold", now ? "text-mint-ink" : "text-foreground")}>{x.verb}</span> {x.rest}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Agent button + a read-only “under the hood” sheet: what the agent does, what it just did, what it learned. Controls live on the conversation screen. */
export function AgentChip({ className }: { className?: string }) {
  const a = useSignify();
  const open = a.agentOpen, setOpen = a.setAgentOpen;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn("relative grid h-11 w-11 place-items-center rounded-full bg-background/85 backdrop-blur-md active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40", className)}
        aria-label={`Signify Agent: ${a.paused ? "paused" : a.step}. See what it’s doing`}
      >
        <AgentIcon mood={a.paused ? "off" : a.step === "repair" ? "thinking" : "idle"} />
        {/* Brand mint only: steady when on, pulsing while it asks you about a sign, no dot when the agent is off */}
        {!a.paused && (
          <span aria-hidden className={cn("absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-primary ring-2 ring-white", a.step === "repair" && "animate-pulse")} />
        )}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent inPhone hideClose side="bottom" className="max-h-[90%] overflow-y-auto rounded-t-[2rem]">
          <SheetHeader className="text-left">
            <div className="flex items-start gap-3">
              <SheetTitle className="flex-1 pt-2 text-2xl font-black">Signify Agent</SheetTitle>
              {/* On/off: the agent itself. Tap to turn off and a line strikes through it. */}
              <button onClick={() => a.setPaused(!a.paused)} aria-pressed={!a.paused} aria-label={a.paused ? "Agent is off. Turn on" : "Agent is on. Turn off"}
                className={cn("flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-full bg-muted transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40",
                  a.paused ? "text-muted-foreground" : "text-foreground")}>
                {/* One bubble: the agent on top, On/Off directly underneath */}
                <span className="relative grid h-5 w-5 place-items-center">
                  <AgentIcon mood={a.paused ? "off" : "idle"} />
                  {a.paused && (
                    <svg viewBox="0 0 24 24" className="pointer-events-none absolute inset-0" aria-hidden>
                      <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="agent-strike" />
                    </svg>
                  )}
                </span>
                <span className="text-[11px] font-bold leading-none">{a.paused ? "Off" : "On"}</span>
              </button>
            </div>
            <SheetDescription asChild><div className="pb-2 pt-2"><AgentStory /></div></SheetDescription>
          </SheetHeader>
          <div className="space-y-5 pt-3">

            {/* What the agent just did, and why */}
            <section>
              <SectionLabel>Last thing it did</SectionLabel>
              <div className="rounded-3xl bg-muted p-4">
                {a.lastAction ? (
                  <>
                    <p className="text-base font-bold">{a.lastAction.text}</p>
                    <p className="text-sm text-muted-foreground">Why: {a.lastAction.reason}</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Waiting for your first sign.</p>
                )}
              </div>
            </section>

            <section>
              <div className="flex items-baseline justify-between px-1">
                <label id="thr" className="text-sm font-bold">When should it ask you?</label>
                <span className="text-sm font-bold">{Math.round(a.threshold * 100)}%</span>
              </div>
              <Slider aria-labelledby="thr" className="mt-3" min={0.4} max={0.95} step={0.05} value={[a.threshold]} onValueChange={([v]) => a.setThreshold(v ?? a.threshold)} />
              <p className="mt-2 px-1 text-sm text-muted-foreground">It asks “which sign did you mean?” when it’s less than {Math.round(a.threshold * 100)}% sure.</p>
            </section>

            <section>
              <SectionLabel>Caption text size</SectionLabel>
              <div className="flex items-center gap-3 rounded-full bg-muted px-4 py-3">
                <span aria-hidden className="text-xs font-bold">A</span>
                <Slider aria-label="Caption text size" className="flex-1" min={0.85} max={1.5} step={0.05} value={[a.textScale]} onValueChange={([v]) => a.setTextScale(v ?? a.textScale)} />
                <span aria-hidden className="text-xl font-bold">A</span>
              </div>
            </section>

            <section>
              <SectionLabel>Signs it has learned</SectionLabel>
              {a.corrections.length === 0 ? (
                <p className="px-1 text-sm text-muted-foreground">Fix a sign and it shows up here.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {a.corrections.map((c) => (
                    <li key={c.heard} className="rounded-full bg-muted px-4 py-2 text-sm">
                      <span className="line-through opacity-60">{c.heard.toLowerCase()}</span> → <b>{c.meant.toLowerCase()}</b>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** The agent asks by offering the likely words directly — one tap picks the right one. */
export function RepairCard({ onType }: { onType?: () => void }) {
  const { pending, resolveRepair, dismissTyping } = useSignify();
  // None of the guesses are right: open the keyboard straight away
  const typeInstead = () => { resolveRepair(null); if (onType) { dismissTyping(); onType(); } };
  if (!pending) return null;
  const options = [{ gloss: pending.gloss, confidence: pending.confidence }, ...(pending.alternatives ?? [])].slice(0, 2); // best guess + runner-up; "Type the right word" covers the rest
  return (
    <div role="alertdialog" aria-label="Signify Agent needs to confirm a sign" className="rounded-3xl bg-accent p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold"><AgentIcon mood="thinking" className="h-4 w-4" /> Which sign did you mean?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o, i) => (
          <button key={o.gloss} onClick={() => resolveRepair(o.gloss)}
            className={cn("flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-lg font-bold leading-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40",
              i === 0 ? "bg-primary" : "bg-background")}>
            {o.gloss.toLowerCase()}
            <span className="text-xs font-medium opacity-60">{Math.round(o.confidence * 100)}%</span>
          </button>
        ))}
      </div>
      <div className="mt-3">
        <button onClick={typeInstead}
          className="flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-background/60 px-3.5 text-sm font-semibold active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40">
          <Keyboard className="h-4 w-4" aria-hidden /> Type the right word
        </button>
      </div>
    </div>
  );
}

export function TypingSuggestion({ onType }: { onType: () => void }) {
  const { suggestTyping, dismissTyping } = useSignify();
  if (!suggestTyping) return null;
  return (
    <div role="status" className="flex items-center gap-3 rounded-3xl bg-muted p-3 pl-4">
      <p className="flex-1 text-sm font-semibold">Tricky signs today. Type instead?</p>
      <button onClick={() => { dismissTyping(); onType(); }} aria-label="Type instead" className="grid h-11 w-11 place-items-center rounded-full bg-primary"><Keyboard className="h-5 w-5" /></button>
      <button onClick={dismissTyping} aria-label="Keep signing" className="grid h-11 w-11 place-items-center rounded-full bg-background"><XIcon className="h-5 w-5" /></button>
    </div>
  );
}

/** Drag-handle style toggle for the transcript sheet. */
export function ExpandToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} aria-label={open ? "Collapse transcript" : "Expand full transcript"} aria-expanded={open}
      className="mx-auto flex h-8 w-full items-center justify-center focus-visible:outline-none">
      <span className="h-1.5 w-12 rounded-full bg-secondary" />
    </button>
  );
}
