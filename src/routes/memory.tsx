import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { TopBar, TabBar, PageTitle } from "@/components/signify/ui";
import { AgentIcon } from "@/components/signify/AgentIcon";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/memory")({
  head: () => seo("Conversation memory", "Past conversation recaps and signs you're learning."),
  component: Memory,
});

// "where" = who or where it happened, which is how people remember a conversation
const RECAPS = [
  { title: "Coffee, sorted", when: "Today", where: "Blue Bottle Coffee", emoji: "☕" },
  { title: "Meeting Candace", when: "Today", where: "ASL meetup", emoji: "👋" },
  { title: "Call with Jon", when: "Yesterday", where: "Video call", emoji: "📞" },
  { title: "Book club", when: "Thu", where: "with Maya, Lee + 3 others", emoji: "📚" },
];

function Memory() {
  return (
    <div className="flex flex-1 flex-col">
      <TopBar />
      <PageTitle title="Memory" sub={<p className="flex items-center gap-2 text-lg font-bold"><AgentIcon className="h-6 w-6" /> Saved by Signify Agent</p>} />
      <ul className="mt-3 space-y-1 px-3 pb-4">
        {RECAPS.map((r) => (
          <li key={r.title}>
            <Link to="/learn" className="flex items-center gap-3 rounded-3xl p-3 active:bg-muted">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-muted text-xl" aria-hidden>{r.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-tight">{r.title}</p>
                <p className="text-sm text-muted-foreground">{r.when} · {r.where}</p>
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
