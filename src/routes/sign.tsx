import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { X, Volume2, VolumeX } from "lucide-react";
import { useSignify } from "@/lib/signify-store";
import { Pill, StatusPill } from "@/components/signify/ui";
import { AgentChip, RepairCard, TypingSuggestion, ExpandToggle } from "@/components/signify/agent";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/sign")({
  head: () => seo("I sign · Live", "Live sign translation with captions and agent repair."),
  component: SignLive,
});

const QUICK = ["Medium, please", "Thank you!", "Can you repeat?"];

function SignLive() {
  const s = useSignify();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const shown = open ? s.captions : s.captions.slice(-3);
  const status = s.tracking === "lost" ? "Hands not visible" : s.pending ? "Checking a sign" : s.tracking === "tracking" ? "Signing detected" : "Waiting for hands";

  return (
    <div className="relative flex flex-1 flex-col bg-muted">
      {/* Camera area: transparent-ish so the native camera layer can render underneath. */}
      <div className="relative flex-1 min-h-[280px]">
        <div className="absolute inset-0 grid place-items-center">
          <span className="label-caps text-[11px] text-muted-foreground">Camera · your hands</span>
        </div>
        <div className="absolute left-5 right-5 top-5 flex items-center justify-between gap-2">
          <StatusPill dot={s.tracking === "lost" ? "bg-warning" : "bg-foreground"}>Live · {status}</StatusPill>
          <Link to="/recap" aria-label="End conversation and see recap" className="grid h-11 w-11 place-items-center rounded-full border-2 border-foreground bg-background">
            <X className="h-5 w-5" />
          </Link>
        </div>
        <div className="absolute bottom-8 right-5"><AgentChip /></div>
      </div>

      <section aria-label="Live captions" className="-mt-4 rounded-t-[2rem] bg-background px-5 pt-3 pb-20 shadow-[0_-8px_24px_rgba(0,0,0,0.06)]">
        <ExpandToggle open={open} onToggle={() => setOpen(!open)} />
        <div aria-live="polite" className={cn("mt-3 space-y-2 overflow-y-auto", open ? "max-h-[50dvh]" : "max-h-56")}>
          {shown.length === 0 && <p className="text-xl text-muted-foreground">Start signing — your words appear here.</p>}
          {shown.map((c) => (
            <p key={c.id} className={cn("text-[22px] font-medium leading-tight", c.speaker === "sam" ? "text-mint-ink" : "text-foreground", !c.final && "opacity-70")}>
              <span className="font-normal">{c.speaker === "sam" ? "You (signed): " : "Barista (spoken): "}</span>{c.text}
            </p>
          ))}
        </div>
        <div className="mt-3 space-y-3">
          <div className="flex gap-2">
            <Pill size="sm" className="whitespace-nowrap px-3 text-[10px]" onClick={() => s.setReadAloud(!s.readAloud)} aria-pressed={s.readAloud}>
              {s.readAloud ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} Read aloud: {s.readAloud ? "On" : "Off"}
            </Pill>
            <Pill size="sm" className="whitespace-nowrap px-3 text-[10px]" onClick={() => nav({ to: "/speak" })}>Switch to I speak</Pill>
          </div>
          <RepairCard />
          <TypingSuggestion onType={() => setTyping(true)} />
          {typing && (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { s.onSentenceTranslated({ text: draft.trim() }); setDraft(""); setTyping(false); } }}>
              <label htmlFor="typed" className="sr-only">Type your message</label>
              <Input id="typed" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type your message…" className="h-12 rounded-full border-2 text-lg" />
              <Pill size="sm" variant="mint" type="submit">Send</Pill>
            </form>
          )}
          <div className="flex flex-wrap gap-2">
            {QUICK.map((q) => <Pill key={q} size="sm" onClick={() => s.onSentenceTranslated({ text: q })}>{q}</Pill>)}
          </div>
          {s.tts === "playing" && <p role="status" className="text-sm font-bold">🔊 Reading your words aloud…</p>}
        </div>
      </section>
    </div>
  );
}
