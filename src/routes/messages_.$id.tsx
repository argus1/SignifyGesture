import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, Mic, Play, Video } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/signify/ui";
import { THREADS, type Msg } from "@/lib/sample-data";
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
  const [msgs, setMsgs] = useState<Msg[]>(t.messages);
  const [draft, setDraft] = useState("");
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-3 border-b-2 border-muted px-4 pt-4 pb-3">
        <Link to="/messages" aria-label="Back to messages" className="grid h-11 w-11 place-items-center rounded-full hover:bg-muted">
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <Avatar label={t.name} size={40} />
        <div className="min-w-0">
          <p className="truncate text-lg font-bold leading-tight">{t.name}</p>
          <p className="text-xs text-muted-foreground">{t.status}</p>
        </div>
      </header>
      <ul className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pt-5 pb-4">
        {msgs.map((m, i) => (
          <li key={i} className={cn("max-w-[78%]", m.me ? "self-end" : "self-start")}>
            {m.video ? (
              <div className="rounded-2xl border-2 border-foreground/15 p-2">
                <div className="grid aspect-[4/3] w-52 place-items-center rounded-xl bg-muted" role="img" aria-label="Signed video">
                  <span className="label-caps flex items-center gap-1 text-[10px] text-muted-foreground"><Play className="h-4 w-4" aria-hidden /> Signed video</span>
                </div>
                <p className="mt-2 px-1 text-sm"><span className="text-muted-foreground">Caption:</span> “{m.text}”</p>
              </div>
            ) : (
              <p className={cn("rounded-2xl border-2 px-4 py-2 text-base", m.me ? "border-foreground" : "border-foreground/15 bg-muted")}>{m.text}</p>
            )}
          </li>
        ))}
      </ul>
      <form className="flex items-center gap-2 px-4 pb-20 pt-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { setMsgs((x) => [...x, { me: true, text: draft.trim() }]); setDraft(""); } }}>
        <label htmlFor="compose" className="sr-only">Type, speak, or sign</label>
        <input id="compose" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type, speak, or sign…"
          className="h-11 min-w-0 flex-1 rounded-full bg-muted px-4 text-sm outline-none focus-visible:ring-4 focus-visible:ring-ring/40" />
        <button type="button" aria-label="Record a signed video" onClick={() => toast("Camera opens in the native app")} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-foreground"><Video className="h-4 w-4" /></button>
        <button type="button" aria-label="Speak a message" onClick={() => toast("Microphone opens in the native app")} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-foreground"><Mic className="h-4 w-4" /></button>
      </form>
    </div>
  );
}
