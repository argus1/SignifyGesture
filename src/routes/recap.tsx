import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bot, Check } from "lucide-react";
import { useSignify } from "@/lib/signify-store";
import { TopBar, Pill, Headline } from "@/components/signify/ui";
import { Pipeline } from "@/components/signify/agent";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/recap")({
  head: () => seo("Conversation recap", "The Signify Agent sums up your conversation and next steps."),
  component: Recap,
});

const ACTIONS = [
  { id: "mem", title: "Save to Conversation memory", body: "Keep this recap to look back on." },
  { id: "learn", title: "Practice the 6 signs from this chat", body: "Coffee, iced, oat, milk, latte, thank you." },
  { id: "contact", title: "Save the barista as a contact", body: "Message them next time you visit." },
];

function Recap() {
  const s = useSignify();
  const nav = useNavigate();
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  useEffect(() => { s.setStep("recap"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const fixes = s.corrections.length;
  return (
    <div className="flex flex-1 flex-col">
      <TopBar back="/sign" />
      <div className="space-y-5 px-6 pt-4 pb-20">
        <p className="flex items-center gap-2 text-sm font-bold"><Bot className="h-4 w-4" /> Signify Agent · Conversation recap</p>
        <Headline dark="Café order" soft="All sorted." className="text-[40px]" />
        <Pipeline />
        <div className="rounded-3xl bg-accent p-5 text-lg leading-snug">
          You ordered a <b>medium iced oat milk latte</b> ($5.40). The barista said it'll be ready in a few minutes.
          {s.captions.length > 0 && <> {s.captions.length} lines captioned</>}{fixes > 0 && <>, {fixes} sign{fixes > 1 ? "s" : ""} repaired with you</>}.
        </div>
        <ul className="space-y-3">
          {ACTIONS.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-3xl border-2 border-foreground p-4">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{a.title}</p>
                <p className="text-sm text-muted-foreground">{a.body}</p>
              </div>
              <Pill size="sm" variant={saved[a.id] ? "ghost" : "mint"} aria-pressed={!!saved[a.id]}
                onClick={() => (a.id === "learn" && saved[a.id] ? nav({ to: "/learn" }) : setSaved((x) => ({ ...x, [a.id]: true })))}>
                {saved[a.id] ? <><Check className="h-4 w-4" /> Saved</> : a.id === "learn" ? "Add" : "Save"}
              </Pill>
            </li>
          ))}
        </ul>
        <Pill variant="outline" className="w-full" onClick={() => { s.reset(); nav({ to: "/home" }); }}>Done</Pill>
      </div>
    </div>
  );
}
