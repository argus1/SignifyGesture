import { createFileRoute, Link } from "@tanstack/react-router";
import { TopBar, AgentLabel } from "@/components/signify/ui";
import { Progress } from "@/components/ui/progress";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/memory")({
  head: () => seo("Conversation memory", "Past conversation recaps and signs you're learning."),
  component: Memory,
});

const RECAPS = [
  { title: "Coffee with the barista", meta: "Today · 6 new signs" },
  { title: "Meeting Candace", meta: "Today · 4 new signs" },
  { title: "Call with Jon", meta: "Yesterday · 2 new signs" },
  { title: "Book club", meta: "Thu · 9 new signs" },
];

function Memory() {
  return (
    <div className="flex flex-1 flex-col">
      <TopBar back="/home" />
      <div className="space-y-4 px-6 pt-6 pb-20">
        <div>
          <AgentLabel />
          <h1 className="headline mt-2 text-[40px]">Conversation memory</h1>
          <p className="mt-3 text-base leading-snug">Recaps of your past conversations — learn the signs that came up.</p>
        </div>
        <section className="rounded-2xl bg-muted p-4">
          <p className="font-bold">12 of 20 signs learned this week</p>
          <Progress value={60} className="mt-3 h-2" aria-label="12 of 20 signs learned" />
        </section>
        <ul className="space-y-3">
          {RECAPS.map((r) => (
            <li key={r.title} className="flex items-center gap-3 rounded-2xl border-2 border-foreground/15 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-tight">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.meta}</p>
              </div>
              <Link to="/learn" className="label-caps inline-flex min-h-11 items-center rounded-full border-2 border-foreground px-4 text-[11px] hover:bg-muted">Review</Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
