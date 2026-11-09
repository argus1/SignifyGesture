import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Volume2, VolumeX, Keyboard, ArrowUp, Check, Undo2, Hand, AudioLines, type LucideIcon } from "lucide-react";
import { useNativeBridge, useSignify, type Caption } from "@/lib/signify-store";
import { isNativeHost, triggerTTSPlayback } from "@/lib/nativeBridge";
import { CameraViewport } from "@/components/signify/CameraViewport";
import { HandTrackingCue } from "@/components/signify/HandTrackingCue";
import { AgentChip, RepairCard, TypingSuggestion } from "@/components/signify/agent";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { seo } from "@/lib/seo";

/** One conversation screen, two modes: "sign" (camera, Sam signs) and "speech" (white, the other person talks, Sam reads). */
export type ConversationMode = "sign" | "speech";
export const Route = createFileRoute("/sign")({
  validateSearch: (search: Record<string, unknown>): { mode?: ConversationMode } => (search["mode"] === "speech" ? { mode: "speech" } : {}),
  head: () => seo("Conversation", "Live sign ⇄ speech conversation with captions and agent repair."),
  component: Conversation,
});

/**
 * One line of the conversation, Google Translate style: your words on the right (mint), theirs on the left (gray).
 * The small icon says how it came in: hand = signed, keyboard = typed, sound = heard by the mic (bars move while they're still talking).
 * Like Google showing the original above the translation, your latest signed line shows the signs it came from
 * ("HELLO I WANT ICED…") above the English. Tap an older line to see its signs again.
 * Your lines get a replay button so the other person can hear them again.
 */
function Bubble({ c, latest }: { c: Caption; latest: boolean }) {
  const mine = c.speaker === "sam";
  const { textScale } = useSignify();
  const [open, setOpen] = useState(false);
  const showGloss = !!c.gloss && (latest || open);
  const SourceIcon = c.typed ? Keyboard : Hand;
  const icon = mine ? <SourceIcon className="h-4 w-4" /> : c.final ? <AudioLines className="h-4 w-4" /> : <LiveBars />;
  return (
    <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
      {mine && c.final && (
        <button onClick={() => triggerTTSPlayback(c.text)} aria-label={`Say “${c.text}” again`}
          className="mb-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted active:scale-95 transition-transform">
          <Volume2 className="h-4 w-4" />
        </button>
      )}
      <div onClick={c.gloss && !latest ? () => setOpen(!open) : undefined}
        className={cn("max-w-[85%] rounded-[1.5rem] px-4 py-2.5", mine ? "bg-accent" : "bg-muted", c.gloss && !latest && "cursor-pointer")}>
        <span className="sr-only">{mine ? (c.typed ? "You typed:" : "You signed:") : "They said:"}</span>
        {showGloss && (
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <span aria-hidden>{icon}</span>
            <span className="sr-only">Signs:</span>{c.gloss}
          </p>
        )}
        <p style={{ fontSize: `${1.25 * textScale}rem` }} className={cn("font-semibold leading-snug", mine ? "text-mint-ink" : "text-foreground", !c.final && "opacity-70")}>
          {!showGloss && (
            <span aria-hidden className="mr-1.5 inline-flex h-4 translate-y-[1px] items-center align-baseline text-muted-foreground">{icon}</span>
          )}
          {c.text}
        </p>
      </div>
    </div>
  );
}

/**
 * Google Translate-style listening light: a hairline of light that casts a soft glow downward,
 * with the status underneath, sitting just above the controls. A shimmer runs along the line;
 * faster while someone is signing or talking, dim while it waits on you.
 */
function ListeningLight({ status, busy, waiting, light = false }: { status: string; busy: boolean; waiting: boolean; light?: boolean }) {
  return (
    <div role="status" className={cn("listen-light mb-2 flex flex-col items-center", busy && "listen-busy", waiting && "listen-waiting")}>
      <div aria-hidden className="relative h-7 w-full">
        <span className="listen-cone absolute left-1/2 top-0 h-7 w-full -translate-x-1/2" />
        <span className="listen-line absolute left-1/2 top-0 h-px w-full -translate-x-1/2" />
      </div>
      <span className={cn("-mt-3 text-sm font-semibold", light ? "text-muted-foreground" : "text-white/90")}>{status}…</span>
    </div>
  );
}

/** Tiny moving sound bars: the mic is hearing them right now. */
function LiveBars() {
  return (
    <span className="flex h-4 items-center gap-[2px]">
      {[8, 14, 10].map((h, i) => <span key={i} className="voice-bar w-[3px] rounded-full bg-current" style={{ height: h, animationDelay: `${i * 120}ms` }} />)}
    </span>
  );
}

