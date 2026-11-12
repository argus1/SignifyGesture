import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { TopBar, TabBar, PageTitle, Pill, Screen } from "@/components/signify/ui";
import { useSignify } from "@/lib/signify-store";
import { isNativeHost } from "@/lib/nativeBridge";
import type { MemoryAction, MemorySummary, SavedConversation } from "@/types/memory";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/memory")({
  validateSearch: (search: Record<string, unknown>): { conversation?: string } =>
    typeof search["conversation"] === "string" ? { conversation: search["conversation"] } : {},
  head: () => seo("Conversation memory", "Saved conversations on this device."),
  component: MemoryRoute,
});

function MemoryRoute() {
  const { conversation } = Route.useSearch();
  return <Memory initialConversationId={conversation} />;
}

export function Memory({ initialConversationId }: { initialConversationId?: string | undefined }) {
  const { memory } = useSignify();
  const [items, setItems] = useState<MemorySummary[]>([]);
  const [detail, setDetail] = useState<SavedConversation | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [recall, setRecall] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<"delete" | "erase" | null>(null);
  const revision = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const selectedId = useRef<string | null>(null);
  const native = isNativeHost();
  const detailId = detail?.id;
  const load = useCallback(
    async (offset = 0) => {
      const current = ++revision.current;
      setBusy(true);
      setError("");
      try {
        const data = await memory.request({ action: "list", offset });
        if (current !== revision.current) return;
        setItems((old) => (offset ? [...old, ...data.conversations] : data.conversations));
        setHasMore(data.hasMore);
        setRecall(data.recallEnabled);
      } catch (failure) {
        if (current === revision.current)
          setError(failure instanceof Error ? failure.message : "Could not load memory.");
      } finally {
        if (current === revision.current) setBusy(false);
      }
    },
    [memory],
  );
  const open = useCallback(
    async (id: string) => {
      const current = ++revision.current;
      setBusy(true);
      setError("");
      setDetail(null);
      try {
        const data = await memory.request({ action: "detail", conversationId: id });
        if (current !== revision.current) return;
        if (!data.conversation) throw new Error("The native app did not return this conversation.");
        setDetail(data.conversation);
        setRecall(data.recallEnabled);
      } catch (failure) {
        if (current === revision.current)
          setError(failure instanceof Error ? failure.message : "Could not open memory.");
      } finally {
        if (current === revision.current) setBusy(false);
      }
    },
    [memory],
  );
  useEffect(() => {
    if (native) {
      if (initialConversationId) void open(initialConversationId);
      else void load();
    }
    return () => {
      revision.current += 1;
    };
  }, [native, initialConversationId, open, load]);
  useEffect(() => {
    if (detailId) heading.current?.focus();
    else if (!busy && selectedId.current)
      document.getElementById(`memory-${selectedId.current}`)?.focus();
  }, [detailId, busy]);

  const change = async (action: MemoryAction) => {
    if (busy) return;
    const current = ++revision.current;
    setBusy(true);
    setError("");
    try {
      const data = await memory.request(action);
      if (current !== revision.current) return;
      setRecall(data.recallEnabled);
      if (action.action === "setRecall" && detail) {
        setDetail({ ...detail, recallAllowed: action.enabled });
      } else if (action.action === "erase" || action.action === "delete") {
        setDetail(null);
        setItems([]);
        setHasMore(false);
        selectedId.current = null;
        await load();
        heading.current?.focus();
      }
    } catch (failure) {
      if (current === revision.current)
        setError(failure instanceof Error ? failure.message : "Could not change memory.");
    } finally {
      if (current === revision.current) setBusy(false);
    }
  };

  return (
    <Screen kind="tab">
      <TopBar />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PageTitle
          title="Memory"
          helpFocusId="help-destination-memory"
          sub="Saved on this device"
        />
        <div className="space-y-4 px-5 pb-6 pt-5">
          <p className="text-sm text-muted-foreground">
            Only conversations you explicitly save appear here. Recall is off by default. No
            audio/video or cloud sync. New backups exclude memory; deletion cannot erase external or
            older backup copies.
          </p>
          {!native ? (
            <p role="status">
              Conversation memory requires the iOS app. Nothing is saved in this browser.
            </p>
          ) : (
            <>
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  checked={recall}
                  disabled={busy}
                  onChange={(e) =>
                    void change({ action: "setGlobalRecall", enabled: e.target.checked })
                  }
                />
                Enable saved conversation recall
              </label>
              {busy && <p role="status">Loading memory...</p>}
              {error && (
                <div role="alert">
                  <p>{error}</p>
                  <Pill disabled={busy} onClick={() => void load()}>
                    Refresh memory
                  </Pill>
                </div>
              )}
              {detail ? (
                <section aria-label="Saved conversation">
                  <Pill
                    disabled={busy}
                    onClick={() => {
                      setDetail(null);
                      void load();
                    }}
                  >
                    Back to memories
                  </Pill>
                  <h2 ref={heading} tabIndex={-1} className="mt-4 text-2xl font-bold">
                    {detail.title}
                  </h2>
                  <p>
                    {new Date(detail.endedAt).toLocaleString()} {detail.context}
                  </p>
                  <label className="my-3 flex min-h-11 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={detail.recallAllowed}
                      disabled={busy}
                      onChange={(e) =>
                        void change({
                          action: "setRecall",
                          conversationId: detail.id,
                          enabled: e.target.checked,
                        })
                      }
                    />
                    Allow recall of this conversation
                  </label>
                  <ol className="space-y-3">
                    {detail.turns.map((turn) => (
                      <li key={turn.id} className="rounded-2xl bg-muted p-3">
                        <p className="font-bold">
                          {turn.speaker === "sam" ? "You" : "Other speaker"}
                        </p>
                        <p className="break-words">{turn.text}</p>
                        {turn.gloss && (
                          <p className="text-sm text-muted-foreground">Signs: {turn.gloss}</p>
                        )}
                      </li>
                    ))}
                  </ol>
                  <Pill className="mt-4" disabled={busy} onClick={() => setConfirmation("delete")}>
                    Delete conversation
                  </Pill>
                </section>
              ) : (
                <section aria-label="Saved conversations">
                  <h2 ref={heading} tabIndex={-1} className="sr-only">
                    Saved conversations
                  </h2>
                  {!busy && !error && !items.length && <p>No saved conversations yet.</p>}
                  <ul className="space-y-2">
                    {items.map((item) => (
                      <li key={item.id}>
                        <button
                          id={`memory-${item.id}`}
                          disabled={busy}
                          className="min-h-12 w-full rounded-2xl bg-muted p-3 text-left"
                          onClick={() => {
                            selectedId.current = item.id;
                            void open(item.id);
                          }}
                        >
                          <p className="font-bold">{item.title}</p>
                          <p className="text-sm">
                            {new Date(item.endedAt).toLocaleString()} {item.context}
                          </p>
                          <p className="line-clamp-2 text-sm text-muted-foreground">
                            {item.preview}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {hasMore && (
                    <Pill disabled={busy} onClick={() => void load(items.length)}>
                      Load more
                    </Pill>
                  )}
                </section>
              )}
              <Pill disabled={busy} onClick={() => setConfirmation("erase")}>
                Erase all memories
              </Pill>
            </>
          )}
        </div>
        <AlertDialog
          open={confirmation !== null}
          onOpenChange={(value) => {
            if (!value) setConfirmation(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogTitle>
              {confirmation === "erase"
                ? "Erase all saved conversations?"
                : "Delete this conversation?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes saved text and its search index on this device. It cannot be undone.
            </AlertDialogDescription>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmation === "erase") void change({ action: "erase" });
                else if (detail) void change({ action: "delete", conversationId: detail.id });
              }}
            >
              Confirm deletion
            </AlertDialogAction>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <TabBar />
    </Screen>
  );
}
