import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, PenSquare } from "lucide-react";
import { toast } from "sonner";
import { TopBar, Avatar, TabBar, PageTitle } from "@/components/signify/ui";
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
      <TopBar />
      <PageTitle title="Messages" action={
        <button aria-label="New message" onClick={() => toast("New message coming soon")}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40">
          <PenSquare className="h-5 w-5" />
        </button>
      } />
      <div className="relative mx-5 mt-4">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <label htmlFor="msg-search" className="sr-only">Search</label>
        <input id="msg-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search"
          className="h-11 w-full rounded-full bg-muted pl-10 pr-4 text-sm outline-none focus-visible:ring-4 focus-visible:ring-ring/40" />
      </div>
      <ul className="mt-2 px-3 pb-4">
        {list.map((t, i) => (
          <li key={t.id}>
            <Link to="/messages/$id" params={{ id: t.id }} className="flex items-center gap-3 rounded-3xl p-3 active:bg-muted">
              <Avatar label={t.name} size={48} tone={i} />
              <div className="min-w-0 flex-1">
                <p className="flex justify-between gap-2"><span className="truncate font-bold">{t.name}</span><span className="shrink-0 text-xs text-muted-foreground">{t.time}</span></p>
                <p className={t.unread ? "truncate text-sm font-semibold" : "truncate text-sm text-muted-foreground"}>{t.preview}</p>
              </div>
              {t.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary"><span className="sr-only">Unread</span></span>}
            </Link>
          </li>
        ))}
      </ul>
      <TabBar />
    </div>
  );
}
