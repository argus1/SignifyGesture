import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useSignify } from "@/lib/signify-store";
import { TopBar, Pill } from "@/components/signify/ui";
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
  const last = [...s.captions].reverse().find((c) => c.speaker === "other");
  return (
    <div className="flex flex-1 flex-col">
      <TopBar back="/speak" />
      <div className="flex justify-end gap-2 px-6">
        <Pill size="sm" aria-label="Smaller text" onClick={() => setSize((x) => Math.max(28, x - 6))}>A−</Pill>
        <Pill size="sm" aria-label="Larger text" onClick={() => setSize((x) => Math.min(72, x + 6))}>A+</Pill>
      </div>
      <div aria-live="polite" className="flex-1 px-6 pt-6">
        {s.pending ? (
          <p className="flex items-center gap-3 text-2xl font-bold"><Loader2 className="h-7 w-7 animate-spin" /> One moment — confirming a sign…</p>
        ) : (
          <p className="font-bold leading-[1.05]" style={{ fontSize: size }}>{last?.text ?? "Sure! What size would you like?"}</p>
        )}
      </div>
      <div className="grid gap-2 px-6 pb-20">
        <div className="flex flex-wrap gap-2">
          {["Medium, please", "Thank you!", "Can you repeat?"].map((q) => (
            <Pill key={q} size="sm" variant="ghost" onClick={() => s.onSentenceTranslated({ text: q })}>{q}</Pill>
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
