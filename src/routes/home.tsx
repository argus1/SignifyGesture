import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { forwardRef, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Hand, Mic, ArrowLeftRight, AudioLines } from "lucide-react";
import { TopBar, TabBar } from "@/components/signify/ui";
import { CameraViewport } from "@/components/signify/CameraViewport";
import { HandTrackingCue } from "@/components/signify/HandTrackingCue";
import { cn } from "@/lib/utils";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/home")({
  head: () => seo("Translate", "Translate between ASL and spoken English."),
  component: Home,
});

/**
 * One side of the direction bar: how you communicate (big) + the language (small), on its own rounded pill,
 * with who it is underneath (You = the signer, Them = the person speaking), like Google Translate's "Your / Their language".
 * The label is part of the pill, so it travels with it on swap.
 */
const ModeLabel = forwardRef<HTMLSpanElement, { mode: "sign" | "speech"; light?: boolean }>(function ModeLabel({ mode, light = false }, ref) {
  const Icon = mode === "sign" ? Hand : AudioLines;
  return (
    <span ref={ref} className="relative z-10 flex flex-col items-stretch gap-1 will-change-transform">
    <span className={cn("flex items-center justify-center gap-2 rounded-full px-3 py-2 transition-colors duration-500", light ? "border border-foreground/15 bg-background" : "bg-background/85 backdrop-blur-md")}>
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span className="leading-tight">
        <span className="block text-base font-bold">{mode === "sign" ? "Signing" : "Speech"}</span>
        <span className="block whitespace-nowrap text-xs text-muted-foreground">{mode === "sign" ? "ASL" : "Spoken English"}</span>
      </span>
    </span>
    <span className={cn("text-center text-xs font-semibold transition-colors duration-500", light ? "text-muted-foreground" : "text-white drop-shadow-sm")}>{mode === "sign" ? "You" : "Them"}</span>
    </span>
  );
});

/**
 * Direction bar. On swap the two pills glide to the middle and cross over each other
 * (one passes over the other, no vertical movement) and land in each other's place. The arrow stays put underneath.
 */
function DirectionBar({ fromAsl, onSwap, onSwapStart, light = false }: { fromAsl: boolean; onSwap: () => void; onSwapStart?: () => void; light?: boolean }) {
  const left = useRef<HTMLSpanElement>(null);
  const right = useRef<HTMLSpanElement>(null);
  const busy = useRef(false);

  const swap = () => {
    const a = left.current, b = right.current;
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (busy.current) return;
    onSwapStart?.(); // start the scene cross-fade at the same moment the pills start moving
    if (!a || !b || reduce || !a.animate) { onSwap(); return; }
    busy.current = true;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const d = (rb.left + rb.width / 2) - (ra.left + ra.width / 2);
    const opts: KeyframeAnimationOptions = { duration: 340, easing: "cubic-bezier(0.65, 0, 0.35, 1)", fill: "forwards" };
    a.style.zIndex = "20";
    const ma = a.animate([{ transform: "none" }, { transform: `translateX(${d / 2}px) scale(1.04)` }, { transform: `translateX(${d}px)` }], opts);
    const mb = b.animate([{ transform: "none" }, { transform: `translateX(${-d / 2}px) scale(0.96)` }, { transform: `translateX(${-d}px)` }], opts);
    ma.onfinish = () => {
      // swap the labels, then drop the transforms in the same frame so nothing jumps
      flushSync(onSwap);
      ma.cancel(); mb.cancel();
      a.style.zIndex = ""; busy.current = false;
    };
  };

  return (
    <div className="relative mx-5 mt-2 grid grid-cols-[1fr_auto_1fr] items-start gap-1">
      <ModeLabel ref={left} light={light} mode={fromAsl ? "sign" : "speech"} />
      <button onClick={swap} aria-label="Swap translation direction"
        className={cn("relative z-0 grid h-11 w-11 place-items-center rounded-full transition-colors duration-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40", light ? "bg-muted" : "bg-background/85 backdrop-blur-md")}>
        <ArrowLeftRight className="h-5 w-5" />
      </button>
      <ModeLabel ref={right} light={light} mode={fromAsl ? "speech" : "sign"} />
    </div>
  );
}

/**
 * Translator-style home, camera-first: the camera fills the screen and everything floats on top.
 * The direction bar says what the app does; one big button starts.
 */
function Home() {
  const nav = useNavigate();
  const [fromAsl, setFromAsl] = useState(true); // pill labels (swap when the pills land)
  const [scene, setScene] = useState(true); // everything else (flips the instant you tap, so the fade runs with the pills)
  const start = () => nav({ to: scene ? "/sign" : "/speak" });

  return (
    <div className="relative flex flex-1 flex-col">
      {/* Full-screen background: camera (signing) and white (speech) cross-fade on swap */}
      <div aria-hidden className="absolute inset-0 bg-background" />
      <div className={cn("absolute inset-0 transition-opacity duration-500 ease-out", scene ? "opacity-100" : "pointer-events-none opacity-0")}>
        <CameraViewport className="absolute inset-0" label="Native camera" />
        {/* Scrims keep floating text readable over any camera image */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-black/45 to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col">
        <TopBar onDark={scene} />
        <DirectionBar fromAsl={fromAsl} light={!scene} onSwapStart={() => setScene((v) => !v)} onSwap={() => setFromAsl((v) => !v)} />

        {/* Center cue: hand (signing) and voice bars (speech) cross-fade */}
        <div className="relative flex flex-1 items-center justify-center">
          <div className={cn("absolute transition-all duration-500 ease-out", scene ? "scale-100 opacity-100" : "scale-90 opacity-0")}><HandTrackingCue /></div>
          <div aria-hidden className={cn("absolute flex h-24 items-center justify-center gap-1.5 transition-all duration-500 ease-out", scene ? "scale-90 opacity-0" : "scale-100 opacity-100")}>
            {[18, 34, 24, 50, 30, 64, 40, 56, 28, 46, 22, 38, 16].map((hgt, i) => (
              <span key={i} className="voice-bar w-2 rounded-full bg-primary" style={{ height: hgt, animationDelay: `${i * 90}ms` }} />
            ))}
          </div>
        </div>

        <div className="px-5 pb-4">
          <button onClick={start}
            className={cn("flex min-h-16 w-full items-center justify-center gap-3 rounded-full bg-primary px-7 text-lg font-bold transition-[transform,box-shadow] duration-500 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40", scene ? "shadow-xl shadow-black/30" : "shadow-none")}>
            {scene ? <Hand className="h-6 w-6" aria-hidden /> : <Mic className="h-6 w-6" aria-hidden />}
            {scene ? "Start conversation" : "Start speaking"}
          </button>
        </div>
        <TabBar tone={scene ? "dark" : "light"} />
      </div>
    </div>
  );
}
