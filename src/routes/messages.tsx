import { createFileRoute, Link } from "@tanstack/react-router";
import { TopBar, Headline, Avatar } from "@/components/signify/ui";
import { THREADS } from "@/lib/sample-data";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/messages")({
  head: () => seo("Messages", "Captioned sign video messages with friends."),
  component: Messages,
});

function Messages() {
  return (
    <div className="flex flex-1 flex-col">
      <TopBar back="/home" />
      <div className="px-6 pt-4"><Headline dark="Messages" soft={`${THREADS.filter((t) => t.unread).length} new`} /></div>
      <ul className="mt-6 divide-y-2 divide-muted px-4 pb-20">
        {THREADS.map((t, i) => (
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
    </div>
  );
}
