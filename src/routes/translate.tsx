import { createFileRoute, Link } from "@tanstack/react-router";
import { Hand, Mic } from "lucide-react";
import { TopBar, Headline } from "@/components/signify/ui";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/translate")({
  head: () => seo("Who is talking?", "Choose whether you sign or speak."),
  component: Choose,
});

function Choose() {
  const cards = [
    { to: "/sign", icon: Hand, title: "I sign", body: "Signify reads your hands and captions or speaks for you." },
    { to: "/speak", icon: Mic, title: "I speak", body: "Your words appear as big captions for the Deaf person." },
  ] as const;
  return (
    <div className="flex flex-1 flex-col">
      <TopBar back="/home" />
      <div className="px-6 pt-8"><Headline dark="Who is" soft="talking?" /></div>
      <div className="grid gap-4 px-6 pt-8 pb-20">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="group rounded-3xl border-2 border-foreground p-6 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40">
            <c.icon className="h-10 w-10" aria-hidden />
            <p className="headline mt-4 text-4xl">{c.title}</p>
            <p className="mt-2 text-lg">{c.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
