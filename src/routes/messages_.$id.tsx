import { createFileRoute, notFound } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Hand, Mic, Play, Video, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { HeaderIconButton, Screen, press, DUR, EASE } from "@/components/signify/ui";
import { THREADS, type Msg } from "@/lib/sample-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages_/$id")({
  loader: ({ params }) => {
    const t = THREADS.find((x) => x.id === params.id);
    if (!t) throw notFound();
    return t;
  },
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

/** 14 Chat. */
function Thread() {
  const t = Route.useLoaderData();
  const [msgs, setMsgs] = useState<Msg[]>(t.messages);
  const [draft, setDraft] = useState("");
  const online = t.status === "Online";
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);
  return (
    <Screen>
      <header className="relative grid h-[calc(76px+var(--top-shift))] shrink-0 grid-cols-[64px_1fr_64px] items-start border-b border-black/[0.06] px-5 pt-[calc(14px+var(--top-shift))] dark:border-white/20">
        <HeaderIconButton icon={ChevronLeft} label="Back to messages" to="/messages" size={16} />
        <div className="flex flex-col items-center pt-2">
          <p className="text-[16px] font-medium leading-5">{t.name}</p>
          <p className="t-label mt-1 flex items-center gap-[5px] text-ink-3">
            {online && <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-primary" />}
            {online ? "Online" : t.status}
          </p>
        </div>
        <div className="flex justify-end">
          <HeaderIconButton
            icon={Video}
            label={`Video call ${t.name}`}
            size={15}
            onClick={() => toast(`Calling ${t.name}…`)}
          />
        </div>
      </header>
      <ul ref={list} className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-4 pt-6">
        {msgs.map((m, i) => (
          <motion.li
            key={i}
            initial={i >= t.messages.length ? { opacity: 0, y: 12, scale: 0.98 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: DUR.base, ease: EASE }}
            className={cn("max-w-[272px]", m.me ? "self-end" : "self-start")}
          >
            {m.video ? (
              <div>
                <div
                  className="grid h-[150px] w-60 place-items-center rounded-[25px] border-[0.5px] border-line-strong bg-surface"
                  role="img"
                  aria-label="Signed video"
                >
                  <div className="flex flex-col items-center gap-5 pt-6">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-black">
                      <Play className="h-[11px] w-[11px]" aria-hidden />
                    </span>
                    <span className="t-label text-ink-3">Signed video</span>
                  </div>
                </div>
                <p className="mt-2.5 w-60 px-1 text-[13px] leading-4 text-ink-2">“{m.text}”</p>
              </div>
            ) : (
              <p
                className={cn(
                  "rounded-[25px] px-[18px] py-[13px] text-[16px] font-medium leading-[1.35]",
                  m.me
                    ? "border-[1.5px] border-primary bg-card"
                    : "bg-surface dark:border-[0.5px] dark:border-white",
                )}
              >
                {m.text}
              </p>
            )}
          </motion.li>
        ))}
      </ul>
      <form
        className="flex items-center gap-2.5 px-5 pb-[23px] pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) {
            setMsgs((x) => [...x, { me: true, text: draft.trim() }]);
            setDraft("");
          }
        }}
      >
        <label htmlFor="compose" className="sr-only">
          Type, speak, or sign
        </label>
        <input
          id="compose"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type, speak, or sign…"
          className="h-12 min-w-0 flex-1 rounded-full border border-line bg-card px-5 text-[14px] outline-none placeholder:text-ink-3 focus:border-primary"
        />
        {draft.trim() ? (
          <motion.button
            {...press}
            type="submit"
            aria-label="Send"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-black"
          >
            <ArrowUp className="h-5 w-5" aria-hidden />
          </motion.button>
        ) : (
          <>
            <motion.button
              {...press}
              type="button"
              aria-label="Record a signed video"
              onClick={() => toast("Camera opens in the native app")}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-surface"
            >
              <Hand className="h-4 w-4" aria-hidden />
            </motion.button>
            <motion.button
              {...press}
              type="button"
              aria-label="Speak a message"
              onClick={() => toast("Microphone opens in the native app")}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-surface"
            >
              <Mic className="h-[13px] w-[13px]" aria-hidden />
            </motion.button>
          </>
        )}
      </form>
    </Screen>
  );
}
