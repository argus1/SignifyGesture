import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";
import { TopBar, Headline, Pill, Avatar } from "@/components/signify/ui";
import { cn } from "@/lib/utils";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/community")({
  head: () => seo("Community", "Events, groups and people in the Deaf and hearing community."),
  component: Community,
});

type Item = { title: string; meta: string; cta: string };
const TABS: Record<"events" | "groups" | "people", Item[]> = {
  events: [
    { title: "ASL Coffee Meetup", meta: "Sat · Echo Park · 24 going", cta: "Join" },
    { title: "Deaf & Hearing Book Club", meta: "Thu · Silver Lake · 12 going", cta: "Join" },
    { title: "Beginner ASL for Hearing Friends", meta: "Sun · Online · 40 going", cta: "Join" },
  ],
  groups: [
    { title: "ASL Learners LA", meta: "1.2k members", cta: "Join" },
    { title: "Deaf Parents Network", meta: "340 members", cta: "Join" },
    { title: "Signing Gamers", meta: "88 members", cta: "Join" },
  ],
  people: [
    { title: "Candace", meta: "Met at the café · learning ASL", cta: "Add" },
    { title: "Jon Fischer", meta: "2 mutual friends", cta: "Add" },
    { title: "Maya", meta: "ASL Coffee Meetup host", cta: "Add" },
  ],
};
const NEW_CONNECTIONS = ["Candace", "Jon", "Maya", "Leo", "Priya"];

function Community() {
  const [tab, setTab] = useState<keyof typeof TABS>("events");
  const [joined, setJoined] = useState<Record<string, boolean>>({});
  return (
    <div className="flex flex-1 flex-col">
      <TopBar back="/home" />
      <div className="px-6 pt-4"><Headline dark="Community" /></div>
      <div role="tablist" aria-label="Community sections" className="mt-4 flex gap-2 px-6">
        {(Object.keys(TABS) as (keyof typeof TABS)[]).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn("label-caps min-h-9 rounded-full border-2 px-4 text-[10px] font-semibold",
              tab === k ? "border-foreground bg-foreground text-background" : "border-foreground/20")}>
            {k}
          </button>
        ))}
      </div>
      <ul role="tabpanel" className="mt-4 space-y-3 px-6">
        {TABS[tab].map((e, i) => (
          <li key={e.title} className="flex items-center gap-3 rounded-2xl border-2 border-foreground/15 p-3">
            <Avatar label={e.title} size={44} tone={i} />
            <div className="min-w-0 flex-1">
              <p className="font-bold leading-tight">{e.title}</p>
              <p className="text-xs text-muted-foreground">{e.meta}</p>
            </div>
            <Pill size="sm" aria-pressed={!!joined[e.title]} onClick={() => setJoined((j) => ({ ...j, [e.title]: !j[e.title] }))}>
              {joined[e.title] ? <><Check className="h-4 w-4" /> {e.cta === "Join" ? "Going" : "Added"}</> : e.cta}
            </Pill>
          </li>
        ))}
      </ul>
      <section className="px-6 pt-6 pb-20">
        <h2 className="text-sm text-muted-foreground">New connections</h2>
        <div className="mt-2 flex gap-2">
          {NEW_CONNECTIONS.map((n, i) => <Avatar key={n} label={n} size={44} tone={i} />)}
        </div>
      </section>
    </div>
  );
}
