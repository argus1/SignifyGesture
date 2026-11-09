import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUpDown, Loader2 } from "lucide-react";
import { useSignify } from "@/lib/signify-store";
import { Pill, StatusPill } from "@/components/signify/ui";
import { Input } from "@/components/ui/input";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/captions")({
  head: () => seo("Shared captions", "Huge captions facing the Deaf person, with quick replies."),
  component: Captions,
});

function Captions() {
  const s = useSignify();
  const nav = useNavigate();
  const [size, setSize] = useState(44);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [flipped, setFlipped] = useState(false);
  const last = [...s.captions].reverse().find((c) => c.speaker === "other");
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between px-5 pt-5">
        <StatusPill>From barista · Speaking</StatusPill>
        <button onClick={() => setFlipped(!flipped)} aria-pressed={flipped} aria-label="Flip screen to face the other person"
          className="grid h-11 w-11 place-items-center rounded-full border-2 border-foreground">
          <ArrowUpDown className="h-5 w-5" />
        </button>
      </div>
      <div aria-live="polite" className="flex-1 px-6 pt-6 transition-transform" style={{ transform: flipped ? "rotate(180deg)" : undefined }}>
        {s.pending ? (
          <p className="flex items-center gap-3 text-2xl font-bold"><Loader2 className="h-7 w-7 animate-spin" /> One moment — confirming a sign…</p>
        ) : (
          <p className="headline leading-[1.02]" style={{ fontSize: size }}>{last?.text ?? "Hi! What can I get started for you?"}</p>
        )}
        <div className="mt-4 flex gap-2">
          <Pill size="sm" aria-label="Smaller text" onClick={() => setSize((x) => Math.max(28, x - 6))}>A−</Pill>
          <Pill size="sm" aria-label="Larger text" onClick={() => setSize((x) => Math.min(72, x + 6))}>A+</Pill>
        </div>
      </div>
      <div className="grid gap-2 px-6 pb-20">
        <p className="text-sm text-muted-foreground">Sam, reply with:</p>
        <div className="flex flex-wrap gap-2">
          {["Iced oat latte", "One moment", "Thank you!"].map((q) => (
            <Pill key={q} size="sm" onClick={() => s.onSentenceTranslated({ text: q })}>{q}</Pill>
          ))}
        </div>
        {typing && (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { s.onSentenceTranslated({ text: draft.trim() }); setDraft(""); setTyping(false); } }}>
            <label htmlFor="reply" className="sr-only">Type a reply</label>
            <Input id="reply" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} className="h-12 rounded-full border-2 text-lg" />
            <Pill size="sm" variant="mint" type="submit">Send</Pill>
          </form>
        )}
        <Pill variant="mint" onClick={() => nav({ to: "/sign" })}>Sign back (camera)</Pill>
        <Pill onClick={() => setTyping(true)}>Type a reply</Pill>
      </div>
    </div>
  );
}