/** Round glass button that floats on the camera, same look as the home direction pills. */
function GlassButton({ icon: Icon, label, onClick, light = false }: { icon: LucideIcon; label: string; onClick: () => void; light?: boolean }) {
  return (
    <button onClick={onClick} aria-label={label}
      className={cn("grid h-11 w-11 place-items-center rounded-full backdrop-blur-md active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40", light ? "bg-muted" : "bg-background/85")}>
      <Icon className="h-5 w-5" />
    </button>
  );
}

/** One control in the dark glass bar — same shape and states as the home tab bar. */
function BarToggle({ icon: Icon, label, on, onClick, light = false }: { icon: LucideIcon; label: string; on: boolean; onClick: () => void; light?: boolean }) {
  return (
    <button onClick={onClick} aria-pressed={on}
      className={cn("flex h-14 flex-col items-center justify-center gap-0.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40",
        light ? (on ? "bg-black/[0.07]" : "text-muted-foreground active:bg-black/5")
          : on ? "bg-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]" : "text-white/60 active:bg-white/10")}>
      <Icon className="h-5 w-5" aria-hidden />
      <span className="text-[11px] font-semibold leading-none">{label}</span>
    </button>
  );
}

/**
 * Conversation, laid out like home: camera fills the screen, controls float on top.
 * Top: close · status · agent. Bottom: one caption card + a dark glass control bar.
 */
