import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  Volume2,
  VolumeX,
  Keyboard,
  ArrowUp,
  Check,
  Undo2,
  Hand,
  AudioLines,
  Mic,
  MicOff,
  Square,
  Pencil,
  Copy,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  useAudioLevels,
  useNativeBridge,
  useSignify,
  type Caption,
  type TTSCue,
} from "@/lib/signify-store";
import { isNativeHost, stopTTSPlayback, triggerSpeechRecognition } from "@/lib/nativeBridge";
import type { RecognitionStatusPayload } from "@/types/nativeBridge";
import { captionsBlocked, speechStatusText } from "@/lib/speechStatus";
import { CameraControl, CameraViewport } from "@/components/signify/CameraViewport";
import { HandTrackingCue } from "@/components/signify/HandTrackingCue";
import { HelpButton } from "@/components/signify/HelpButton";
import { AgentChip, RepairCard, TypingSuggestion } from "@/components/signify/agent";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { seo } from "@/lib/seo";

/** One conversation screen, two modes: "sign" (camera, Sam signs) and "speech" (white, the other person talks, Sam reads). */
export type ConversationMode = "sign" | "speech";
export const Route = createFileRoute("/sign")({
  validateSearch: (search: Record<string, unknown>): { mode?: ConversationMode } =>
    search["mode"] === "speech" ? { mode: "speech" } : {},
  head: () =>
    seo("Conversation", "Live sign ⇄ speech conversation with captions and agent repair."),
  component: ConversationRoute,
});

function ConversationRoute() {
  const { mode = "sign" } = Route.useSearch();
  return <Conversation mode={mode} />;
}

/**
 * One line of the conversation, Google Translate style: your words on the right (mint), theirs on the left (gray).
 * The small icon says how it came in: hand = signed, keyboard = typed, sound = heard by the mic (bars move while they're still talking).
 * Like Google showing the original above the translation, your latest signed line shows the signs it came from
 * ("HELLO I WANT ICED…") above the English. Tap an older line to see its signs again.
 * Your lines get a replay button so the other person can hear them again.
 */
