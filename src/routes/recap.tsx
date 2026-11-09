import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, Play, Check, ChevronRight, type LucideIcon } from "lucide-react";
import { useSignify } from "@/lib/signify-store";
import { AgentIcon } from "@/components/signify/AgentIcon";
import { Pill } from "@/components/signify/ui";
import { cn } from "@/lib/utils";
import { seo } from "@/lib/seo";
import { syncSessionToAWS } from "@/services/awsSync";
import { triggerAvatarReplay } from "@/lib/nativeBridge";
import { SIGNS } from "@/lib/sample-data";
import { toast } from "sonner";

export const Route = createFileRoute("/recap")({
  head: () => seo("Conversation recap", "The Signify Agent sums up your conversation and next steps."),
  component: Recap,
});

const ACTIONS: { id: string; title: string; icon: LucideIcon; nav?: string }[] = [
  { id: "mem", title: "Save to memory", icon: BookOpen },
];

function Recap() {
  const s = useSignify();
  const nav = useNavigate();
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => { s.setStep("recap"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const finish = () => { s.reset(); nav({ to: "/home" }); };
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col px-6 pt-8 pb-6">
        <p className="flex items-center gap-2 text-lg font-bold"><AgentIcon className="h-6 w-6" /> Signify Agent Recap</p>
        <h1 className="headline mt-2 text-[40px]">Coffee, sorted ☕</h1>
        <p className="mt-3 text-lg leading-snug text-muted-foreground">You ordered a medium iced oat milk latte.</p>

        {/* New signs: one soft mint card, tap a tile to watch the sign */}
        <section className="mt-6 rounded-[1.75rem] bg-accent p-4" aria-label={`${SIGNS.length} new signs`}>
          <p className="px-1 text-lg font-black">{SIGNS.length} new signs</p>
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {SIGNS.map((w) => (
              <li key={w}>
                <button onClick={() => { triggerAvatarReplay([w.toUpperCase()]); toast(`Playing “${w}”`); }} aria-label={`Play the sign for ${w}`}
                  className="flex w-full flex-col items-center gap-1.5 rounded-2xl bg-background px-1 py-3 transition-transform active:scale-95">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-primary"><Play className="h-3.5 w-3.5 fill-current" aria-hidden /></span>
                  <span className="text-sm font-semibold">{w}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <ul className="mt-4 mb-6 space-y-2">
          {ACTIONS.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => {
                  if (a.nav) { nav({ to: a.nav }); return; }
                  if (a.id === "mem" && !done["mem"]) void syncSessionToAWS({ captions: s.captions, corrections: s.corrections, savedAt: Date.now() });
                  setDone((x) => ({ ...x, [a.id]: !x[a.id] }));
                }}
                aria-pressed={a.nav ? undefined : !!done[a.id]}
                className="flex w-full items-center gap-3 rounded-3xl bg-muted/70 p-3 text-left active:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-background"><a.icon className="h-5 w-5" aria-hidden /></span>
                <span className="flex-1 font-semibold">{a.title}</span>
                {a.nav ? <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden /> : (
                  <span className={cn("grid h-7 w-7 place-items-center rounded-full border-2 transition-all duration-300", done[a.id] ? "check-pop border-primary bg-primary" : "border-foreground/20")}>
                    {done[a.id] && <Check className="check-draw h-4 w-4" strokeWidth={3} aria-hidden />}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <Pill variant="mint" className="mt-auto w-full" onClick={finish}>Done</Pill>
      </div>
    </div>
  );
}
