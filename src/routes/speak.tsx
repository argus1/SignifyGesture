import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { useSignify } from "@/lib/signify-store";
import { TopBar, Pill } from "@/components/signify/ui";
import { AgentChip } from "@/components/signify/agent";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/speak")({
  head: () => seo("I speak", "Your speech becomes a live transcript for the Deaf person."),
  component: Speak,
});

const LINE = "Sure! What size would you like — small, medium or large?".split(" ");

function Speak() {
  const s = useSignify();
  const nav = useNavigate();
  const [on, setOn] = useState(true);
  const [n, setN] = useState(0);
  const sent = useRef(false);
  useEffect(() => {
    if (!on || n >= LINE.length) return;
    const t = setTimeout(() => setN((x) => x + 1), 380);
    return () => clearTimeout(t);
  }, [on, n]);
  useEffect(() => {
    if (n === LINE.length && !sent.current) { sent.current = true; s.addCaption("other", LINE.join(" ")); }
  }, [n, s]);
  const heard = LINE.slice(0, n);
  return (
    <div className="flex flex-1 flex-col">
      <TopBar back="/translate" />
      <div className="flex items-center justify-between px-6 pt-4">
        <span role="status" className="label-caps text-[11px] font-semibold">{on ? "● Listening" : "Mic paused"}</span>
        <AgentChip />
      </div>
      <p aria-live="polite" className="flex-1 px-6 pt-6 text-[34px] font-bold leading-tight">
        {heard.map((w, i) => <span key={i} className={i >= n - 2 && n < LINE.length ? "text-soft-headline" : ""}>{w} </span>)}
        {n === 0 && <span className="text-muted-foreground">Start talking…</span>}
      </p>
      <div className="grid place-items-center py-4">
        <button onClick={() => setOn(!on)} aria-pressed={on} aria-label={on ? "Pause microphone" : "Resume microphone"}
          className="grid h-24 w-24 place-items-center rounded-full border-2 border-primary bg-primary">
          {on ? <Mic className="h-10 w-10" /> : <MicOff className="h-10 w-10" />}
        </button>
        <p className="mt-2 text-sm text-muted-foreground">Gray words = still hearing</p>
      </div>
      <div className="grid gap-2 px-6 pb-20">
        <Pill variant="mint" onClick={() => nav({ to: "/captions" })}>Show to Deaf person</Pill>
        <Pill onClick={() => toast.success("Sent to their phone")}>Send to their phone</Pill>
      </div>
    </div>
  );
}
