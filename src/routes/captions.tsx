import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUpDown, Loader2, Keyboard, X, Send, ALargeSmall } from "lucide-react";
import { SmallHandIcon } from "@/components/signify/icons";
import { useSignify } from "@/lib/signify-store";
import { IconButton, StatusPill } from "@/components/signify/ui";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/captions")({
  head: () => seo("Shared captions", "Huge captions facing the Deaf person, with quick replies."),
  component: Captions,
});

const SIZES = [36, 48, 60];
const REPLIES = ["Iced oat latte", "One moment", "Thank you!"];

function Captions() {
  const s = useSignify();
  const nav = useNavigate();
  const [size, setSize] = useState(1);
  const [flipped, setFlipped] = useState(false);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const last = [...s.captions].reverse().find((c) => c.speaker === "other");
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 px-4 pt-4">
        <StatusPill>Barista is speaking</StatusPill>
        <div className="ml-auto flex gap-2">
          <IconButton icon={ALargeSmall} label="Change text size" size={44} onClick={() => setSize((x) => (x + 1) % SIZES.length)} />
          <IconButton icon={ArrowUpDown} label="Flip to face the other person" size={44} aria-pressed={flipped} onClick={() => setFlipped(!flipped)} />
          <IconButton icon={X} label="Close" size={44} onClick={() => nav({ to: "/home" })} />
        </div>
      </div>
      <div aria-live="polite" className="flex-1 px-6 pt-8 transition-transform" style={{ transform: flipped ? "rotate(180deg)" : undefined }}>
        {s.pending ? (
          <p className="flex items-center gap-3 text-2xl font-bold"><Loader2 className="h-7 w-7 animate-spin" /> One moment, confirming a sign…</p>
        ) : (
          <p className="headline leading-[1.02]" style={{ fontSize: SIZES[size] }}>{last?.text ?? "Hi! What can I get started for you?"}</p>
        )}
      </div>
      <div className="px-5 pb-6">
        <div className="flex gap-2 overflow-x-auto pb-3" aria-label="Quick replies">
          {REPLIES.map((q) => (
            <button key={q} onClick={() => s.say(q)}
              className="shrink-0 rounded-2xl bg-muted px-4 py-3 text-base font-semibold active:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40">
              {q}
            </button>
          ))}
        </div>
        {typing ? (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { s.say(draft.trim(), "sam", { typed: true }); setDraft(""); setTyping(false); } }}>
            <label htmlFor="reply" className="sr-only">Type a reply</label>
            <input id="reply" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a reply…"
              className="h-14 min-w-0 flex-1 rounded-full bg-muted px-5 text-lg outline-none focus-visible:ring-4 focus-visible:ring-ring/40" />
            <IconButton icon={Send} label="Send" tone="mint" size={56} type="submit" />
          </form>
        ) : (
          <div className="flex items-center gap-3">
            <button onClick={() => nav({ to: "/sign" })}
              className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40">
              <SmallHandIcon className="h-5 w-auto" aria-hidden /> Sign back
            </button>
            <IconButton icon={Keyboard} label="Type a reply" size={56} onClick={() => setTyping(true)} />
          </div>
        )}
      </div>
    </div>
  );
}
