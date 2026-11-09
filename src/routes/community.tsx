import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { TopBar, Avatar, TabBar } from "@/components/signify/ui";
import { cn } from "@/lib/utils";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/community")({
  head: () => seo("Community", "Events, groups and people in the Deaf and hearing community."),
  component: Community,
});

type Item = { title: string; meta: string; day?: string };
const TABS: Record<"Events" | "Groups" | "People", Item[]> = {
  Events: [
    { title: "ASL Coffee Meetup", meta: "Echo Park · 24 going", day: "SAT" },
    { title: "Deaf & Hearing Book Club", meta: "Silver Lake · 12 going", day: "THU" },
    { title: "Beginner ASL for Hearing Friends", meta: "Online · 40 going", day: "SUN" },
  ],
  Groups: [
    { title: "ASL Learners LA", meta: "1.2k members" },
    { title: "Deaf Parents Network", meta: "340 members" },
    { title: "Signing Gamers", meta: "88 members" },
  ],
  People: [
    { title: "Candace", meta: "Met at the café · learning ASL" },
    { title: "Jon Fischer", meta: "2 mutual friends" },
    { title: "Maya", meta: "Hosts ASL Coffee Meetup" },
  ],
};

function Community() {
  const [tab, setTab] = useState<keyof typeof TABS>("Events");
  const [joined, setJoined] = useState<Record<string, boolean>>({});
  return (
    <div className="flex flex-1 flex-col">
      <TopBar />
      <div className="px-6 pt-4"><h1 className="headline text-[40px]">Community</h1></div>
      <div role="tablist" aria-label="Community sections" className="mx-5 mt-4 grid grid-cols-3 rounded-full bg-muted p-1">
        {(Object.keys(TABS) as (keyof typeof TABS)[]).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn("min-h-10 rounded-full text-sm font-semibold transition-colors", tab === k ? "bg-background shadow-sm" : "text-muted-foreground")}>
            {k}
          </button>
        ))}
      </div>
      <ul role="tabpanel" className="mt-3 space-y-1 px-3 pb-4">
        {TABS[tab].map((e, i) => (
          <li key={e.title} className="flex items-center gap-3 rounded-3xl p-3">
            {e.day ? (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent text-xs font-bold">{e.day}</span>
            ) : <Avatar label={e.title} size={48} tone={i} />}
            <div className="min-w-0 flex-1">
              <p className="font-bold leading-tight">{e.title}</p>
              <p className="text-sm text-muted-foreground">{e.meta}</p>
            </div>
            <button aria-pressed={!!joined[e.title]} aria-label={`${joined[e.title] ? "Leave" : tab === "People" ? "Connect with" : "Join"} ${e.title}`}
              onClick={() => setJoined((j) => ({ ...j, [e.title]: !j[e.title] }))}
              className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40",
                joined[e.title] ? "bg-primary" : "bg-muted active:bg-secondary")}>
              {joined[e.title] ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            </button>
          </li>
        ))}
      </ul>
      <TabBar />
    </div>
  );
}
