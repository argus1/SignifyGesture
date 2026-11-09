import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => seo("Talk face to face", "Signify helps Deaf and hearing people talk face to face."),
  component: Loading,
});

function Loading() {
  const nav = useNavigate();
  useEffect(() => { const t = setTimeout(() => nav({ to: "/home" }), 2200); return () => clearTimeout(t); }, [nav]);
  return (
    <div className="flex flex-1 flex-col items-center px-10 pb-16" role="status" aria-label="Loading Signify">
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <img src="/logo.jpg" alt="Signify" className="w-64" />
        <p className="text-lg font-medium text-soft-headline">Talk face to face.</p>
      </div>
      <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-foreground" style={{ animation: "load-bar 2s ease-out forwards" }} />
      </div>
      <p className="label-caps mt-3 text-[10px] text-muted-foreground">Loading…</p>
    </div>
  );
}
