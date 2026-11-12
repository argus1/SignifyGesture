import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useSignify } from "@/lib/signify-store";
import { isNativeHost } from "@/lib/nativeBridge";
import { Header, Pill, Screen } from "@/components/signify/ui";
import { AgentIcon } from "@/components/signify/AgentIcon";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/recap")({
  head: () =>
    seo("Conversation recap", "Review and optionally save your conversation on this device."),
  component: Recap,
});

export function Recap() {
  const s = useSignify();
  const { setStep } = s;
  const nav = useNavigate();
  const finalized = s.captions.filter((c) => c.final && c.text.trim());
  const [title, setTitle] = useState(() => finalized[0]?.text.slice(0, 120) ?? "Conversation");
  const [context, setContext] = useState("");
  const [consent, setConsent] = useState(false);
  const [recallAllowed, setRecallAllowed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);
  const unavailable = !isNativeHost() || s.simulated;
  useEffect(() => {
    setStep("recap");
  }, [setStep]);

  const save = async () => {
    if (savingRef.current || saved) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await s.memory.request({
        action: "save",
        conversation: s.memorySnapshot(title, context, recallAllowed),
      });
      setSaved(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save this conversation.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const finish = () => {
    if (savingRef.current) return;
    s.reset();
    void nav({ to: "/home" });
  };

  return (
    <Screen>
      <Header />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-8 pt-5">
        <p className="flex items-center gap-2 text-lg font-bold">
          <AgentIcon className="h-6 w-6" /> Conversation recap
        </p>
        <h1 className="headline text-4xl">Review your conversation</h1>
        <ol aria-label="Finalized conversation" className="space-y-3">
          {finalized.map((c) => (
            <li key={c.id} className="rounded-2xl bg-muted p-3">
              <p className="text-sm font-bold">{c.speaker === "sam" ? "You" : "Other speaker"}</p>
              <p className="break-words">{c.text}</p>
            </li>
          ))}
        </ol>
        {!finalized.length && <p>No finalized messages to save.</p>}
        {s.captions.some((c) => !c.final) && <p>Unfinished captions are not included.</p>}
        <label className="grid gap-1 font-semibold">
          Memory title
          <input
            className="min-h-12 rounded-xl border p-3"
            value={title}
            maxLength={120}
            disabled={saved || saving}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="grid gap-1 font-semibold">
          Context (optional)
          <input
            className="min-h-12 rounded-xl border p-3"
            value={context}
            maxLength={200}
            disabled={saved || saving}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Who or where, if you want"
          />
        </label>
        <p className="text-sm text-muted-foreground">
          Saving keeps both speakers&apos; finalized words, signs, and confirmed corrections on this
          device. Ask the other person before saving their words. Audio and video are not saved.
          Memory is excluded from new device backups; deletion cannot remove external or older
          backup copies.
        </p>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={consent}
            disabled={saved || saving || unavailable}
            onChange={(e) => setConsent(e.target.checked)}
          />
          Save this transcript on my device
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={recallAllowed}
            disabled={saved || saving || unavailable}
            onChange={(e) => setRecallAllowed(e.target.checked)}
          />
          Allow the agent to recall this conversation when global recall is enabled
        </label>
        {unavailable && (
          <p role="status">
            {s.simulated
              ? "Simulator conversations cannot be saved to personal memory."
              : "Conversation memory requires the iOS app. Nothing is saved in this browser."}
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        {saved && <p role="status">Saved on this device.</p>}
        <Pill
          onClick={() => void save()}
          disabled={
            unavailable || !consent || !title.trim() || !finalized.length || saving || saved
          }
        >
          {saving ? "Saving..." : saved ? "Saved to memory" : "Save to memory"}
        </Pill>
        <Pill variant="mint" disabled={saving} onClick={finish}>
          {saved ? "Done" : "Finish without saving"}
        </Pill>
      </div>
    </Screen>
  );
}
