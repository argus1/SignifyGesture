import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  Header,
  HeaderIconButton,
  Avatar,
  TabBar,
  PageTitle,
  Screen,
} from "@/components/signify/ui";
import { THREADS } from "@/lib/sample-data";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/messages")({
  head: () => seo("Messages", "Captioned sign video messages with friends."),
  component: Messages,
});

/** 13 Messages. */
function Messages() {
  const [q, setQ] = useState("");
  const list = THREADS.filter((t) =>
    `${t.name} ${t.preview}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <Screen kind="tab">
      <Header
        right={
          <HeaderIconButton
            icon={Pencil}
            label="New message"
            onClick={() => toast("New message coming soon")}
          />
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        <PageTitle title="Messages" helpFocusId="help-destination-messages" />
        <div className="relative mx-5 mt-[39px]">
          <Search
            className="pointer-events-none absolute left-[23px] top-1/2 h-[11px] w-[11px] -translate-y-1/2 text-chevron"
            aria-hidden
          />
          <label htmlFor="msg-search" className="sr-only">
            Search people or messages
          </label>
          <input
            id="msg-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people or messages"
            className="h-12 w-full rounded-full border border-line bg-card pl-[46px] pr-4 text-[16px] outline-none placeholder:font-label placeholder:text-[11px] placeholder:uppercase placeholder:tracking-[0.12em] placeholder:text-ink-3 focus:border-primary"
          />
        </div>
        <ul className="mt-7 px-5 pb-4">
          {list.map((t) => (
            <li key={t.id}>
              <Link
                to="/messages/$id"
                params={{ id: t.id }}
                className="flex h-[76px] items-start gap-4 rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Avatar label={t.name} />
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[16px] font-medium">{t.name}</span>
                    <span className="t-label shrink-0 text-ink-3">{t.time}</span>
                  </p>
                  <p className="flex items-start justify-between gap-2">
                    <span className="truncate text-[14px] text-ink-4">{t.preview}</span>
                    {t.unread && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary">
                        <span className="sr-only">Unread</span>
                      </span>
                    )}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <TabBar />
    </Screen>
  );
}
