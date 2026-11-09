import { createFileRoute } from "@tanstack/react-router";
import { TopBar, Headline, PillLink } from "@/components/signify/ui";
import { Progress } from "@/components/ui/progress";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/memory")({
  head: () => seo("Conversation memory", "Past conversation recaps and signs you're learning."),
  component: Memory,
});

const RECAPS = [
  { title: "Café order", when: "Today", body: "Medium iced oat milk latte. 2 signs repaired." },
  { title: "Pharmacy", when: "Tue", body: "Picked up prescription, asked about dosage." },
  { title: "Book club intro", when: "Last week", body: "Met Priya and Leo, swapped numbers." },
];

function Memory() {
  return (
    <div className="flex flex-1 flex-col">
      <TopBar back="/home" />
      <div className="space-y-5 px-6 pt-4 pb-20">
        <Headline dark="Memory" soft="Your past chats." />
        <section className="rounded-3xl bg-accent p-5">
          <p className="text-lg font-bold">12 of 20 signs learned this week</p>
          <Progress value={60} className="mt-3 h-3" aria-label="12 of 20 signs learned" />
        </section>
        <ul className="space-y-3">
          {RECAPS.map((r) => (
            <li key={r.title} className="rounded-3xl border-2 border-foreground p-4">
              <p className="flex justify-between"><b className="text-lg">{r.title}</b><span className="text-muted-foreground">{r.when}</span></p>
              <p className="mt-1">{r.body}</p>
            </li>
          ))}
        </ul>
        <PillLink to="/learn" variant="mint" className="w-full">Learn the signs</PillLink>
      </div>
    </div>
  );
}
