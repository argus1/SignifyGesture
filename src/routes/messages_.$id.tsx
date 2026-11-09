import { createFileRoute, notFound } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { TopBar, Headline } from "@/components/signify/ui";
import { THREADS } from "@/lib/sample-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages_/$id")({
  loader: ({ params }) => { const t = THREADS.find((x) => x.id === params.id); if (!t) throw notFound(); return t; },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Conversation"} · Signify` },
      { name: "description", content: "Captioned sign video conversation." },
      { property: "og:title", content: `${loaderData?.name ?? "Conversation"} · Signify` },
      { property: "og:description", content: "Captioned sign video conversation." },
    ],
  }),
  component: Thread,
});

function Thread() {
  const t = Route.useLoaderData();
  return (
    <div className="flex flex-1 flex-col">
      <TopBar back="/messages" />
      <div className="px-6 pt-2"><Headline dark={t.name} className="text-4xl" /></div>
      <ul className="flex flex-col gap-4 px-5 pt-6 pb-20">
        {t.messages.map((m, i) => (
          <li key={i} className={cn("max-w-[80%]", m.me ? "self-end" : "self-start")}>
            <div className="relative grid aspect-video w-56 place-items-center rounded-2xl bg-muted" role="img" aria-label="Sign video">
              <Play className="h-8 w-8" aria-hidden />
            </div>
            <p className={cn("mt-1 rounded-2xl px-4 py-2 text-lg font-medium", m.me ? "bg-primary" : "border-2 border-foreground")}>{m.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
