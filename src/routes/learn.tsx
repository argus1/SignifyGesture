import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Play } from "lucide-react";
import { toast } from "sonner";
import { Pill } from "@/components/signify/ui";
import { SIGNS } from "@/lib/sample-data";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/learn")({
  head: () => seo("Learn the signs", "Practice the signs from your recent conversations."),
  component: Learn,
});

function Learn() {
  const nav = useNavigate();
  return (
    <div className="flex flex-1 flex-col">
      <div className="px-4 pt-4">
        <Link to="/memory" className="inline-flex min-h-11 items-center gap-1 rounded-full pr-3 text-sm font-medium hover:bg-muted">
          <ChevronLeft className="h-5 w-5" /> Recap
        </Link>
      </div>
      <div className="px-6 pt-2">
        <h1 className="headline text-[40px]">Coffee with the barista</h1>
        <p className="mt-2 text-sm text-muted-foreground">Today · 3 min · You ordered an iced oat latte.</p>
        <h2 className="mt-5 text-sm font-medium">Signs from this conversation</h2>
      </div>
      <ul className="grid grid-cols-2 gap-3 px-6 pt-3">
        {SIGNS.map((s) => (
          <li key={s}>
            <button className="w-full rounded-2xl border-2 border-foreground/15 p-2 text-left hover:bg-muted" onClick={() => toast(`Playing “${s}”`)}>
              <div className="grid aspect-square place-items-center rounded-xl bg-muted" aria-hidden><Play className="h-7 w-7" /></div>
              <p className="label-caps mt-2 px-1 text-[11px] font-semibold">{s}</p>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-auto grid gap-2 px-6 pt-6 pb-20">
        <Pill variant="mint" onClick={() => toast.success("Practice started — sign along!")}>Practice these signs</Pill>
        <Pill onClick={() => nav({ to: "/recap" })}>Replay conversation</Pill>
      </div>
    </div>
  );
}
