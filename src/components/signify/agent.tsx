import { useState } from "react";
import { Bot, Undo2, Pencil, Pause, Play, ChevronUp, ChevronDown, Keyboard } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useSignify, type AgentStep } from "@/lib/signify-store";
import { Pill } from "./ui";
import { cn } from "@/lib/utils";

const STEPS: { id: AgentStep; label: string }[] = [
  { id: "translate", label: "Translate" },
  { id: "check", label: "Check" },
  { id: "repair", label: "Repair" },
  { id: "recap", label: "Recap" },
];

export function Pipeline() {
  const { step } = useSignify();
  return (
    <ol className="flex items-center gap-1" aria-label="Agent pipeline">
      {STEPS.map((s, i) => (
        <li key={s.id} className="flex items-center gap-1">
          <span
            aria-current={step === s.id ? "step" : undefined}
            className={cn("rounded-full border-2 px-2.5 py-1 text-xs font-bold", step === s.id ? "border-primary bg-primary" : "border-foreground/20 text-muted-foreground")}
          >
            {s.label}
          </span>
          {i < STEPS.length - 1 && <span aria-hidden className="text-muted-foreground">→</span>}
        </li>
      ))}
    </ol>
  );
}

export function AgentChip({ className }: { className?: string }) {
  const a = useSignify();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn("label-caps inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-foreground bg-background px-4 text-[11px]", className)}
        aria-label="Open Signify Agent controls"
      >
        <Bot className="h-4 w-4" /> Agent {a.paused ? "· paused" : `· ${a.step}`}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto max-h-[85dvh] max-w-[390px] overflow-y-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="headline text-3xl">Signify Agent</SheetTitle>
            <SheetDescription>See what the agent does and take control.</SheetDescription>
          </SheetHeader>
          <div className="space-y-5 px-4 pb-6">
            <Pipeline />
            <section className="rounded-2xl border-2 border-foreground p-4">
              <p className="label-caps text-[10px] text-muted-foreground">Last action</p>
              <p className="mt-1 text-lg font-bold">{a.lastAction?.text ?? "Waiting for signs"}</p>
              <p className="text-sm text-muted-foreground">Why: {a.lastAction?.reason ?? "—"}</p>
            </section>
            <div className="grid grid-cols-2 gap-2">
              <Pill size="sm" onClick={a.undo}><Undo2 className="h-4 w-4" /> Undo last fix</Pill>
              <Pill size="sm" onClick={() => a.setPaused(!a.paused)}>
                {a.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />} {a.paused ? "Resume agent" : "Pause agent"}
              </Pill>
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => { e.preventDefault(); if (text.trim()) { a.override(text.trim()); setText(""); } }}
            >
              <label htmlFor="override" className="sr-only">Override last caption</label>
              <Input id="override" value={text} onChange={(e) => setText(e.target.value)} placeholder="Override last caption…" className="h-11 rounded-full border-2" />
              <Pill size="sm" type="submit" variant="mint"><Pencil className="h-4 w-4" /> Set</Pill>
            </form>
            <div>
              <div className="flex justify-between text-sm font-bold">
                <label id="thr">Ask me when confidence is below</label>
                <span>{Math.round(a.threshold * 100)}%</span>
              </div>
              <Slider aria-labelledby="thr" className="mt-3" min={0.4} max={0.95} step={0.05} value={[a.threshold]} onValueChange={([v]) => a.setThreshold(v ?? a.threshold)} />
            </div>
            <section>
              <p className="label-caps text-[10px] text-muted-foreground">Learned corrections</p>
              {a.corrections.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">None yet. When you fix a sign, I'll remember it here.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {a.corrections.map((c) => (
                    <li key={c.heard} className="rounded-xl bg-muted px-3 py-2 text-sm">
                      <span className="line-through">{c.heard.toLowerCase()}</span> → <b>{c.meant.toLowerCase()}</b>
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

export function RepairCard() {
  const { pending, resolveRepair } = useSignify();
  const [showAll, setShowAll] = useState(false);
  if (!pending) return null;
  const alts = pending.alternatives ?? [];
  const top = alts[0];
  return (
    <div role="alertdialog" aria-label="Signify Agent needs to confirm a sign" className="rounded-3xl border-2 border-foreground bg-accent p-4">
      <p className="flex items-center gap-2 text-sm font-bold"><Bot className="h-4 w-4" /> Signify Agent</p>
      <p className="mt-1 text-xl font-bold leading-tight">Not sure about that sign. Did you mean “{pending.gloss.toLowerCase()}”?</p>
      <p className="mt-1 text-sm">
        {Math.round(pending.confidence * 100)}% confident{top && ` · could also be “${top.gloss.toLowerCase()}” (${Math.round(top.confidence * 100)}%)`}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Pill variant="mint" onClick={() => resolveRepair(pending.gloss)}>Yes</Pill>
        <Pill onClick={() => setShowAll(true)}>No</Pill>
      </div>
      {showAll && (
        <div className="mt-2 grid gap-2">
          {alts.map((a) => (
            <Pill key={a.gloss} onClick={() => { setShowAll(false); resolveRepair(a.gloss); }}>
              {a.gloss} · {Math.round(a.confidence * 100)}%
            </Pill>
          ))}
          <Pill variant="ghost" onClick={() => { setShowAll(false); resolveRepair(null); }}><Keyboard className="h-4 w-4" /> Neither — let me type</Pill>
        </div>
      )}
      {!showAll && alts.length > 0 && (
        <button className="mt-2 text-sm font-bold underline" onClick={() => setShowAll(true)}>Show alternatives</button>
      )}
    </div>
  );
}

export function TypingSuggestion({ onType }: { onType: () => void }) {
  const { suggestTyping, dismissTyping } = useSignify();
  if (!suggestTyping) return null;
  return (
    <div role="status" className="rounded-3xl border-2 border-warning bg-background p-4">
      <p className="text-lg font-bold">This is tricky — switch to typing?</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Pill size="sm" variant="mint" onClick={() => { dismissTyping(); onType(); }}>Type instead</Pill>
        <Pill size="sm" onClick={dismissTyping}>Keep signing</Pill>
      </div>
    </div>
  );
}

export function ExpandToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} aria-label={open ? "Collapse transcript" : "Expand full transcript"} aria-expanded={open}
      className="mx-auto grid h-11 w-11 place-items-center rounded-full border-2 border-foreground">
      {open ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
    </button>
  );
}
