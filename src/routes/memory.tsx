import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { TopBar, TabBar, AgentLabel } from "@/components/signify/ui";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/memory")({
  head: () => seo("Conversation memory", "Past conversation recaps and signs you're learning."),
  component: Memory,
});

const RECAPS = [
  { title: "Coffee with the barista", when: "Today", signs: 6, emoji: "☕" },
  { title: "Meeting Candace", when: "Today", signs: 4, emoji: "👋" },
  { title: "Call with Jon", when: "Yesterday", signs: 2, emoji: "📞" },
  { title: "Book club", when: "Thu", signs: 9, emoji: "📚" },
];

function Memory() {
  return (
    <div className="flex flex-1 flex-col">
      <TopBar />
      <div className="px-6 pt-4">
        <AgentLabel>Saved by Signify Agent</AgentLabel>
        <h1 className="headline mt-1 text-[40px]">Memory</h1>
      </div>
      <section className="mx-5 mt-4 rounded-3xl bg-foreground p-5 text-background">
        <p className="text-sm opacity-70">This week</p>
        <p className="mt-1 text-2xl font-bold">12 <span className="opacity-50">/ 20 signs learned</span></p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-background/20" role="progressbar" aria-valuenow={12} aria-valuemax={20} aria-label="Signs learned this week">
          <div className="h-full w-[60%] rounded-full bg-primary" />
        </div>
      </section>
      <ul className="mt-3 space-y-1 px-3 pb-4">
        {RECAPS.map((r) => (
          <li key={r.title}>
            <Link to="/learn" className="flex items-center gap-3 rounded-3xl p-3 active:bg-muted">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-muted text-xl" aria-hidden>{r.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-tight">{r.title}</p>
                <p className="text-sm text-muted-foreground">{r.when} · {r.signs} new signs</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <TabBar />
    </div>
  );
}
