import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  X,
  Hand,
  AudioLines,
  ArrowLeftRight,
  Keyboard,
  ArrowUp,
  Volume2,
  VolumeX,
  Mic,
  Bot,
  Check,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { useNativeBridge, useSignify, type Caption } from "@/lib/signify-store";
import { isNativeHost } from "@/lib/nativeBridge";
import type { RecognitionStatusPayload } from "@/types/nativeBridge";
import { CameraControl, CameraViewport } from "@/components/signify/CameraViewport";
import { HandTrackingCue } from "@/components/signify/HandTrackingCue";
import { AgentButton, RepairCard, TypingSuggestion } from "@/components/signify/agent";
import {
  Header,
  HeaderIconButton,
  PrimaryButton,
  RoundButton,
  AutoHeight,
  press,
  DUR,
  EASE,
  SPRING_PILL,
} from "@/components/signify/ui";
import { cn } from "@/lib/utils";
import { seo } from "@/lib/seo";

/**
 * One conversation screen, two modes (spec 05–08):
 * - sign: Live · Signing, camera behind everything, captions in a glass sheet (grows for Agent check)
 * - speech: Speech · Start (waveform + Start speaking), then Speech · Conversation (captions panel, listening…)
 */
export type ConversationMode = "sign" | "speech";
export const Route = createFileRoute("/sign")({
  validateSearch: (search: Record<string, unknown>): { mode?: ConversationMode } =>
    search["mode"] === "speech" ? { mode: "speech" } : {},
  head: () =>
    seo("Conversation", "Live sign ⇄ speech conversation with captions and agent repair."),
  component: Conversation,
});

function Conversation() {
  const { mode = "sign" } = Route.useSearch();
  const speech = mode === "speech";
  const s = useSignify();
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const native = useIsNative();

  const [started, setStarted] = useState(false); // Speech · Start → Speech · Conversation
  const [typing, setTyping] = useState(false);
  const showComposer = typing || s.awaitingTyped;
  const empty = s.captions.length === 0;
  const speechLive = speech && (started || !empty);
  const last = s.captions[s.captions.length - 1];
  const hearing = last?.speaker === "other" && !last.final; // the mic is picking up the other person right now

  // Keep the hand on screen while signs come in; fade it ~1.6s after the last one
  const [signingNow, setSigningNow] = useState(false);
  useEffect(() => {
    if (!s.liveSign) {
      setSigningNow(false);
      return;
    }
    setSigningNow(true);
    const t = setTimeout(() => setSigningNow(false), 1600);
    return () => clearTimeout(t);
  }, [s.liveSign]);

  // In the browser, the other person "talks" a moment after Start speaking (natively the mic does this)
  useEffect(() => {
    if (!speech || !started || s.captions.length > 0 || native) return;
    let cancelled = false;
    const words = "Hi! What can I get started for you?".split(" ");
    const timers = words.map((_, i) =>
      setTimeout(
        () => {
          if (!cancelled)
            window.NativeASLBridge?.onSpeechTranscribed({
              text: words.slice(0, i + 1).join(" "),
              isFinal: i === words.length - 1,
            });
        },
        900 + i * 320,
      ),
    );
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [speech, started]); // eslint-disable-line react-hooks/exhaustive-deps

  const exit = () => nav({ to: "/memory", search: { fresh: true } }); // ✕ always goes to Memory: the agent saved it
  const switchMode = (to: ConversationMode) => {
    if (to === mode) return;
    s.cancelTyped();
    setTyping(false);
    nav({ to: "/sign", search: to === "speech" ? { mode: "speech" } : {} });
  };
  const toggleType = () => {
    if (showComposer) {
      s.cancelTyped();
      setTyping(false);
    } else setTyping(true);
  };

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* Background: camera (sign) cross-fades with white / black (speech) over dur.slow */}
      <motion.div
        aria-hidden={speech}
        className="absolute inset-0"
        animate={{ opacity: speech ? 0 : 1 }}
        transition={{ duration: DUR.slow, ease: EASE }}
        initial={false}
      >
        <CameraViewport className="absolute inset-0" label="Native camera" enabled={!speech} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[224px] bg-gradient-to-b from-black/45 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/50 to-transparent"
        />
      </motion.div>
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-background"
        animate={{ opacity: speech ? 1 : 0 }}
        initial={false}
        transition={{ duration: DUR.slow, ease: EASE }}
      />

      <div className="relative z-10 flex flex-1 flex-col">
        <Header
          onCamera={!speech}
          left={
            !speech ? (
              <span className="t-label flex items-center gap-1.5 tracking-[0.1em] text-black dark:text-white">
                <span aria-hidden className="dot-pulse h-2 w-2 rounded-full bg-primary" /> Live
              </span>
            ) : undefined
          }
          right={
            <HeaderIconButton
              icon={X}
              label="End conversation. It's saved to Memory"
              onClick={exit}
              onCamera={!speech}
            />
          }
        />
        <ModeToggle mode={mode} onCamera={!speech} onChange={switchMode} />
        {!speech && (
          <div className="relative z-20 mt-[78px]">
            <CameraControl />
          </div>
        )}

        {/* Right-hand column: agent · sound · type (positions from the spec) */}
        <div className="absolute right-5 top-[160px] z-20 flex flex-col gap-2">
          {(!speech || speechLive) && <AgentButton />}
          {speechLive && (
            <RoundButton
              icon={s.readAloud ? Volume2 : VolumeX}
              label={
                s.readAloud
                  ? "Voice on: your words are spoken out loud. Turn off"
                  : "Voice off. Turn on"
              }
              onClick={() => {
                s.setReadAloud(!s.readAloud);
                toast(
                  s.readAloud
                    ? "Voice off: your words won't be spoken"
                    : "Voice on: your words are spoken out loud",
                );
              }}
            />
          )}
          <RoundButton
            icon={Keyboard}
            size={20}
            label={showComposer ? "Close the keyboard" : "Type a message instead"}
            pressed={showComposer}
            onClick={toggleType}
          />
        </div>

        {speech ? (
          <SpeechMode
            live={speechLive}
            hearing={hearing}
            composer={showComposer ? <Composer onDone={() => setTyping(false)} /> : null}
            onStart={() => setStarted(true)}
          />
        ) : (
          <SignMode
            signingNow={signingNow}
            empty={empty}
            reduce={!!reduce}
            composer={showComposer ? <Composer onDone={() => setTyping(false)} /> : null}
            onType={() => setTyping(true)}
          />
        )}
      </div>
    </div>
  );
}

