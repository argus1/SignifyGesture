import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { Bot, ChevronRight, Coffee, Hand, Phone, BookOpen, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Header,
  TabBar,
  PageTitle,
  Eyebrow,
  Tag,
  Screen,
  press,
  DUR,
  EASE,
} from "@/components/signify/ui";
import { cn } from "@/lib/utils";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/memory")({
  validateSearch: (search: Record<string, unknown>): { fresh?: boolean } =>
    search["fresh"] ? { fresh: true } : {},
  head: () => seo("Memory", "Every conversation, saved by the Signify Agent."),
  component: Memory,
});

const RECAPS: {
  id: string;
  title: string;
  when: string;
  where: string;
  icon: LucideIcon;
  signs?: number;
}[] = [
  {
    id: "coffee",
    title: "Coffee, sorted",
    when: "Today",
    where: "Blue Bottle Coffee",
    icon: Coffee,
    signs: 6,
  },
  {
    id: "candace",
    title: "Meeting Candace",
    when: "Today",
    where: "ASL meetup",
    icon: Hand,
    signs: 4,
  },
  { id: "jon", title: "Call with Jon", when: "Yesterday", where: "Video call", icon: Phone },
  {
    id: "book",
    title: "Book club",
    when: "Thu",
    where: "with Maya, Lee + 3 others",
    icon: BookOpen,
  },
];

/**
 * 12 Memory. Coming from ✕ on a conversation (?fresh), the newest row slides in at the top with a
 * one-time #F2F2F2 highlight: the agent just saved it.
 */
function Memory() {
  const { fresh } = Route.useSearch();
  const reduce = useReducedMotion();
  return (
    <Screen kind={fresh ? "fade" : "tab"}>
      <Header />
      <PageTitle title="Memory" sub={<Eyebrow icon={Bot}>Saved by Signify Agent</Eyebrow>} />
      <ul className="mt-[22px] space-y-3 px-5 pb-4">
        {RECAPS.map((r, i) => {
          const first = i === 0;
          const row = (
            <>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-card dark:border-0">
                <r.icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  {first ? (
                    <motion.span
                      layoutId="recap-title"
                      className="truncate text-[16px] font-medium"
                    >
                      {r.title}
                    </motion.span>
                  ) : (
                    <span className="truncate text-[16px] font-medium">{r.title}</span>
                  )}
                  {r.signs && <Tag>{r.signs} signs</Tag>}
                </span>
                <span className="block truncate text-[13px] text-ink-2">
                  {r.when} · {r.where}
                </span>
              </span>
              <ChevronRight className="h-2.5 w-2.5 shrink-0 text-chevron" aria-hidden />
            </>
          );
          const cls = cn(
            "flex h-[68px] items-center gap-[14px] rounded-full pl-2.5 pr-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            first ? "border-[0.5px] border-line-strong bg-surface" : "border border-line bg-card",
          );
          return (
            <motion.li
              key={r.id}
              initial={
                fresh && first && !reduce
                  ? { opacity: 0, y: -16, backgroundColor: "var(--surface)" }
                  : false
              }
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR.slow, ease: EASE, delay: 0.15 }}
            >
              {first ? (
                <motion.div {...press}>
                  <Link to="/recap" className={cls}>
                    {row}
                  </Link>
                </motion.div>
              ) : (
                <motion.button
                  {...press}
                  onClick={() => toast(`${r.title}: recap coming soon`)}
                  className={cn(cls, "w-full text-left")}
                >
                  {row}
                </motion.button>
              )}
            </motion.li>
          );
        })}
      </ul>
      <TabBar />
    </Screen>
  );
}
