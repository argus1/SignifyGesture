import { createFileRoute } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { SmallHandIcon } from "@/components/signify/icons";
import { toast } from "sonner";
import { TopBar, Pill } from "@/components/signify/ui";
import { SIGNS } from "@/lib/sample-data";
import { triggerAvatarReplay } from "@/lib/nativeBridge";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/learn")({
  head: () => seo("Learn the signs", "Practice the signs from your recent conversations."),
  component: Learn,
});

function Learn() {
  return (
    <div className="flex flex-1 flex-col">
      <TopBar back="/memory" />
      <div className="px-6 pt-2">
        <h1 className="headline text-[36px]">Coffee, sorted ☕</h1>
      </div>
      <ul className="grid grid-cols-2 gap-3 px-5 pt-5">
        {SIGNS.map((s) => (
          <li key={s}>
            <button className="group relative w-full overflow-hidden rounded-3xl bg-muted text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
              onClick={() => { triggerAvatarReplay([s.toUpperCase()]); toast(`Playing “${s}”`); }} aria-label={`Play the sign for ${s}`}>
              <div className="grid aspect-square place-items-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-background/90 transition-transform group-active:scale-95"><Play className="h-5 w-5" aria-hidden /></span>
              </div>
              <p className="absolute bottom-3 left-4 font-bold">{s}</p>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-auto px-5 pt-6 pb-6">
        <Pill variant="mint" className="w-full" onClick={() => toast.success("Practice started. Sign along!")}><SmallHandIcon className="h-5 w-auto" aria-hidden /> Practice with camera</Pill>
      </div>
    </div>
  );
}
