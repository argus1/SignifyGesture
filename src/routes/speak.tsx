import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, X } from "lucide-react";
import { toast } from "sonner";
import { useSignify } from "@/lib/signify-store";
import { Pill, StatusPill } from "@/components/signify/ui";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/speak")({
  head: () => seo("I speak", "Your speech becomes a live transcript for the Deaf person."),
  component: Speak,
});

const LINE = "Hi! What can I get started for you?".split(" ");

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
      <div className="flex items-center justify-between px-5 pt-5">
        <StatusPill dot={on ? "bg-foreground" : "bg-muted-foreground"}>{on ? "Listening…" : "Mic paused"}</StatusPill>
        <Link to="/translate" aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full border-2 border-foreground">
          <X className="h-5 w-5" />
        </Link>
      </div>
      <div className="grid place-items-center pt-10">
        <button onClick={() => setOn(!on)} aria-pressed={on} aria-label={on ? "Pause microphone" : "Resume microphone"}
          className="grid h-28 w-28 place-items-center rounded-full border-2 border-foreground/30 bg-muted">
          {on ? <Mic className="h-9 w-9" /> : <MicOff className="h-9 w-9" />}
        </button>
        <div aria-hidden className="mt-4 flex h-8 items-center gap-1">
          {[10, 22, 14, 30, 18, 26, 12, 20, 8].map((h, i) => (
            <span key={i} className={on ? "w-1 rounded-full bg-soft-headline animate-pulse" : "w-1 rounded-full bg-muted"} style={{ height: h, animationDelay: `${i * 90}ms` }} />
          ))}
        </div>
      </div>
      <div className="flex-1 px-6 pt-8">
        <p aria-live="polite" className="headline text-[34px] leading-[1.05]">
          {heard.map((w, i) => <span key={i} className={i >= n - 3 && n < LINE.length ? "text-soft-headline" : ""}>{w} </span>)}
          {n === 0 && <span className="text-soft-headline">Start talking…</span>}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">Live transcript — gray words are still being heard.</p>
      </div>
      <div className="grid gap-2 px-6 pb-20">
        <Pill variant="mint" onClick={() => nav({ to: "/captions" })}>Show to Deaf person</Pill>
        <Pill onClick={() => toast.success("Sent to their phone")}>Send to their phone</Pill>
      </div>
    </div>
  );
}
