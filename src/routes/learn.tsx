import { createFileRoute } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { TopBar, Headline, Pill } from "@/components/signify/ui";
import { SIGNS } from "@/lib/sample-data";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/learn")({
  head: () => seo("Learn the signs", "Practice the signs from your recent conversations."),
  component: Learn,
});

function Learn() {
  return (
    <div className="flex flex-1 flex-col">
      <TopBar back="/memory" />
      <div className="px-6 pt-4"><Headline dark="Learn" soft="the signs." /></div>
      <ul className="grid grid-cols-2 gap-3 px-6 pt-6">
        {SIGNS.map((s) => (
          <li key={s}>
            <button className="w-full rounded-3xl border-2 border-foreground p-3 text-left hover:bg-muted" onClick={() => toast(`Playing “${s}”`)}>
              <div className="grid aspect-square place-items-center rounded-2xl bg-muted" aria-hidden><Play className="h-8 w-8" /></div>
              <p className="label-caps mt-2 text-xs font-semibold">{s}</p>
            </button>
          </li>
        ))}
      </ul>
      <div className="px-6 pt-6 pb-20"><Pill variant="mint" className="w-full" onClick={() => toast.success("Practice started — sign along!")}>Practice these signs</Pill></div>
    </div>
  );
}