function Conversation() {
  const { mode = "sign" } = Route.useSearch();
  const speech = mode === "speech";
  const s = useSignify();
  const engine = useNativeBridge();
  const nav = useNavigate();
  const scroller = useRef<HTMLDivElement>(null);
  // Keep the hand on screen (performing the sign) while signs are coming in; fade it ~1.6s after the last one
  const [signingNow, setSigningNow] = useState(false);
  useEffect(() => {
    if (!s.liveSign) { setSigningNow(false); return; }
    setSigningNow(true);
    const t = setTimeout(() => setSigningNow(false), 1600);
    return () => clearTimeout(t);
  }, [s.liveSign]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  // Whole conversation lives in the card; it scrolls and always jumps to the newest line
  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; }, [s.captions]);
  const empty = s.captions.length === 0;
  const latestSigned = [...s.captions].reverse().find((c) => c.speaker === "sam" && c.gloss)?.id;
  const last = s.captions[s.captions.length - 1];
  const hearing = last?.speaker === "other" && !last.final; // mic is picking up the other person right now
  // Speech mode in the browser: the other person "talks" a moment after you arrive (natively the mic does this)
  useEffect(() => {
    if (!speech || s.captions.length > 0 || isNativeHost()) return;
    let cancelled = false;
    const words = "Hi! What can I get started for you?".split(" ");
    const timers = words.map((_, i) => setTimeout(() => {
      if (!cancelled) window.NativeASLBridge?.onSpeechTranscribed({ text: words.slice(0, i + 1).join(" "), isFinal: i === words.length - 1 });
    }, 1200 + i * 320));
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [speech]); // eslint-disable-line react-hooks/exhaustive-deps
  const status = speech ? (hearing ? "They're talking" : engine.ttsPlaying ? "Speaking for you" : "Listening") : hearing ? "They're talking" : engine.tracking === "lost" ? "Show your hands" : s.pending ? "Checking a sign"
    : engine.ttsPlaying ? "Speaking for you" : engine.tracking === "tracking" ? "Signing" : "Listening";

  return (
    <div className="relative flex flex-1 flex-col">
      {/* Full-screen camera with the same scrims as home (speech mode: plain white, like home's Speech side) */}
      {speech && <div aria-hidden className="absolute inset-0 bg-background" />}
      <div className={cn("absolute inset-0", speech && "hidden")}>
        <CameraViewport className="absolute inset-0" label="Native camera" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/45 to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/50 to-transparent" />
      </div>
      <div aria-hidden className={cn("absolute inset-0 -z-10", speech ? "bg-background" : "bg-neutral-900")} />

      <div className="relative z-10 flex flex-1 flex-col">
        {/* Top row mirrors home's header: left · center · right */}
        <header className="grid grid-cols-[44px_1fr_44px] items-start px-4 pt-4 pb-2">
          <GlassButton light={speech} icon={ChevronLeft} label={empty ? "Back" : "End conversation and see recap"} onClick={() => nav({ to: empty ? "/home" : "/recap" })} />
          <span />
          {/* Right column: agent, and under it the voice on/off (a setting, not a mode) */}
          <div className="flex flex-col items-center gap-2">
            <AgentChip {...(speech ? { className: "bg-muted" } : {})} />
            <GlassButton light={speech} icon={s.readAloud ? Volume2 : VolumeX} label={s.readAloud ? "Voice on: your words are spoken out loud. Turn off" : "Voice off. Turn on"}
              onClick={() => { s.setReadAloud(!s.readAloud); toast(s.readAloud ? "Voice off: your words won't be spoken" : "Voice on: your words are spoken out loud"); }} />
          </div>
        </header>

        {/* Center: hand cue (sign mode) or voice bars (speech mode), same as the home screen */}
        <div className="relative flex flex-1 items-center justify-center">
          {speech ? (
            <div aria-hidden className={cn("flex h-24 items-center justify-center gap-1.5 transition-opacity duration-500", hearing || empty ? "opacity-100" : "opacity-40")}>
              {[18, 34, 24, 50, 30, 64, 40, 56, 28, 46, 22, 38, 16].map((hgt, i) => (
                <span key={i} className={cn("w-2 rounded-full bg-primary", hearing && "voice-bar")} style={{ height: hearing ? hgt : Math.max(8, hgt / 4), animationDelay: `${i * 90}ms`, transition: "height 300ms ease" }} />
              ))}
            </div>
          ) : (
            <div className={cn("transition-all duration-500", empty || signingNow ? "scale-100 opacity-100" : "scale-90 opacity-0")}>
              <HandTrackingCue gloss={signingNow ? s.liveSign?.gloss : null} signKey={s.liveSign?.at} />
            </div>
          )}
        </div>

        {/* Caption card: hidden until something is said, then slides up */}
        {(!empty || typing || s.pending || s.suggestTyping) && (
        <section aria-label="Live captions" className={cn("mx-4 mb-3 rounded-[2rem] bg-background transition-[border-color,box-shadow] duration-300 animate-in fade-in slide-in-from-bottom-4", speech ? "border border-foreground/10 shadow-[0_8px_30px_rgba(0,0,0,0.08)]" : "border border-transparent shadow-[0_8px_30px_rgba(0,0,0,0.18)]", empty ? "p-3" : "px-4 py-4")}>
          <div ref={scroller} aria-live="polite" className="max-h-56 space-y-3 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_bottom,transparent,black_20px)] pt-2">
            {s.captions.map((c) => <Bubble key={c.id} c={c} latest={c.id === latestSigned} />)}
          </div>

          {/* Inline undo right after the agent fixes a word */}
          {s.lastFix && !s.pending && (
            <div className="mt-3 flex items-center gap-2 rounded-full bg-muted py-1.5 pl-4 pr-1.5">
              <Check className="h-4 w-4 shrink-0 text-mint-ink" aria-hidden />
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">Fixed to “{s.lastFix}”</p>
              <button onClick={s.undo} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-background px-3 text-sm font-bold active:scale-95">
                <Undo2 className="h-4 w-4" /> Undo
              </button>
            </div>
          )}

          {(s.pending || s.suggestTyping || typing) && (
            <div className={cn("space-y-3", !empty && "mt-3")}>
              <RepairCard onType={() => setTyping(true)} />
              <TypingSuggestion onType={() => setTyping(true)} />
              {typing && (
                <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { if (s.awaitingTyped) s.fixTyped(draft); else s.say(draft.trim(), "sam", { typed: true }); setDraft(""); setTyping(false); } }}>
                  <label htmlFor="typed" className="sr-only">Type your message</label>
                  <input id="typed" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={s.awaitingTyped ? "Type the right word…" : "Type your message…"}
                    className="h-12 min-w-0 flex-1 rounded-full border border-foreground/15 bg-background px-5 text-lg outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/30" />
                  <button type="submit" aria-label="Send" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary active:scale-95">
                    <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                </form>
              )}
            </div>
          )}
        </section>
        )}

        {/* Hidden while typing: hands are on the keyboard, not signing */}
        {!typing && <ListeningLight light={speech} status={status} busy={hearing || signingNow || engine.ttsPlaying} waiting={!speech && (!!s.pending || engine.tracking === "lost")} />}

        {/* Dark glass control bar, same as the home tab bar */}
        {/* Glass control bar: dark over the camera, light on white (same as the home tab bar) */}
        <nav aria-label="Conversation controls"
          className={cn("mx-4 mb-4 grid grid-cols-3 rounded-full border p-1.5 backdrop-blur-xl backdrop-saturate-150",
            speech ? "border-black/5 bg-white/85 text-foreground shadow-[0_8px_30px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.06)]"
              : "border-white/15 bg-neutral-900/80 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_30px_rgba(0,0,0,0.25)]")}>
          {/* Same bar in both modes: the mode you're in is highlighted (gray = you are here), the other is one tap away */}
          <BarToggle light={speech} icon={Hand} label="Signing" on={!speech}
            onClick={() => { if (speech) { setTyping(false); nav({ to: "/sign", search: {} }); } }} />
          <BarToggle light={speech} icon={Keyboard} label="Type" on={typing} onClick={() => { if (typing) s.cancelTyped(); setTyping(!typing); }} />
          <BarToggle light={speech} icon={AudioLines} label="Speech" on={speech}
            onClick={() => { if (!speech) { s.cancelTyped(); setTyping(false); nav({ to: "/sign", search: { mode: "speech" } }); } }} />
        </nav>
      </div>
    </div>
  );
}
