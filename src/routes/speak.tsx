import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, X, Smartphone, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useSignify } from "@/lib/signify-store";
import { IconButton, Pill, StatusPill } from "@/components/signify/ui";
import { cn } from "@/lib/utils";
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
      <div className="flex items-center justify-between px-4 pt-4">
        <StatusPill dot={on ? "bg-primary" : "bg-muted-foreground"}>{on ? "Listening" : "Paused"}</StatusPill>
        <IconButton icon={X} label="Close" size={44} onClick={() => nav({ to: "/home" })} />
      </div>
      <div className="flex-1 px-6 pt-10">
        <p aria-live="polite" className="headline text-[38px] leading-[1.05]">
          {heard.map((w, i) => <span key={i} className={i >= n - 3 && n < LINE.length ? "text-soft-headline" : ""}>{w} </span>)}
          {n === 0 && <span className="text-soft-headline">Start talking…</span>}
        </p>
      </div>
      <div className="grid place-items-center pb-6">
        <button onClick={() => setOn(!on)} aria-pressed={on} aria-label={on ? "Pause microphone" : "Resume microphone"}
          className={cn("relative grid h-24 w-24 place-items-center rounded-full transition-colors", on ? "bg-primary" : "bg-muted")}>
          {on && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-primary/40" />}
          {on ? <Mic className="relative h-9 w-9" /> : <MicOff className="h-9 w-9" />}
        </button>
      </div>
      <div className="flex items-center gap-3 px-5 pb-6">
        <Pill variant="mint" className="flex-1 bg-foreground text-background" onClick={() => nav({ to: "/captions" })}>
          Show to Sam <ArrowRight className="h-5 w-5" />
        </Pill>
        <IconButton icon={Smartphone} label="Send captions to their phone" size={56} onClick={() => toast.success("Captions sent to Sam's phone")} />
      </div>
    </div>
  );
}
