import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Volume2, VolumeX, Keyboard, ArrowUp, Check, Undo2, Hand, AudioLines, type LucideIcon } from "lucide-react";
import { useNativeBridge, useSignify, type Caption } from "@/lib/signify-store";
import { triggerTTSPlayback } from "@/lib/nativeBridge";
import { CameraViewport } from "@/components/signify/CameraViewport";
import { HandTrackingCue } from "@/components/signify/HandTrackingCue";
import { AgentChip, RepairCard, TypingSuggestion } from "@/components/signify/agent";
import { cn } from "@/lib/utils";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/sign")({
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
function ListeningLight({ status, busy, waiting }: { status: string; busy: boolean; waiting: boolean }) {
  return (
    <div role="status" className={cn("listen-light mb-2 flex flex-col items-center", busy && "listen-busy", waiting && "listen-waiting")}>
      <div aria-hidden className="relative h-7 w-full">
        <span className="listen-cone absolute left-1/2 top-0 h-7 w-full -translate-x-1/2" />
        <span className="listen-line absolute left-1/2 top-0 h-px w-full -translate-x-1/2" />
      </div>
      <span className="-mt-3 text-sm font-semibold text-white/90">{status}…</span>
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
function GlassButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={label}
      className="grid h-11 w-11 place-items-center rounded-full bg-background/85 backdrop-blur-md active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40">
      <Icon className="h-5 w-5" />
    </button>
  );
}

/** One control in the dark glass bar — same shape and states as the home tab bar. */
function BarToggle({ icon: Icon, label, on, onClick }: { icon: LucideIcon; label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={on}
      className={cn("flex h-14 flex-col items-center justify-center gap-0.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40",
        on ? "bg-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]" : "text-white/60 active:bg-white/10")}>
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
  const status = hearing ? "They're talking" : engine.tracking === "lost" ? "Show your hands" : s.pending ? "Checking a sign"
    : engine.ttsPlaying ? "Speaking for you" : engine.tracking === "tracking" ? "Signing" : "Listening";

  return (
    <div className="relative flex flex-1 flex-col">
      {/* Full-screen camera with the same scrims as home */}
      <div className="absolute inset-0">
        <CameraViewport className="absolute inset-0" label="Native camera" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/45 to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/50 to-transparent" />
      </div>
      <div aria-hidden className="absolute inset-0 -z-10 bg-neutral-900" />

      <div className="relative z-10 flex flex-1 flex-col">
        {/* Top row mirrors home's header: left · center · right */}
        <header className="grid grid-cols-[44px_1fr_44px] items-center px-4 pt-4 pb-2">
          <GlassButton icon={ChevronLeft} label={empty ? "Back" : "End conversation and see recap"} onClick={() => nav({ to: empty ? "/home" : "/recap" })} />
          <span />
          <AgentChip />
        </header>

        {/* Center: hand cue until the first caption arrives */}
        <div className="relative flex flex-1 items-center justify-center">
          <div className={cn("transition-all duration-500", empty || signingNow ? "scale-100 opacity-100" : "scale-90 opacity-0")}>
            <HandTrackingCue gloss={signingNow ? s.liveSign?.gloss : null} signKey={s.liveSign?.at} />
          </div>
        </div>

        {/* Caption card: hidden until something is said, then slides up */}
        {(!empty || typing || s.pending || s.suggestTyping) && (
        <section aria-label="Live captions" className={cn("mx-4 mb-3 rounded-[2rem] bg-background shadow-[0_8px_30px_rgba(0,0,0,0.18)] animate-in fade-in slide-in-from-bottom-4 duration-300", empty ? "p-3" : "px-4 py-4")}>
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
        {!typing && <ListeningLight status={status} busy={hearing || signingNow || engine.ttsPlaying} waiting={!!s.pending || engine.tracking === "lost"} />}

        {/* Dark glass control bar, same as the home tab bar */}
        <nav aria-label="Conversation controls"
          className="mx-4 mb-4 grid grid-cols-2 rounded-full border border-white/15 bg-neutral-900/80 p-1.5 text-white backdrop-blur-xl backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_30px_rgba(0,0,0,0.25)]">
          <BarToggle icon={s.readAloud ? Volume2 : VolumeX} label={s.readAloud ? "Audio" : "Audio off"} on={s.readAloud} onClick={() => s.setReadAloud(!s.readAloud)} />
          <BarToggle icon={Keyboard} label="Type" on={typing} onClick={() => { if (typing) s.cancelTyped(); setTyping(!typing); }} />
        </nav>
      </div>
    </div>
  );
}
