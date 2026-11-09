import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { X, Volume2, VolumeX } from "lucide-react";
import { useSignify } from "@/lib/signify-store";
import { Pill } from "@/components/signify/ui";
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
      <div className="relative flex-1 min-h-[300px]">
        <div className="absolute inset-4 grid place-items-center rounded-3xl border-2 border-dashed border-foreground/40">
          <span className="label-caps text-[11px] text-muted-foreground">Camera · your hands</span>
          {["left-0 top-0 border-l-4 border-t-4", "right-0 top-0 border-r-4 border-t-4", "left-0 bottom-0 border-l-4 border-b-4", "right-0 bottom-0 border-r-4 border-b-4"].map((c) => (
            <span key={c} aria-hidden className={cn("absolute h-8 w-8 rounded-sm border-foreground", c)} />
          ))}
        </div>
        <div className="absolute left-6 right-6 top-6 flex items-center justify-between gap-2">
          <span role="status" className={cn("label-caps inline-flex items-center gap-2 rounded-full px-3 py-2 text-[10px] font-semibold",
            s.tracking === "lost" ? "bg-warning" : "bg-foreground text-background")}>
            <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", s.tracking === "lost" ? "bg-foreground" : "bg-primary")} />
            Live · {status}
          </span>
          <Link to="/translate" aria-label="Close live translation" className="grid h-11 w-11 place-items-center rounded-full border-2 border-foreground bg-background">
            <X className="h-5 w-5" />
          </Link>
        </div>
        <div className="absolute bottom-6 right-6"><AgentChip /></div>
      </div>

      <section aria-label="Live captions" className="rounded-t-[2rem] border-t-2 border-foreground bg-background px-5 pt-3 pb-20">
        <ExpandToggle open={open} onToggle={() => setOpen(!open)} />
        <div aria-live="polite" className={cn("mt-3 space-y-3 overflow-y-auto", open ? "max-h-[50dvh]" : "max-h-56")}>
          {shown.length === 0 && <p className="text-2xl text-muted-foreground">Start signing — your words appear here.</p>}
          {shown.map((c) => (
            <p key={c.id} className={cn("text-[26px] font-medium leading-tight", c.speaker === "sam" ? "text-mint-ink" : "text-foreground", !c.final && "opacity-70")}>
              <span className="sr-only">{c.speaker === "sam" ? "You: " : "Them: "}</span>{c.text}
            </p>
          ))}
        </div>
        <div className="mt-3 space-y-3">
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
            {QUICK.map((q) => <Pill key={q} size="sm" variant="ghost" onClick={() => s.onSentenceTranslated({ text: q })}>{q}</Pill>)}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Pill size="sm" onClick={() => s.setReadAloud(!s.readAloud)} aria-pressed={s.readAloud}>
              {s.readAloud ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} Read aloud: {s.readAloud ? "On" : "Off"}
            </Pill>
            <Pill size="sm" onClick={() => nav({ to: "/speak" })}>Switch to I speak</Pill>
          </div>
          {s.tts === "playing" && <p role="status" className="text-sm font-bold">🔊 Reading your words aloud…</p>}
          <Pill size="sm" variant="mint" className="w-full" onClick={() => nav({ to: "/recap" })}>End & recap</Pill>
        </div>
      </section>
    </div>
  );
}
