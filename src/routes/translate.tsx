import { createFileRoute, Link } from "@tanstack/react-router";
import { Hand, Mic } from "lucide-react";
import { TopBar } from "@/components/signify/ui";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/translate")({
  head: () => seo("Who is talking?", "Choose whether you sign or speak."),
  component: Choose,
});

function Choose() {
  const cards = [
    { to: "/sign", icon: Hand, title: "I sign", body: "Signify reads your signs through the camera and shows text or voice to the hearing person." },
    { to: "/speak", icon: Mic, title: "I speak", body: "Signify listens and turns your words into big captions for the Deaf person." },
  ] as const;
  return (
    <div className="flex flex-1 flex-col">
      <TopBar back="/home" />
      <div className="px-6 pt-8">
        <h1 className="headline text-[44px]">Who is talking?</h1>
        <p className="mt-2 text-xl font-bold leading-tight text-soft-headline">Pick your side of the conversation.</p>
      </div>
      <div className="grid gap-4 px-6 pt-8 pb-20">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="group flex min-h-48 flex-col rounded-3xl border-2 border-foreground p-6 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-muted" aria-hidden><c.icon className="h-6 w-6" /></span>
            <p className="headline mt-auto pt-6 text-4xl">{c.title}</p>
            <p className="mt-2 text-base leading-snug">{c.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
