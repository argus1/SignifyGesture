import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useSignify } from "@/lib/signify-store";
import { TopBar, Pill, AgentLabel } from "@/components/signify/ui";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/recap")({
  head: () => seo("Conversation recap", "The Signify Agent sums up your conversation and next steps."),
  component: Recap,
});

const ACTIONS = [
  { id: "mem", title: "Save to Conversation memory", cta: "Save" },
  { id: "learn", title: "Practice the 6 signs from this chat", cta: "Learn" },
  { id: "contact", title: "Save the barista as a contact", cta: "Add" },
];

function Recap() {
  const s = useSignify();
  const nav = useNavigate();
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  useEffect(() => { s.setStep("recap"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const fixes = s.corrections.length;
  return (
    <div className="flex flex-1 flex-col">
      <TopBar back="/home" />
      <div className="flex flex-1 flex-col px-6 pt-6 pb-20">
        <AgentLabel />
        <h1 className="headline mt-2 text-[40px]">Conversation recap</h1>
        <p className="mt-3 text-base leading-snug">
          You ordered an iced oat milk latte. The barista asked about size and you chose medium. 6 new signs came up.
          {fixes > 0 && <> You corrected {fixes} sign{fixes > 1 ? "s" : ""} — I'll remember next time.</>}
        </p>
        <ul className="mt-5 space-y-3">
          {ACTIONS.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-2xl border-2 border-foreground/15 p-4">
              <p className="min-w-0 flex-1 font-medium leading-snug">{a.title}</p>
              <Pill size="sm" aria-pressed={!!saved[a.id]}
                onClick={() => (a.id === "learn" ? nav({ to: "/learn" }) : setSaved((x) => ({ ...x, [a.id]: true })))}>
                {saved[a.id] ? <><Check className="h-4 w-4" /> Saved</> : a.cta}
              </Pill>
            </li>
          ))}
        </ul>
        <Pill variant="mint" className="mt-auto w-full" onClick={() => { s.reset(); nav({ to: "/home" }); }}>Done</Pill>
      </div>
    </div>
  );
}
