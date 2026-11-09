import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { TopBar, Headline, Avatar, Pill } from "@/components/signify/ui";
import { THREADS } from "@/lib/sample-data";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/messages")({
  head: () => seo("Messages", "Captioned sign video messages with friends."),
  component: Messages,
});

function Messages() {
  const [q, setQ] = useState("");
  const list = THREADS.filter((t) => `${t.name} ${t.preview}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex flex-1 flex-col">
      <TopBar back="/home" />
      <div className="px-6 pt-4"><Headline dark="Messages" /></div>
      <div className="relative mx-6 mt-4">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <label htmlFor="msg-search" className="sr-only">Search people or messages</label>
        <input id="msg-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people or messages"
          className="h-11 w-full rounded-full bg-muted pl-10 pr-4 text-sm outline-none focus-visible:ring-4 focus-visible:ring-ring/40" />
      </div>
      <ul className="mt-3 flex-1 px-4">
        {list.map((t, i) => (
          <li key={t.id}>
            <Link to="/messages/$id" params={{ id: t.id }} className="flex items-center gap-3 rounded-2xl p-3 hover:bg-muted">
              <Avatar label={t.name} size={52} tone={i} />
              <div className="min-w-0 flex-1">
                <p className="flex justify-between gap-2 text-lg font-bold"><span className="truncate">{t.name}</span><span className="shrink-0 text-sm font-normal text-muted-foreground">{t.time}</span></p>
                <p className="truncate text-muted-foreground">{t.preview}</p>
              </div>
              {t.unread && <span className="h-3 w-3 shrink-0 rounded-full bg-primary ring-2 ring-foreground"><span className="sr-only">Unread</span></span>}
            </Link>
          </li>
        ))}
      </ul>
      <div className="px-6 pb-20 pt-4"><Pill variant="mint" className="w-full" onClick={() => toast("New message — coming soon")}>New message</Pill></div>
    </div>
  );
}
