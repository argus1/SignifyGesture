import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { TopBar, Avatar, TabBar, PageTitle } from "@/components/signify/ui";
import { cn } from "@/lib/utils";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/community")({
  head: () => seo("Community", "Meetups and groups in the Deaf and hearing community."),
  component: Community,
});

type Item = { title: string; meta: string; day?: string; photo?: string; emoji?: string };
// One scrolling page, no tabs: what's happening this week, then groups. (People live in Messages.)
const SECTIONS: { label: string; items: Item[] }[] = [
  { label: "This week", items: [
    // photo: drop a real image in /public/community/ and set the path here (e.g. "/community/coffee.jpg")
    { title: "ASL Coffee Meetup", meta: "Echo Park · 24 going", day: "SAT", emoji: "☕" },
    { title: "Deaf & Hearing Book Club", meta: "Silver Lake · 12 going", day: "THU", emoji: "📚" },
    { title: "Beginner ASL for Hearing Friends", meta: "Online · 40 going", day: "SUN", emoji: "👋" },
  ] },
  { label: "Groups", items: [
    { title: "ASL Learners LA", meta: "1.2k members" },
    { title: "Deaf Parents Network", meta: "340 members" },
    { title: "Signing Gamers", meta: "88 members" },
  ] },
];

const EVENTS = SECTIONS.find((x) => x.label === "This week")!.items;

function Community() {
  const [joined, setJoined] = useState<Record<string, boolean>>({});
  return (
    <div className="flex flex-1 flex-col">
      <TopBar />
      <PageTitle title="Community" />
      {/* This week: big photo cards you swipe through */}
      <section className="mt-5">
        <h2 className="px-6 text-sm font-bold text-muted-foreground">This week</h2>
        <ul className="mt-2 flex snap-x snap-mandatory scroll-px-6 gap-3 overflow-x-auto px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {EVENTS.map((e) => {
            const on = !!joined[e.title];
            return (
              <li key={e.title} className="w-[78%] shrink-0 snap-start">
                <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-accent">
                  {e.photo ? (
                    <img src={e.photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div aria-hidden className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_30%_25%,#b9ffe6,transparent_55%),radial-gradient(circle_at_75%_80%,#7df5cc,transparent_50%)] text-5xl">{e.emoji}</div>
                  )}
                  <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-bold backdrop-blur">{e.day}</span>
                  <button aria-pressed={on} aria-label={`${on ? "Undo" : "Going to"} ${e.title}`}
                    onClick={() => setJoined((j) => ({ ...j, [e.title]: !j[e.title] }))}
                    className={cn("absolute bottom-3 right-3 grid h-11 w-11 place-items-center rounded-full shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40",
                      on ? "bg-primary" : "bg-background/90 backdrop-blur active:bg-background")}>
                    {on ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                  </button>
                </div>
                <p className="mt-2 px-1 font-bold leading-tight">{e.title}</p>
                <p className="px-1 text-sm text-muted-foreground">{e.meta}</p>
              </li>
            );
          })}
        </ul>
      </section>

      {SECTIONS.filter((sec) => sec.label !== "This week").map((sec) => (
        <section key={sec.label} className="mt-5 px-3">
          <h2 className="px-3 text-sm font-bold text-muted-foreground">{sec.label}</h2>
          <ul className="mt-1 space-y-1">
            {sec.items.map((e, i) => {
              const on = !!joined[e.title];
              const verb = e.day ? "Going to" : "Join";
              return (
                <li key={e.title} className="flex items-center gap-3 rounded-3xl p-3">
                  {e.day ? (
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent text-xs font-bold">{e.day}</span>
                  ) : <Avatar label={e.title} size={48} tone={i} />}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold leading-tight">{e.title}</p>
                    <p className="text-sm text-muted-foreground">{e.meta}</p>
                  </div>
                  <button aria-pressed={on} aria-label={`${on ? "Undo" : verb} ${e.title}`}
                    onClick={() => setJoined((j) => ({ ...j, [e.title]: !j[e.title] }))}
                    className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40",
                      on ? "bg-primary" : "bg-muted active:bg-secondary")}>
                    {on ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <div className="flex-1" />
      <TabBar />
    </div>
  );
}
