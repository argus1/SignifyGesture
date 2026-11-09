import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Wordmark } from "@/components/signify/ui";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => seo("Talk face to face", "Signify helps Deaf and hearing people talk face to face."),
  component: Loading,
});

function Loading() {
  const nav = useNavigate();
  useEffect(() => { const t = setTimeout(() => nav({ to: "/home" }), 2200); return () => clearTimeout(t); }, [nav]);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-10" role="status" aria-label="Loading Signify">
      <div className="grid h-24 w-24 place-items-center rounded-[2rem] bg-primary text-5xl font-black" aria-hidden>S</div>
      <Wordmark className="text-5xl" />
      <p className="headline text-3xl">Talk face to face.</p>
      <div className="h-2 w-full max-w-56 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-foreground" style={{ animation: "load-bar 2s ease-out forwards" }} />
      </div>
    </div>
  );
}
