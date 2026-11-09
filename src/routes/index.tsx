import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AnimatedLogo } from "@/components/signify/AnimatedLogo";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => seo("Every conversation, understood", "Signify helps Deaf and hearing people talk face to face."),
  component: Splash,
});

/** Launch screen: the logo animation is the loader. Tap anywhere to skip. */
function Splash() {
  const nav = useNavigate();
  const go = () => nav({ to: "/home" });
  useEffect(() => { const t = setTimeout(go, 2150); return () => clearTimeout(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <button onClick={go} className="flex flex-1 flex-col items-center justify-center gap-3 px-10" aria-label="Signify is loading. Tap to continue.">
      <AnimatedLogo />
      <p className="logo-tagline text-lg font-medium text-soft-headline">Every conversation, understood.</p>
    </button>
  );
}