export function Bubble({
  c,
  latest,
  spoken,
}: {
  c: Caption;
  latest: boolean;
  /** UTF-16 range of the word being spoken aloud right now (read-along). */
  spoken?: { location: number; length: number } | null;
}) {
  const mine = c.speaker === "sam";
  const { textScale, readAloud, speakCaption, editCaption } = useSignify();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.text);
  const showGloss = !!c.gloss && (latest || open);
  const SourceIcon = c.typed ? Keyboard : Hand;
  const icon = mine ? (
    <SourceIcon className="h-4 w-4" />
  ) : c.final ? (
    <AudioLines className="h-4 w-4" />
  ) : (
    <LiveBars />
  );
  return (
    <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
      {mine && c.final && (
        <button
          onClick={() => speakCaption(c.id)}
          disabled={!readAloud || editing}
          aria-label={`Speak: ${c.text}`}
          className="mb-1 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted active:scale-95 transition-transform disabled:opacity-40"
        >
          <Volume2 className="h-4 w-4" />
        </button>
      )}
      <div
        onClick={c.gloss && !latest ? () => setOpen(!open) : undefined}
        className={cn(
          "max-w-[85%] rounded-[1.5rem] px-4 py-2.5",
          mine ? "bg-accent" : "bg-muted",
          c.gloss && !latest && "cursor-pointer",
        )}
      >
        <span className="sr-only">
          {mine ? (c.typed ? "You typed:" : "You signed:") : "They said:"}
        </span>
        {showGloss && (
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <span aria-hidden>{icon}</span>
            <span className="sr-only">Signs:</span>
            {c.gloss}
          </p>
        )}
        <p
          style={{ fontSize: `${1.25 * textScale}rem` }}
          className={cn(
            "font-semibold leading-snug",
            mine ? "text-mint-ink" : "text-foreground",
            !c.final && "opacity-70",
          )}
        >
          {!showGloss && (
            <span
              aria-hidden
              className="mr-1.5 inline-flex h-4 translate-y-[1px] items-center align-baseline text-muted-foreground"
            >
              {icon}
            </span>
          )}
          {spoken && spoken.location + spoken.length <= c.text.length ? (
            <>
              {c.text.slice(0, spoken.location)}
              <mark className="rounded bg-mint-ink/25 px-0.5 text-inherit">
                {c.text.slice(spoken.location, spoken.location + spoken.length)}
              </mark>
              {c.text.slice(spoken.location + spoken.length)}
            </>
          ) : (
            c.text
          )}
        </p>
        {c.final && (
          <div className="mt-1 flex flex-wrap gap-1">
            {mine && (
              <button
                type="button"
                aria-label={`Edit: ${c.text}`}
                className="inline-flex min-h-11 items-center gap-1 px-2 text-sm font-semibold"
                onClick={() => {
                  stopTTSPlayback();
                  setDraft(c.text);
                  setEditing(true);
                }}
              >
                <Pencil aria-hidden className="h-4 w-4" /> Edit
              </button>
            )}
            <button
              type="button"
              aria-label={`Copy: ${c.text}`}
              className="inline-flex min-h-11 items-center gap-1 px-2 text-sm font-semibold"
              onClick={async () => {
                try {
                  if (!navigator.clipboard)
                    throw new Error("Clipboard is unavailable on this device.");
                  await navigator.clipboard.writeText(c.text);
                  toast.success("Message copied");
                } catch (error) {
                  console.error("Could not copy message", error);
                  toast.error("Could not copy. Select the message text to copy it.");
                }
              }}
            >
              <Copy aria-hidden className="h-4 w-4" /> Copy
            </button>
          </div>
        )}
        {editing && (
          <form
            className="mt-2 space-y-2"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              if (!draft.trim()) {
                toast.error("Your message cannot be empty.");
                return;
              }
              editCaption(c.id, draft);
              setEditing(false);
            }}
          >
            <label className="block text-sm font-semibold">
              Review your message
              <textarea
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="mt-1 w-full rounded-xl border bg-background p-2 text-foreground"
              />
            </label>
            <button className="min-h-11 px-3 font-semibold" type="submit">
              Save changes
            </button>
            <button className="min-h-11 px-3" type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * Google Translate-style listening light: a hairline of light that casts a soft glow downward,
 * with the status underneath, sitting just above the controls. A shimmer runs along the line;
 * faster while someone is signing or talking, dim while it waits on you.
 */
function ListeningLight({
  status,
  busy,
  waiting,
  light = false,
}: {
  status: string;
  busy: boolean;
  waiting: boolean;
  light?: boolean;
}) {
  return (
    <div
      role="status"
      className={cn(
        "listen-light mb-2 flex flex-col items-center",
        busy && "listen-busy",
        waiting && "listen-waiting",
      )}
    >
      <div aria-hidden className="relative h-7 w-full">
        <span className="listen-cone absolute left-1/2 top-0 h-7 w-full -translate-x-1/2" />
        <span className="listen-line absolute left-1/2 top-0 h-px w-full -translate-x-1/2" />
      </div>
      <span
        className={cn(
          "-mt-3 text-sm font-semibold",
          light ? "text-muted-foreground" : "text-white/90",
        )}
      >
        {status}
        {busy || waiting ? "…" : ""}
      </span>
    </div>
  );
}

function recognitionStatusText(state: RecognitionStatusPayload) {
  switch (state.state) {
    case "modelUnavailable":
      return `Tracking only — sign recognition is unavailable. ${state.message ?? ""}`.trim();
    case "confidenceThresholdNotValidated":
      return `Recognition is disabled until its confidence threshold is validated. ${state.message ?? ""}`.trim();
    case "noResult":
      return `No result. ${state.message ?? "Try the sign again."}`.trim();
    case "unsupportedGloss":
      return "No result. This sign is outside the supported demo vocabulary.";
  }
}

const WAVE_HEIGHTS = [18, 34, 24, 50, 30, 64, 40, 56, 28, 46, 22, 38, 16];

/**
 * Big speech-mode waveform. Natively it follows real loudness: the other person's mic while they talk,
 * the app's own voice (pulsing per spoken word) while it speaks for you. Purely visual, so aria-hidden.
 */
export function VoiceWaveform({
  hearing,
  speaking,
  dim,
  native,
}: {
  hearing: boolean;
  speaking: boolean;
  dim: boolean;
  native: boolean;
}) {
  const levels = useAudioLevels();
  const level = speaking ? levels.tts : levels.mic;
  const live = native ? level > 0.02 || hearing || speaking : hearing || speaking;
  return (
    <div
      aria-hidden
      data-testid="voice-waveform"
      data-level={native ? level.toFixed(2) : undefined}
      className={cn(
        "flex h-24 items-center justify-center gap-1.5 transition-opacity duration-500",
        live || !dim ? "opacity-100" : "opacity-40",
      )}
    >
      {WAVE_HEIGHTS.map((hgt, i) => {
        // Natively: center bars react most, edges least, so it reads as a voice rather than a meter.
        const spread = 0.55 + 0.45 * Math.sin(((i + 1) / (WAVE_HEIGHTS.length + 1)) * Math.PI);
        const height = native
          ? Math.max(8, 8 + (hgt - 8) * Math.min(1, level * 1.6) * spread + (hgt - 8) * 0.12)
          : live
            ? hgt
            : Math.max(8, hgt / 4);
        return (
          <span
            key={i}
            className={cn(
              "w-2 rounded-full",
              speaking ? "bg-mint-ink" : "bg-primary",
              native ? "level-bar" : live && "voice-bar",
            )}
            style={{
              height,
              ...(native ? {} : { animationDelay: `${i * 90}ms`, transition: "height 300ms ease" }),
            }}
          />
        );
      })}
    </div>
  );
}

/** Small level-driven bars for the "speaking for you" pill. */
function SpeakingBars() {
  const { tts } = useAudioLevels();
  const native = isNativeHost();
  return (
    <span aria-hidden className="flex h-5 items-center gap-[3px]">
      {[10, 18, 13, 20, 11].map((h, i) => (
        <span
          key={i}
          className={cn("w-[3px] rounded-full bg-mint-ink", native ? "level-bar" : "voice-bar")}
          style={{
            height: native ? Math.max(4, 4 + (h - 4) * Math.min(1, tts * 1.4)) : h,
            ...(native ? {} : { animationDelay: `${i * 110}ms` }),
          }}
        />
      ))}
    </span>
  );
}

/**
 * Shown whenever the app is speaking out loud (both modes). Deaf users can't hear when to cut it off,
 * so Stop is always one tap away.
 */
export function SpeakingIndicator() {
  return (
    <div className="mx-4 mb-2 flex items-center gap-3 self-center rounded-full bg-accent py-1.5 pl-4 pr-1.5 text-mint-ink shadow-[0_4px_16px_rgba(0,0,0,0.12)] animate-in fade-in">
      <SpeakingBars />
      <span role="status" className="text-sm font-bold">
        Speaking out loud
      </span>
      <button
        onClick={stopTTSPlayback}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-background px-3 text-sm font-bold text-foreground active:scale-95"
      >
        <Square className="h-3.5 w-3.5 fill-current" aria-hidden /> Stop speaking
      </button>
    </div>
  );
}

/** Edge glow when the app starts / stops speaking (pairs with native haptics; replays per cue). */
function TTSCueFlash({ cue }: { cue: TTSCue | null }) {
  if (!cue || Date.now() - cue.key > 1500) return null;
  return (
    <div
      key={cue.key}
      aria-hidden
      data-testid="tts-cue"
      className={cn("tts-cue", cue.kind === "start" ? "tts-cue-start" : "tts-cue-end")}
    />
  );
}

/** Tiny moving sound bars: the mic is hearing them right now. */
function LiveBars() {
  return (
    <span className="flex h-4 items-center gap-[2px]">
      {[8, 14, 10].map((h, i) => (
        <span
          key={i}
          className="voice-bar w-[3px] rounded-full bg-current"
          style={{ height: h, animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}

/** Round glass button that floats on the camera, same look as the home direction pills. */
function GlassButton({
  icon: Icon,
  label,
  onClick,
  light = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  light?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "grid h-11 w-11 place-items-center rounded-full backdrop-blur-md active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40",
        light ? "bg-muted" : "bg-background/85",
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

/** One control in the dark glass bar — same shape and states as the home tab bar. */
function BarToggle({
  icon: Icon,
  label,
  on,
  onClick,
  light = false,
  helpId,
}: {
  icon: LucideIcon;
  label: string;
  on: boolean;
  onClick: () => void;
  light?: boolean;
  helpId?: string;
}) {
  return (
    <button
      id={helpId}
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "flex h-14 flex-col items-center justify-center gap-0.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40",
        light
          ? on
            ? "bg-black/[0.07]"
            : "text-muted-foreground active:bg-black/5"
          : on
            ? "bg-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
            : "text-white/60 active:bg-white/10",
      )}
    >
      <Icon className="h-5 w-5" aria-hidden />
      <span className="text-[11px] font-semibold leading-none">{label}</span>
    </button>
  );
}

/**
 * Conversation, laid out like home: camera fills the screen, controls float on top.
 * Top: close · status · agent. Bottom: one caption card + a dark glass control bar.
 */
export function Conversation({ mode = "sign" }: { mode?: ConversationMode }) {
  const speech = mode === "speech";
  const s = useSignify();
  const engine = useNativeBridge();
  const nav = useNavigate();
  const scroller = useRef<HTMLDivElement>(null);
  // Keep the hand on screen (performing the sign) while signs are coming in; fade it ~1.6s after the last one
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
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [clearing, setClearing] = useState(false);
  const [canUndoClear, setCanUndoClear] = useState(false);
  useEffect(() => {
    if (s.captions.length > 0) setCanUndoClear(false);
  }, [s.captions]);
  // Whole conversation lives in the card; it scrolls and always jumps to the newest line
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [s.captions]);
  const empty = s.captions.length === 0;
  const latestSigned = [...s.captions].reverse().find((c) => c.speaker === "sam" && c.gloss)?.id;
  const last = s.captions[s.captions.length - 1];
  const hearing = last?.speaker === "other" && !last.final; // mic is picking up the other person right now
  // Live captions: the mic only runs in speech mode (permission is asked on first entry, natively)
  const [micOn, setMicOn] = useState(true);
  useEffect(() => {
    if (!speech || !micOn) return;
    triggerSpeechRecognition(true);
    return () => triggerSpeechRecognition(false);
  }, [speech, micOn]);
  // Leaving the conversation stops anything still being spoken
  useEffect(() => () => stopTTSPlayback(), []);
  const readAlongId =
    engine.ttsPlaying && engine.ttsProgress
      ? [...s.captions]
          .reverse()
          .find((c) => c.speaker === "sam" && c.text === engine.ttsProgress?.text)?.id
      : undefined;
  const speechBlocked = captionsBlocked(engine.speechStatus);
  const speechText = speechStatusText(engine.speechStatus, micOn);
  // Speech mode in the browser: the other person "talks" a moment after you arrive (natively the mic does this)
  useEffect(() => {
    if (!speech || s.captions.length > 0 || isNativeHost()) return;
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
        1200 + i * 320,
      ),
    );
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [speech]); // eslint-disable-line react-hooks/exhaustive-deps
  const recognitionStatus = s.recognitionStatus ? recognitionStatusText(s.recognitionStatus) : null;
  const status = speech
    ? engine.ttsPlaying
      ? "Speaking for you"
      : (speechText ??
        (hearing
          ? "They're talking"
          : engine.speechStatus?.onDevice
            ? "Listening · on this device"
            : "Listening"))
    : isNativeHost() && !engine.cameraActive
      ? "Camera off"
      : (recognitionStatus ??
        (hearing
          ? "They're talking"
          : engine.tracking === "lost"
            ? "Show your hands"
            : s.pending
              ? "Checking a sign"
              : engine.ttsPlaying
                ? "Speaking for you"
                : engine.tracking === "tracking"
                  ? "Signing"
                  : "Listening"));

  return (
    <div className="relative flex flex-1 flex-col">
      <TTSCueFlash cue={engine.ttsCue} />
      {/* Full-screen camera with the same scrims as home (speech mode: plain white, like home's Speech side) */}
      {speech && <div aria-hidden className="absolute inset-0 bg-background" />}
      <div className={cn("absolute inset-0", speech && "hidden")}>
        <CameraViewport className="absolute inset-0" label="Native camera" enabled={!speech} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/45 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/50 to-transparent"
        />
      </div>
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 -z-10",
          speech ? "bg-background" : "bg-neutral-900 native-camera-backdrop",
        )}
      />

      <div className="relative z-10 flex flex-1 flex-col">
        {/* Top row mirrors home's header: left · center · right */}
        <header className="grid grid-cols-[44px_1fr_44px] items-start px-4 pt-4 pb-2">
          <div className="flex flex-col items-center gap-2">
            <GlassButton
              light={speech}
              icon={ChevronLeft}
              label={empty ? "Back" : "End conversation and see recap"}
              onClick={() => nav({ to: empty ? "/home" : "/recap" })}
            />
            {speech && (
              <GlassButton
                light
                icon={micOn && !speechBlocked ? Mic : MicOff}
                label={
                  !micOn
                    ? "Mic off. Start listening"
                    : speechBlocked
                      ? "Live captions unavailable. Try again"
                      : "Mic on: their speech becomes captions. Stop listening"
                }
                onClick={() => {
                  if (micOn && speechBlocked) triggerSpeechRecognition(true);
                  else setMicOn(!micOn);
                }}
              />
            )}
          </div>
          <div className="flex justify-center">
            <HelpButton
              className={speech ? "bg-muted" : undefined}
              onStopListening={speech && micOn ? () => setMicOn(false) : undefined}
            />
          </div>
          {/* Right column: agent, and under it the voice on/off (a setting, not a mode) */}
          <div className="flex flex-col items-center gap-2">
            <AgentChip {...(speech ? { className: "bg-muted" } : {})} />
            <GlassButton
              light={speech}
              icon={s.readAloud ? Volume2 : VolumeX}
              label={
                s.readAloud
                  ? "Voice available: tap Speak on a reviewed message. Mute"
                  : "Voice off. Turn on"
              }
              onClick={() => {
                s.setReadAloud(!s.readAloud);
                toast(
                  s.readAloud
                    ? "Voice off: your words won't be spoken"
                    : "Voice available: review your message, then tap Speak",
                );
              }}
            />
          </div>
        </header>
        {!speech && <CameraControl />}

        {/* Center: hand cue (sign mode) or voice bars (speech mode), same as the home screen */}
        <div className="relative flex flex-1 items-center justify-center">
          {speech ? (
            <VoiceWaveform
              hearing={hearing}
              speaking={engine.ttsPlaying}
              dim={!empty}
              native={isNativeHost()}
            />
          ) : (
            <div
              className={cn(
                "transition-all duration-500",
                empty || signingNow ? "scale-100 opacity-100" : "scale-90 opacity-0",
              )}
            >
              <HandTrackingCue
                gloss={signingNow ? s.liveSign?.gloss : null}
                signKey={s.liveSign?.at}
              />
            </div>
          )}
        </div>

        {/* Caption card: hidden until something is said, then slides up */}
        {(!empty || typing || s.pending || s.suggestTyping) && (
          <section
            aria-label="Live captions"
            className={cn(
              "mx-4 mb-3 rounded-[2rem] bg-background transition-[border-color,box-shadow] duration-300 animate-in fade-in slide-in-from-bottom-4",
              speech
                ? "border border-foreground/10 shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
                : "border border-transparent shadow-[0_8px_30px_rgba(0,0,0,0.18)]",
              empty ? "p-3" : "px-4 py-4",
            )}
          >
            <div
              ref={scroller}
              aria-live="polite"
              className="max-h-56 space-y-3 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_bottom,transparent,black_20px)] pt-2"
            >
              {s.captions.map((c) => (
                <Bubble
                  key={c.id}
                  c={c}
                  latest={c.id === latestSigned}
                  spoken={c.id === readAlongId ? engine.ttsProgress : null}
                />
              ))}
            </div>
            {s.captions.some((c) => c.speaker === "sam" && c.final) && (
              <p className="mt-2 text-sm text-muted-foreground">
                Review your message, then tap Speak. Saving does not play audio.
              </p>
            )}

            {!empty && (
              <AlertDialog open={clearing} onOpenChange={setClearing}>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-semibold"
                  >
                    <Trash2 aria-hidden className="h-4 w-4" /> Clear transcript
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogTitle>Clear transcript?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Clear all messages? Playback will stop. You can undo this.
                  </AlertDialogDescription>
                  <AlertDialogCancel>Keep messages</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      s.clearCaptions();
                      setCanUndoClear(true);
                    }}
                  >
                    Clear all messages
                  </AlertDialogAction>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Inline undo right after the agent fixes a word */}
            {s.lastFix && !s.pending && (
              <div className="mt-3 flex items-center gap-2 rounded-full bg-muted py-1.5 pl-4 pr-1.5">
                <Check className="h-4 w-4 shrink-0 text-mint-ink" aria-hidden />
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                  Fixed to “{s.lastFix}”
                </p>
                <button
                  onClick={s.undo}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-background px-3 text-sm font-bold active:scale-95"
                >
                  <Undo2 className="h-4 w-4" /> Undo
                </button>
              </div>
            )}

            {(s.pending || s.suggestTyping || typing) && (
              <div className={cn("space-y-3", !empty && "mt-3")}>
                <RepairCard onType={() => setTyping(true)} />
                <TypingSuggestion onType={() => setTyping(true)} />
                {typing && (
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (draft.trim()) {
                        if (s.awaitingTyped) s.fixTyped(draft);
                        else s.say(draft.trim(), "sam", { typed: true });
                        setDraft("");
                        setTyping(false);
                      }
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
                      className="h-12 min-w-0 flex-1 rounded-full border border-foreground/15 bg-background px-5 text-lg outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/30"
                    />
                    <button
                      type="submit"
                      aria-label="Save message for review"
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary active:scale-95"
                    >
                      <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
                    </button>
                  </form>
                )}
              </div>
            )}
          </section>
        )}

        {canUndoClear && (
          <button
            type="button"
            className="mx-4 mb-2 min-h-11 self-center rounded-full bg-background px-4 font-semibold"
            onClick={() => {
              s.undo();
              setCanUndoClear(false);
            }}
          >
            Undo clear
          </button>
        )}
        {engine.ttsPlaying && <SpeakingIndicator />}

        {/* Hidden while typing: hands are on the keyboard, not signing */}
        {(!typing || speech) && (
          <ListeningLight
            light={speech}
            status={status}
            busy={hearing || signingNow || engine.ttsPlaying}
            waiting={
              speech
                ? engine.speechStatus?.state === "preparing"
                : !!s.pending || engine.tracking === "lost"
            }
          />
        )}

        {/* Dark glass control bar, same as the home tab bar */}
        {/* Glass control bar: dark over the camera, light on white (same as the home tab bar) */}
        <nav
          aria-label="Conversation controls"
          className={cn(
            "mx-4 mb-4 grid grid-cols-3 rounded-full border p-1.5 backdrop-blur-xl backdrop-saturate-150",
            speech
              ? "border-black/5 bg-white/85 text-foreground shadow-[0_8px_30px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.06)]"
              : "border-white/15 bg-neutral-900/80 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_30px_rgba(0,0,0,0.25)]",
          )}
        >
          {/* Same bar in both modes: the mode you're in is highlighted (gray = you are here), the other is one tap away */}
          <BarToggle
            light={speech}
            icon={Hand}
            label="Signing"
            on={!speech}
            onClick={() => {
              if (speech) {
                setTyping(false);
                nav({ to: "/sign", search: {} });
              }
            }}
          />
          <BarToggle
            light={speech}
            icon={Keyboard}
            label="Type"
            helpId="help-control-type"
            on={typing}
            onClick={() => {
              if (typing) s.cancelTyped();
              setTyping(!typing);
            }}
          />
          <BarToggle
            light={speech}
            icon={AudioLines}
            label="Speech"
            on={speech}
            onClick={() => {
              if (!speech) {
                s.cancelTyped();
                setTyping(false);
                nav({ to: "/sign", search: { mode: "speech" } });
              }
            }}
          />
        </nav>
      </div>
    </div>
  );
}