function useIsNative() {
  const [n, setN] = useState(false);
  useEffect(() => setN(isNativeHost()), []);
  return n;
}

/* ---------------- Mode toggle ---------------- */

/**
 * SIGNING ⇄ SPEECH (same on all four conversation screens). The mint outline slides between pills
 * (layoutId "mode-active", spring.pill) and the swap arrows turn 180°.
 */
function ModeToggle({
  mode,
  onCamera,
  onChange,
}: {
  mode: ConversationMode;
  onCamera: boolean;
  onChange: (m: ConversationMode) => void;
}) {
  const pills: { id: ConversationMode; label: string; icon: typeof Hand; size: number }[] = [
    { id: "sign", label: "Signing", icon: Hand, size: 26 },
    { id: "speech", label: "Speech", icon: AudioLines, size: 22 },
  ];
  return (
    <div
      role="tablist"
      aria-label="Who is talking"
      className="absolute inset-x-5 top-16 z-20 flex items-start justify-between"
    >
      {pills.map((p, i) => {
        const on = mode === p.id;
        return (
          <div key={p.id} className="contents">
            {i === 1 && (
              <motion.span
                aria-hidden
                className="mt-[20px] grid h-[15px] w-[14px] place-items-center"
                animate={{ rotate: mode === "speech" ? 180 : 0 }}
                transition={{ duration: DUR.slow, ease: EASE }}
              >
                <ArrowLeftRight
                  className={cn("h-[14px] w-[14px]", onCamera && "text-black dark:text-white")}
                />
              </motion.span>
            )}
            <div className="flex w-[149px] flex-col items-center">
              <motion.button
                {...press}
                role="tab"
                aria-selected={on}
                aria-label={p.label}
                onClick={() => onChange(p.id)}
                className={cn(
                  "relative grid h-14 w-full place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground",
                  onCamera
                    ? on
                      ? "bg-white/85 backdrop-blur-[24px] dark:bg-black/85"
                      : "border-[0.5px] border-white bg-white/30 backdrop-blur-[24px] dark:bg-white/15"
                    : on
                      ? "bg-surface"
                      : "border-[0.75px] border-black/15 bg-card dark:border-[0.5px] dark:border-white",
                )}
              >
                {on && (
                  <motion.span
                    layoutId="mode-active"
                    transition={SPRING_PILL}
                    className="absolute inset-0 rounded-full border-2 border-primary"
                  />
                )}
                <p.icon
                  className={cn("relative", onCamera && "text-black dark:text-white")}
                  style={{ width: p.size, height: p.size }}
                  aria-hidden
                />
              </motion.button>
              <span
                className={cn(
                  "t-btn mt-1.5",
                  onCamera ? "text-black dark:text-white" : "text-foreground",
                )}
              >
                {p.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Live · Signing ---------------- */

function SignMode({
  signingNow,
  empty,
  composer,
  onType,
  reduce,
}: {
  signingNow: boolean;
  empty: boolean;
  composer: ReactNode;
  onType: () => void;
  reduce: boolean;
}) {
  const s = useSignify();
  const engine = useNativeBridge();
  const status = s.recognitionStatus;
  const [dismissed, setDismissed] = useState<RecognitionStatusPayload | null>(null);
  const statusCard = status && status !== dismissed ? status : null;
  const lost = engine.tracking === "lost";
  const hasSheet =
    !empty || !!s.pending || !!composer || s.suggestTyping || !!statusCard || engine.ttsPlaying;

  return (
    <>
      {/* Hand tracking overlay: on the camera, behind the header, toggle, buttons and sheet */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-[85px] top-[150px] transition-all duration-500",
          empty || signingNow ? "scale-100 opacity-100" : "scale-95 opacity-0",
          lost && "opacity-40",
        )}
      >
        <HandTrackingCue gloss={signingNow ? s.liveSign?.gloss : null} signKey={s.liveSign?.at} />
      </div>

      {/* 18 Hands not in view */}
      <AnimatePresence>
        {lost && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 bottom-[330px] z-20 mx-auto w-fit rounded-[24px] bg-card/85 px-5 py-2.5 text-center backdrop-blur-[24px]"
          >
            <p className="font-label text-[11px] font-semibold">Hands not in view</p>
            <p className="text-[11px] text-ink-2">Move your hands in front of the camera</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1" />

      {/* Captions glass sheet: slides up with the first caption, grows for the agent check */}
      <AnimatePresence>
        {hasSheet && (
          <motion.section
            aria-label="Live captions"
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.9 }}
            className="glass-sheet relative z-10 rounded-t-[24px]"
          >
            <div className="flex justify-center pt-2">
              <span className="h-1 w-10 rounded-full bg-white" />
            </div>
            <AutoHeight>
              <div className="min-h-[269px] px-4 pb-[31px] pt-[45px]">
                <CaptionList variant="live" />
                <div className="mt-[17px] space-y-3 empty:hidden">
                  {s.lastFix && !s.pending && <FixedRow />}
                  {s.pending && <RepairCard onType={onType} />}
                  <TypingSuggestion onType={onType} />
                  {statusCard && !s.pending && (
                    <StatusCard
                      status={statusCard}
                      onDismiss={() => setDismissed(statusCard)}
                      onType={onType}
                    />
                  )}
                  {engine.ttsPlaying && !s.pending && (
                    <InfoCard
                      title="Speaking your message…"
                      body="Your text stays visible. The spoken word is highlighted while it plays."
                    />
                  )}
                  {composer}
                </div>
              </div>
            </AutoHeight>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}

/** Inline undo right after the agent fixes a word. */
function FixedRow() {
  const s = useSignify();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.base, ease: EASE }}
      className="flex h-11 items-center gap-2 rounded-full border-[0.5px] border-line-strong bg-surface pl-4 pr-1.5"
    >
      <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      <p className="min-w-0 flex-1 truncate text-[13px] font-medium">Fixed to “{s.lastFix}”</p>
      <motion.button
        {...press}
        onClick={s.undo}
        className="t-btn flex h-8 items-center gap-1.5 rounded-full bg-card px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Undo2 className="h-3.5 w-3.5" aria-hidden /> Undo
      </motion.button>
    </motion.div>
  );
}

/** 19 / 20: no sign recognized, or recognition unavailable (from the native engine). */
function StatusCard({
  status,
  onDismiss,
  onType,
}: {
  status: RecognitionStatusPayload;
  onDismiss: () => void;
  onType: () => void;
}) {
  const unavailable =
    status.state === "modelUnavailable" || status.state === "confidenceThresholdNotValidated";
  const title = unavailable ? "Sign recognition unavailable" : "No sign recognized";
  const body = unavailable
    ? (status.message ?? "Hand tracking still works, but signs aren't being translated right now.")
    : status.state === "unsupportedGloss"
      ? "That sign is outside the demo vocabulary."
      : (status.message ?? null);
  return (
    <InfoCard title={title} body={body}>
      <div className="mt-2 flex flex-col items-start gap-2">
        <motion.button
          {...press}
          onClick={onDismiss}
          className="t-btn h-[31px] rounded-full border-[1.5px] border-primary bg-card px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {unavailable ? "Retry" : "Try again"}
        </motion.button>
        <motion.button
          {...press}
          onClick={() => {
            onDismiss();
            onType();
          }}
          className="flex h-[31px] items-center gap-2 rounded-full bg-white/60 px-3 font-label text-[11px] dark:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Keyboard className="h-[13px] w-[13px]" aria-hidden /> Type instead
        </motion.button>
      </div>
    </InfoCard>
  );
}

function InfoCard({
  title,
  body,
  children,
}: {
  title: string;
  body?: string | null;
  children?: ReactNode;
}) {
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.base, ease: EASE }}
      className="rounded-[30px] border-[0.5px] border-line-strong bg-surface px-[33px] py-[13px]"
    >
      <p className="flex items-center gap-1.5 font-label text-[11px] font-semibold">
        <Bot className="h-[11px] w-[11px]" aria-hidden /> {title}
      </p>
      {body && <p className="mt-1 text-[11px] leading-[14px] text-ink-2">{body}</p>}
      {children}
    </motion.div>
  );
}

/* ---------------- Speech · Start / Conversation ---------------- */

function SpeechMode({
  live,
  hearing,
  composer,
  onStart,
}: {
  live: boolean;
  hearing: boolean;
  composer: ReactNode;
  onStart: () => void;
}) {
  const engine = useNativeBridge();
  return (
    <>
      {/* Waveform: centered on Start, moves up once the conversation starts */}
      <motion.div
        aria-hidden
        className="absolute inset-x-0 flex justify-center"
        initial={false}
        animate={{ top: live ? 292 : 393 }}
        transition={{ duration: DUR.slow, ease: EASE }}
      >
        <Waveform state={!live ? "ready" : hearing || !engine.ttsPlaying ? "live" : "idle"} />
      </motion.div>

      <div className="flex-1" />

      <AnimatePresence mode="wait" initial={false}>
        {live ? (
          <motion.div
            key="live"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.base, ease: EASE }}
            className="relative px-4 pb-[37px]"
          >
            <section
              aria-label="Captions"
              className="relative rounded-[24px] border-[0.34px] border-ink-2 bg-card/80 px-[17px] pb-[17px] pt-[27px] backdrop-blur-[34px] dark:border-[0.5px] dark:border-white"
            >
              <Bot className="absolute right-4 top-3.5 h-[17px] w-[17px]" aria-hidden />
              <CaptionList variant="speech" />
            </section>
            <div className="mt-3">
              {composer ?? (
                <p role="status" className="py-1 text-center text-[14px] leading-5 text-ink-2">
                  {engine.ttsPlaying && !hearing ? "speaking for you…" : "listening…"}
                </p>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="start" exit={{ opacity: 0 }} className="px-5 pb-[37px]">
            {composer && <div className="mb-3">{composer}</div>}
            <PrimaryButton icon={Mic} onClick={onStart}>
              Start speaking
            </PrimaryButton>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Mint glow wave along the bottom */}
      {live && (
        <div
          aria-hidden
          className="speech-glow pointer-events-none absolute -bottom-3 left-[-172px] h-[42px] w-[734px] opacity-80"
        />
      )}
    </>
  );
}

/** 13 bars, 4px, round caps, mint. Each bar loops on its own period while listening; idle bars settle low. */
function Waveform({ state }: { state: "ready" | "live" | "idle" }) {
  const heights = [14, 24, 18, 33, 22, 30, 16, 28, 33, 20, 26, 14, 22];
  return (
    <div
      className={cn(
        "flex h-[33px] w-[168px] items-center justify-between",
        state === "live" ? "wave-live" : state === "idle" && "wave-idle",
      )}
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className="wave-bar w-1 rounded-full bg-primary"
          style={{
            height: h,
            ["--period" as string]: `${0.9 + ((i * 37) % 50) / 100}s`,
            ["--phase" as string]: `${-i * 0.13}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ---------------- Captions ---------------- */

/** Scrolls to the newest line. New bubbles fade up 12px and scale 0.98 → 1; older ones slide up (layout). */
function CaptionList({ variant }: { variant: "live" | "speech" }) {
  const s = useSignify();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [s.captions]);
  const latestSigned = [...s.captions].reverse().find((c) => c.speaker === "sam" && c.gloss)?.id;
  return (
    <div
      ref={ref}
      aria-live="polite"
      className={cn(
        "flex flex-col overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        variant === "live" ? "max-h-[196px] gap-[17px]" : "max-h-[170px] gap-[10px]",
      )}
    >
      {s.captions.map((c) => (
        <Bubble key={c.id} c={c} variant={variant} showGloss={c.id === latestSigned} />
      ))}
    </div>
  );
}

function Bubble({
  c,
  variant,
  showGloss,
}: {
  c: Caption;
  variant: "live" | "speech";
  showGloss: boolean;
}) {
  const { textScale } = useSignify();
  const mine = c.speaker === "sam";
  const size = 20 * textScale;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: DUR.base, ease: EASE }}
      className={cn("shrink-0", mine ? "self-end" : "self-start")}
    >
      <div
        className={cn(
          variant === "live"
            ? "max-w-[270px] rounded-[30px] px-[30px] py-[14px]"
            : "max-w-[276px] rounded-[24px] px-[17px] py-[12px]",
          mine
            ? "border-[1.5px] border-primary bg-card/40"
            : variant === "live"
              ? "border-[0.5px] border-black/30 dark:border-white"
              : "bg-surface dark:border-[0.5px] dark:border-white",
        )}
      >
        <span className="sr-only">
          {mine ? (c.typed ? "You typed:" : "You signed:") : "They said:"}
        </span>
        {showGloss && c.gloss && (
          <p className="t-label mb-0.5 text-ink-3">
            <span className="sr-only">Signs: </span>
            {c.gloss}
          </p>
        )}
        <p
          style={{ fontSize: size, lineHeight: `${size * 1.375}px` }}
          className={cn("font-medium", !c.final && "opacity-80")}
        >
          {variant === "speech" && !mine && (
            <AudioLines className="mr-1.5 inline h-3 w-3 -translate-y-0.5 text-ink-3" aria-hidden />
          )}
          {mine && c.typed && (
            <Keyboard
              className="mr-1.5 inline h-3.5 w-3.5 -translate-y-0.5 text-ink-3"
              aria-hidden
            />
          )}
          <Words text={c.text} />
        </p>
      </div>
    </motion.div>
  );
}

/** Live text: words appear one by one as they're recognized, each fading in over 120ms. */
function Words({ text }: { text: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{text}</>;
  return (
    <>
      {text.split(" ").map((w, i) => (
        <motion.span
          key={`${i}-${w}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.12 }}
        >
          {i > 0 ? " " : ""}
          {w}
        </motion.span>
      ))}
    </>
  );
}

/* ---------------- Typing ---------------- */

/** Composer (rises like a sheet): pill input + mint send. Sent text becomes your caption bubble. */
function Composer({ onDone }: { onDone: () => void }) {
  const s = useSignify();
  const [draft, setDraft] = useState("");
  return (
    <motion.form
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.9 }}
      className="flex gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        const t = draft.trim();
        if (!t) return;
        if (s.awaitingTyped) s.fixTyped(t);
        else s.say(t, "sam", { typed: true });
        setDraft("");
        onDone();
      }}
    >
      <label htmlFor="typed" className="sr-only">
        Type your message
      </label>
      <input
        id="typed"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={s.awaitingTyped ? "Type the right word…" : "Type your message…"}
        className="h-12 min-w-0 flex-1 rounded-full border border-line bg-card px-5 text-[16px] outline-none placeholder:text-ink-3 focus:border-primary"
      />
      <motion.button
        {...press}
        type="submit"
        aria-label="Send"
        className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
      >
        <ArrowUp className="h-5 w-5" aria-hidden />
      </motion.button>
    </motion.form>
  );
}
