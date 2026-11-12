import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { Header, Avatar, TabBar, PageTitle, Eyebrow, Screen, press } from "@/components/signify/ui";
import { cn } from "@/lib/utils";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/community")({
  head: () => seo("Community", "Meetups and groups in the Deaf and hearing community."),
  component: Community,
});

const EVENTS = [
  { title: "ASL Coffee Meetup", meta: "Echo Park · 24 going", day: "Sat", art: "coffee" as const },
  {
    title: "Deaf & Hearing Book Club",
    meta: "Silver Lake · 12 going",
    day: "Thu",
    art: "wave" as const,
  },
  {
    title: "Beginner ASL for Hearing Friends",
    meta: "Online · 40 going",
    day: "Sun",
    art: "hand" as const,
  },
];
const GROUPS = [
  { title: "ASL Learners LA", meta: "1.2k members" },
  { title: "Deaf Parents Network", meta: "340 members" },
  { title: "Signing Gamers", meta: "88 members" },
];

/** 15 Community: this week's events (swipe), then groups. */
function Community() {
  const [joined, setJoined] = useState<Record<string, boolean>>({});
  const toggle = (title: string, verb: string) =>
    setJoined((j) => {
      const on = !j[title];
      toast(on ? `${verb} ${title}` : `Left ${title}`);
      return { ...j, [title]: on };
    });
  return (
    <Screen kind="tab">
      <Header />
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        <PageTitle title="Community" helpFocusId="help-destination-community" />
        <Eyebrow className="mt-[43px] px-5">This week</Eyebrow>
        <ul className="mt-[9px] flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {EVENTS.map((e) => {
            const on = !!joined[e.title];
            return (
              <li key={e.title} className="w-[260px] shrink-0 snap-start">
                <div className="relative h-[170px] rounded-[24px] border-[0.5px] border-line-strong bg-surface">
                  <span className="absolute left-4 top-4 grid h-6 w-12 place-items-center rounded-full bg-card font-label text-[11px] font-semibold uppercase">
                    {e.day}
                  </span>
                  <div aria-hidden className="grid h-full place-items-center">
                    {e.art === "coffee" ? (
                      <span className="text-[48px] leading-none">☕</span>
                    ) : e.art === "wave" ? (
                      <MiniWave />
                    ) : (
                      <span className="text-[44px] leading-none">👋</span>
                    )}
                  </div>
                  <motion.button
                    {...press}
                    aria-pressed={on}
                    aria-label={`${on ? "Undo going to" : "Going to"} ${e.title}`}
                    onClick={() => toggle(e.title, "Going to")}
                    className={cn(
                      "absolute bottom-[16px] right-[16px] grid h-9 w-9 place-items-center rounded-full border-[0.5px] border-line-icon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      "before:absolute before:-inset-1 before:content-['']",
                      on ? "border-2 border-primary bg-surface" : "bg-card",
                    )}
                  >
                    {on ? (
                      <Check className="h-[11px] w-[11px]" aria-hidden />
                    ) : (
                      <Plus className="h-[11px] w-[11px]" aria-hidden />
                    )}
                  </motion.button>
                </div>
                <p className="mt-3 text-[16px] font-medium">{e.title}</p>
                <p className="text-[13px] text-ink-2">{e.meta}</p>
              </li>
            );
          })}
        </ul>

        <Eyebrow className="mt-[30px] px-5">Groups</Eyebrow>
        <ul className="mt-[9px] px-5 pb-4">
          {GROUPS.map((g) => {
            const on = !!joined[g.title];
            return (
              <li key={g.title} className="flex h-[70px] items-center gap-4">
                <Avatar label={g.title} />
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-medium">{g.title}</p>
                  <p className="text-[13px] text-ink-2">{g.meta}</p>
                </div>
                <motion.button
                  {...press}
                  aria-pressed={on}
                  aria-label={`${on ? "Leave" : "Join"} ${g.title}`}
                  onClick={() => toggle(g.title, "Joined")}
                  className="grid h-11 w-11 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span
                    className={cn(
                      "grid h-[33px] w-[33px] place-items-center rounded-full",
                      on
                        ? "border-2 border-primary bg-surface"
                        : "border-[0.5px] border-line-icon bg-card dark:border-0",
                    )}
                  >
                    {on ? (
                      <Check className="h-[11px] w-[11px]" aria-hidden />
                    ) : (
                      <Plus className="h-[9px] w-[9px]" aria-hidden />
                    )}
                  </span>
                </motion.button>
              </li>
            );
          })}
        </ul>
      </div>
      <TabBar />
    </Screen>
  );
}

function MiniWave() {
  return (
    <span className="flex h-8 items-center gap-1">
      {[10, 18, 26, 14, 30, 20, 12, 24, 16].map((h, i) => (
        <span key={i} className="w-1 rounded-full bg-primary" style={{ height: h }} />
      ))}
    </span>
  );
}
