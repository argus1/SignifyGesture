import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useSignify } from "@/lib/signify-store";
import { isNativeHost } from "@/lib/nativeBridge";
import type { MemoryHit } from "@/types/memory";

/** Explicit personal-memory tool, separate from bundled app-help search. */
export function MemoryRecall() {
  const { memory, conversationId } = useSignify();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<MemoryHit[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  useEffect(() => {
    const clear = () => {
      revision.current += 1;
      setHits([]);
      setMessage("");
      setBusy(false);
    };
    const unsubscribe = memory.subscribe(clear);
    clear();
    return () => {
      revision.current += 1;
      unsubscribe();
    };
  }, [memory, conversationId]);

  const search = async () => {
    const current = ++revision.current;
    setHits([]);
    setMessage("");
    setBusy(true);
    try {
      const data = await memory.request({
        action: "search",
        query,
        excludingConversationId: conversationId,
      });
      if (current !== revision.current) return;
      setHits(data.hits);
      setMessage(
        data.hits.length
          ? "Matching saved words, not generated suggestions."
          : "No matching saved conversations.",
      );
    } catch (failure) {
      if (current === revision.current)
        setMessage(failure instanceof Error ? failure.message : "Memory recall failed.");
    } finally {
      if (current === revision.current) setBusy(false);
    }
  };

  return (
    <section aria-label="Recall saved conversations" className="space-y-3">
      <h3 className="font-bold">Recall saved conversations</h3>
      <p className="text-sm text-muted-foreground">
        Search only memories you have allowed for recall. Other speakers&apos; words are context,
        not your preferences. Model-backed sentence completion is not connected yet.
      </p>
      <label className="grid gap-1">
        Search saved words
        <input
          type="search"
          maxLength={300}
          value={query}
          className="min-h-12 rounded-xl border p-3"
          onChange={(event) => {
            revision.current += 1;
            setQuery(event.target.value);
            setHits([]);
            setMessage("");
            setBusy(false);
          }}
        />
      </label>
      <button
        type="button"
        disabled={busy || !isNativeHost() || !query.trim()}
        className="min-h-11 rounded-xl bg-muted px-4 font-semibold disabled:opacity-50"
        onClick={() => void search()}
      >
        {busy ? "Searching..." : "Search saved conversations"}
      </button>
      {!isNativeHost() && <p className="text-sm">Saved memory recall requires the iOS app.</p>}
      {message && <p role="status">{message}</p>}
      <ul className="space-y-3">
        {hits.map((hit) => (
          <li key={hit.turnId} className="rounded-xl bg-muted p-3">
            <p className="text-sm font-bold">
              Match {hit.rank} · {hit.speaker === "sam" ? "You said" : "Other speaker said"}
            </p>
            <p className="break-words">{hit.text}</p>
            <Link
              to="/memory"
              search={{ conversation: hit.conversationId }}
              className="inline-flex min-h-11 items-center underline"
            >
              From saved conversation: {hit.title}
            </Link>
            <p className="text-sm">{new Date(hit.timestamp).toLocaleString()}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
