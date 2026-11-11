import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type {
  Alternative,
  AudioLevelPayload,
  EngineStatusPayload,
  NativeASLBridge,
  NativeErrorPayload,
  RecognitionStatusPayload,
  SentenceTranslatedPayload,
  SignDetectedPayload,
  SpeechRecognitionStatusPayload,
  SpeechTranscribedPayload,
  TrackingState,
  TTSProgressPayload,
} from "@/types/nativeBridge";
import {
  isNativeHost,
  stopTTSPlayback,
  triggerAvatarReplay,
  triggerCameraToggle,
  triggerSpeechRecognition,
  triggerTTSPlayback,
} from "@/lib/nativeBridge";

export type Alt = Alternative;
export type SignEvent = Pick<SignDetectedPayload, "gloss" | "confidence"> &
  Partial<Omit<SignDetectedPayload, "gloss" | "confidence">>;
export type Speaker = "sam" | "other";
/** gloss = the signs it came from (e.g. "HELLO I WANT ICED OAT-MILK LATTE"); typed = came from the keyboard, not signing. */
export type Caption = {
  id: number;
  speaker: Speaker;
  text: string;
  final: boolean;
  gloss?: string;
  typed?: boolean;
};
export type SayExtra = { gloss?: string; typed?: boolean };
export type Correction = { heard: string; meant: string };
export type AgentStep = "translate" | "check" | "repair" | "recap";
/** UI feedback state shown to the user (listening / translating / checking / speaking). */
export type EngineStatus = "idle" | "listening" | "translating" | "checking" | "speaking";
export type Tracking = TrackingState;

type Snapshot = { captions: Caption[]; corrections: Correction[] };

export const DEFAULT_THRESHOLD = 0.75;
export const STREAK_LIMIT = 3;

/** Pure decision used by the agent; exported for tests. */
export function decideSign(
  sign: Pick<SignDetectedPayload, "gloss" | "confidence">,
  threshold: number,
  corrections: Correction[],
  paused: boolean,
) {
  const learned = corrections.find((c) => c.heard.toLowerCase() === sign.gloss.toLowerCase());
  if (learned) return { kind: "learned" as const, text: learned.meant };
  if (paused || sign.confidence >= threshold) return { kind: "accept" as const, text: sign.gloss };
  return { kind: "repair" as const, text: sign.gloss };
}

/* ---------- Audio levels: ~15 Hz updates kept outside React state so only the waveform re-renders ---------- */

type AudioLevels = { mic: number; tts: number };
let audioLevels: AudioLevels = { mic: 0, tts: 0 };
const audioListeners = new Set<() => void>();
function setAudioLevel(source: keyof AudioLevels, level: number) {
  const v = Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0));
  if (audioLevels[source] === v) return;
  audioLevels = { ...audioLevels, [source]: v };
  audioListeners.forEach((l) => l());
}
function subscribeAudioLevels(listener: () => void) {
  audioListeners.add(listener);
  return () => {
    audioListeners.delete(listener);
  };
}
const getAudioLevels = () => audioLevels;

/** Live loudness (0–1) of the hearing person's mic and of the app's own voice, for the visual waveform. */
export function useAudioLevels(): AudioLevels {
  return useSyncExternalStore(subscribeAudioLevels, getAudioLevels, getAudioLevels);
}

/** Start / end of the app speaking aloud. `key` changes on every transition so the visual cue can replay. */
export type TTSCue = { kind: "start" | "end"; key: number };

/* ---------- Engine context: high-frequency native status, kept separate so it doesn't re-render conversation UI ---------- */

type EngineCtx = {
  cameraActive: boolean;
  tracking: Tracking;
  latencyMs: number;
  ttsPlaying: boolean;
  /** The word being spoken right now (for read-along highlighting). */
  ttsProgress: TTSProgressPayload | null;
  ttsCue: TTSCue | null;
  /** Live-caption (mic) state; null until speech mode has been entered. */
  speechStatus: SpeechRecognitionStatusPayload | null;
  devPreview: boolean;
  setDevPreview: (v: boolean) => void;
  triggerCameraToggle: typeof triggerCameraToggle;
  triggerTTSPlayback: typeof triggerTTSPlayback;
  stopTTSPlayback: typeof stopTTSPlayback;
  triggerSpeechRecognition: typeof triggerSpeechRecognition;
  triggerAvatarReplay: typeof triggerAvatarReplay;
};
const EngineContext = createContext<EngineCtx | null>(null);

/* ---------- Conversation context: captions + agent ---------- */

type Ctx = {
  captions: Caption[];
  pending: SignEvent | null;
  streak: number;
  suggestTyping: boolean;
  threshold: number;
  paused: boolean;
  corrections: Correction[];
  step: AgentStep;
  lastAction: { text: string; reason: string } | null;
  engine: EngineStatus;
  /** Mirrors engine tracking for screens that show it next to captions. */
  tracking: Tracking;
  recognitionStatus: RecognitionStatusPayload | null;
  readAloud: boolean;
  setReadAloud: (v: boolean) => void;
  /** Add a finished sentence from the UI (typing, quick replies). Speaks it if read-aloud is on. */
  say: (text: string, speaker?: Speaker, extra?: SayExtra) => void;
  /** Caption text size multiplier (1 = default). */
  textScale: number;
  setTextScale: (v: number) => void;
  /** Agent panel open (so other parts of the screen can open it). */
  /** The sign the camera is seeing right now (for the live hand animation). at = when it arrived. */
  liveSign: { gloss: string; at: number } | null;
  agentOpen: boolean;
  setAgentOpen: (v: boolean) => void;
  addCaption: (speaker: Speaker, text: string, final?: boolean) => void;
  resolveRepair: (meant: string | null) => void;
  dismissTyping: () => void;
  undo: () => void;
  override: (text: string) => void;
  /** The word the agent most recently fixed (repair pick or learned swap) — shows the inline Undo. Cleared when the sentence completes. */
  lastFix: string | null;
  /** True after "Type the right word" until the word is sent (or typing is closed). */
  awaitingTyped: boolean;
  fixTyped: (word: string) => void;
  cancelTyped: () => void;
  setThreshold: (n: number) => void;
  setPaused: (b: boolean) => void;
  setStep: (s: AgentStep) => void;
  reset: () => void;
} & NativeASLBridge;

const SignifyCtx = createContext<Ctx | null>(null);
let nextId = 1;

export function SignifyProvider({ children }: { children: ReactNode }) {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [pending, setPending] = useState<SignEvent | null>(null);
  const [streak, setStreak] = useState(0);
  const [suggestTyping, setSuggestTyping] = useState(false);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [paused, setPaused] = useState(false);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [step, setStep] = useState<AgentStep>("translate");
  const [lastAction, setLastAction] = useState<Ctx["lastAction"]>(null);
  const [lastFix, setLastFix] = useState<string | null>(null);
  const [engine, setEngine] = useState<EngineStatus>("idle");
  const [readAloud, setReadAloud] = useState(true);
  const [textScale, setTextScale] = useState(1);
  const [agentOpen, setAgentOpen] = useState(false);
  const [liveSign, setLiveSign] = useState<{ gloss: string; at: number } | null>(null);
  // engine (native) state
  const [cameraActive, setCameraActive] = useState(false);
  const [tracking, setTracking] = useState<Tracking>("idle");
  const [recognitionStatus, setRecognitionStatus] = useState<RecognitionStatusPayload | null>(null);
  const [latencyMs, setLatencyMs] = useState(0);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsProgress, setTtsProgress] = useState<TTSProgressPayload | null>(null);
  const [ttsCue, setTtsCue] = useState<TTSCue | null>(null);
  const [speechStatus, setSpeechStatus] = useState<SpeechRecognitionStatusPayload | null>(null);
  const [devPreview, setDevPreview] = useState(false);

  const history = useRef<Snapshot[]>([]);
  const state = useRef({ captions, corrections, threshold, paused, streak, readAloud });
  state.current = { captions, corrections, threshold, paused, streak, readAloud };

  const snapshot = () =>
    history.current.push({
      captions: state.current.captions,
      corrections: state.current.corrections,
    });

  const appendSam = useCallback((word: string) => {
    setCaptions((cs) => {
      const last = cs[cs.length - 1];
      if (last && last.speaker === "sam" && !last.final) {
        return [...cs.slice(0, -1), { ...last, text: `${last.text} ${word}`.trim() }];
      }
      return [...cs, { id: nextId++, speaker: "sam", text: word, final: false }];
    });
  }, []);

  const onSignDetected = useCallback(
    (s: SignDetectedPayload) => {
      const { threshold, corrections, paused, streak } = state.current;
      setRecognitionStatus(null);
      setTracking("tracking");
      setLiveSign({ gloss: s.gloss, at: Date.now() });
      setEngine("checking");
      setStep("check");
      const d = decideSign(s, threshold, corrections, paused);
      if (d.kind === "repair") {
        const n = streak + 1;
        setStreak(n);
        setPending(s);
        setStep("repair");
        if (n >= STREAK_LIMIT) setSuggestTyping(true);
        const alt = s.alternatives?.[0];
        setLastAction({
          text: `Paused captions to confirm “${s.gloss.toLowerCase()}”`,
          reason: `${Math.round(s.confidence * 100)}% confident${alt ? ` · could also be “${alt.gloss.toLowerCase()}” (${Math.round(alt.confidence * 100)}%)` : ""} · below ${Math.round(threshold * 100)}% threshold`,
        });
        return;
      }
      snapshot();
      appendSam(d.text.toLowerCase());
      setStreak(0);
      setStep("translate");
      setEngine("translating");
      if (d.kind === "learned") setLastFix(d.text.toLowerCase());
      setLastAction(
        d.kind === "learned"
          ? {
              text: `Swapped “${s.gloss.toLowerCase()}” for “${d.text.toLowerCase()}”`,
              reason: "Used a learned correction",
            }
          : {
              text: `Added “${s.gloss.toLowerCase()}”`,
              reason: paused
                ? "Agent is off, so nothing was checked"
                : `${Math.round(s.confidence * 100)}% confident`,
            },
      );
    },
    [appendSam],
  );

  const say = useCallback((text: string, speaker: Speaker = "sam", extra: SayExtra = {}) => {
    snapshot();
    setLastFix(null);
    setCaptions((cs) => {
      const last = cs[cs.length - 1];
      const base = last && last.speaker === speaker && !last.final ? cs.slice(0, -1) : cs;
      return [...base, { id: nextId++, speaker, text, final: true, ...extra }];
    });
    const speak = speaker === "sam" && state.current.readAloud;
    if (speak) triggerTTSPlayback(text);
    setEngine(speak ? "speaking" : "listening");
    setStep("translate");
    setLastAction({
      text:
        speaker === "sam"
          ? "Turned signs into an English sentence"
          : "Captioned the hearing person",
      reason: "Sentence complete",
    });
  }, []);

  const onSentenceTranslated = useCallback(
    ({ naturalEnglish, rawGloss }: SentenceTranslatedPayload) =>
      say(naturalEnglish, "sam", { gloss: rawGloss }),
    [say],
  );

  const onEngineStatusChange = useCallback((st: EngineStatusPayload) => {
    setCameraActive(st.cameraActive);
    setTracking(st.trackingState);
    setLatencyMs(st.inferenceLatencyMs);
    if (!st.cameraActive) setRecognitionStatus(null);
    if (st.trackingState === "lost")
      setLastAction({
        text: "Hands out of view",
        reason: "Can't see your hands, waiting for them",
      });
    if (!st.cameraActive) setEngine("idle");
    else setEngine((e) => (e === "idle" ? "listening" : e));
  }, []);

  const onRecognitionStatusChange = useCallback((status: RecognitionStatusPayload) => {
    setRecognitionStatus(status);
  }, []);

  const onNativeError = useCallback(({ feature, message }: NativeErrorPayload) => {
    console.error(`[NativeASLBridge: ${feature}]`, message);
    toast.error(message);
  }, []);

  // The hearing person talking into the mic: partial words stream into one "Barista" bubble, then it finalizes.
  const ttsOn = useRef(false);
  const onSpeechTranscribed = useCallback(({ text, isFinal }: SpeechTranscribedPayload) => {
    if (ttsOn.current) return; // never caption the app's own voice
    addCaptionRef.current("other", text, isFinal);
    setEngine(isFinal ? "listening" : "translating");
  }, []);

  const ttsPulse = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTTSPlaybackState = useCallback((isPlaying: boolean) => {
    const changed = ttsOn.current !== isPlaying;
    ttsOn.current = isPlaying;
    setTtsPlaying(isPlaying);
    setEngine(isPlaying ? "speaking" : "listening");
    if (!isPlaying) {
      setTtsProgress(null);
      setAudioLevel("tts", 0);
    }
    if (!changed) return;
    setTtsCue({ kind: isPlaying ? "start" : "end", key: Date.now() });
    // Native plays haptics itself; in a browser, vibrate where supported so the start/end is still felt.
    if (!isNativeHost() && typeof navigator !== "undefined" && "vibrate" in navigator)
      navigator.vibrate(isPlaying ? 60 : [40, 60, 40]);
  }, []);

  // Each spoken word pulses the waveform so Deaf users can see the app's voice moving.
  const onTTSProgress = useCallback((p: TTSProgressPayload) => {
    if (!ttsOn.current) return;
    setTtsProgress(p);
    setAudioLevel("tts", 0.55 + Math.min(0.45, p.length / 20));
    if (ttsPulse.current) clearTimeout(ttsPulse.current);
    ttsPulse.current = setTimeout(() => setAudioLevel("tts", ttsOn.current ? 0.2 : 0), 180);
  }, []);

  const onAudioLevel = useCallback(({ source, level }: AudioLevelPayload) => {
    setAudioLevel(source === "tts" ? "tts" : "mic", level);
  }, []);

  const onSpeechRecognitionStatusChange = useCallback((st: SpeechRecognitionStatusPayload) => {
    setSpeechStatus(st);
    if (st.state !== "listening") setAudioLevel("mic", 0);
  }, []);

  useEffect(
    () => () => {
      if (ttsPulse.current) clearTimeout(ttsPulse.current);
    },
    [],
  );

  const addCaption = useCallback((speaker: Speaker, text: string, final = true) => {
    snapshot();
    setCaptions((cs) => {
      const last = cs[cs.length - 1];
      if (!final && last && last.speaker === speaker && !last.final)
        return [...cs.slice(0, -1), { ...last, text }];
      if (final && last && last.speaker === speaker && !last.final)
        return [...cs.slice(0, -1), { ...last, text, final: true }];
      return [...cs, { id: nextId++, speaker, text, final }];
    });
  }, []);

  const addCaptionRef = useRef(addCaption);
  addCaptionRef.current = addCaption;

  const resolveRepair = useCallback(
    (meant: string | null) => {
      const p = pending;
      if (!p) return;
      setPending(null);
      if (meant === null) {
        typedFor.current = p; // remember which sign they're fixing by typing
        setAwaitingTyped(true);
        setSuggestTyping(true);
        setLastAction({
          text: "Signer chose to type instead",
          reason: "None of the options were right",
        });
        return;
      }
      snapshot();
      appendSam(meant.toLowerCase());
      if (meant.toLowerCase() !== p.gloss.toLowerCase()) {
        setCorrections((c) => [{ heard: p.gloss, meant }, ...c.filter((x) => x.heard !== p.gloss)]);
        toast.success("Got it, I'll remember that");
      } else {
        toast.success(`Confirmed “${meant.toLowerCase()}”`);
      }
      setStreak(0);
      setStep("translate");
      setLastFix(meant.toLowerCase());
      setLastAction({ text: `Confirmed “${meant.toLowerCase()}”`, reason: "Signer picked it" });
    },
    [pending, appendSam],
  );

  // "Type the right word": the typed word joins the sentence in progress (it doesn't replace it) and is learned like a pick
  const typedFor = useRef<SignEvent | null>(null);
  const [awaitingTyped, setAwaitingTyped] = useState(false);
  const fixTyped = useCallback(
    (word: string) => {
      const p = typedFor.current;
      const w = word.trim().toLowerCase();
      typedFor.current = null;
      setAwaitingTyped(false);
      if (!w) return;
      snapshot();
      appendSam(w);
      if (p && w !== p.gloss.toLowerCase()) {
        setCorrections((c) => [
          { heard: p.gloss, meant: w },
          ...c.filter((x) => x.heard !== p.gloss),
        ]);
        toast.success("Got it, I'll remember that");
      }
      setStreak(0);
      setStep("translate");
      setLastFix(w);
      setLastAction({ text: `Used “${w}”`, reason: "You typed the right word" });
    },
    [appendSam],
  );
  const cancelTyped = useCallback(() => {
    typedFor.current = null;
    setAwaitingTyped(false);
  }, []);

  const undo = useCallback(() => {
    const prev = history.current.pop();
    if (!prev) {
      toast("Nothing to undo");
      return;
    }
    setCaptions(prev.captions);
    setCorrections(prev.corrections);
    setLastFix(null);
    setLastAction({ text: "Undid the last change", reason: "You asked to undo" });
  }, []);

  const override = useCallback((text: string) => {
    snapshot();
    setCaptions((cs) => {
      const idx = [...cs].reverse().findIndex((c) => c.speaker === "sam");
      if (idx === -1) return [...cs, { id: nextId++, speaker: "sam", text, final: true }];
      const i = cs.length - 1 - idx;
      return cs.map((c, j) => (j === i ? { ...c, text, final: true } : c));
    });
    setLastAction({ text: "Caption replaced", reason: "You overrode the agent" });
  }, []);

  const reset = useCallback(() => {
    history.current = [];
    setCaptions([]);
    setPending(null);
    setStreak(0);
    setSuggestTyping(false);
    setRecognitionStatus(null);
    setStep("translate");
    setLastAction(null);
    setLastFix(null);
    setLiveSign(null);
    typedFor.current = null;
    setAwaitingTyped(false);
    setEngine("idle");
    setTracking("idle");
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      captions,
      pending,
      streak,
      suggestTyping,
      threshold,
      paused,
      corrections,
      step,
      lastAction,
      lastFix,
      engine,
      tracking,
      recognitionStatus,
      readAloud,
      setReadAloud,
      awaitingTyped,
      fixTyped,
      cancelTyped,
      textScale,
      setTextScale,
      liveSign,
      agentOpen,
      setAgentOpen,
      say,
      onSignDetected,
      onSentenceTranslated,
      onEngineStatusChange,
      onRecognitionStatusChange,
      onNativeError,
      onTTSPlaybackState,
      onSpeechTranscribed,
      onSpeechRecognitionStatusChange,
      onAudioLevel,
      onTTSProgress,
      addCaption,
      resolveRepair,
      dismissTyping: () => {
        setSuggestTyping(false);
        setStreak(0);
      },
      undo,
      override,
      setThreshold,
      setPaused,
      setStep,
      reset,
    }),
    [
      awaitingTyped,
      fixTyped,
      cancelTyped,
      liveSign,
      agentOpen,
      textScale,
      captions,
      pending,
      streak,
      suggestTyping,
      threshold,
      paused,
      corrections,
      step,
      lastAction,
      lastFix,
      engine,
      tracking,
      recognitionStatus,
      readAloud,
      say,
      onSignDetected,
      onSentenceTranslated,
      onEngineStatusChange,
      onRecognitionStatusChange,
      onNativeError,
      onTTSPlaybackState,
      onSpeechTranscribed,
      onSpeechRecognitionStatusChange,
      onAudioLevel,
      onTTSProgress,
      addCaption,
      resolveRepair,
      undo,
      override,
      reset,
    ],
  );

  const engineValue = useMemo<EngineCtx>(
    () => ({
      cameraActive,
      tracking,
      latencyMs,
      ttsPlaying,
      ttsProgress,
      ttsCue,
      speechStatus,
      devPreview,
      setDevPreview,
      triggerCameraToggle,
      triggerTTSPlayback,
      stopTTSPlayback,
      triggerSpeechRecognition,
      triggerAvatarReplay,
    }),
    [cameraActive, tracking, latencyMs, ttsPlaying, ttsProgress, ttsCue, speechStatus, devPreview],
  );

  useEffect(() => {
    if (isNativeHost()) document.documentElement.setAttribute("data-native-host", "");
  }, []);

  useEffect(() => {
    window.NativeASLBridge = {
      onSignDetected,
      onSentenceTranslated,
      onEngineStatusChange,
      onRecognitionStatusChange,
      onNativeError,
      onTTSPlaybackState,
      onSpeechTranscribed,
      onSpeechRecognitionStatusChange,
      onAudioLevel,
      onTTSProgress,
    };
  }, [
    onSignDetected,
    onSentenceTranslated,
    onEngineStatusChange,
    onRecognitionStatusChange,
    onNativeError,
    onTTSPlaybackState,
    onSpeechTranscribed,
    onSpeechRecognitionStatusChange,
    onAudioLevel,
    onTTSProgress,
  ]);

  return (
    <EngineContext.Provider value={engineValue}>
      <SignifyCtx.Provider value={value}>{children}</SignifyCtx.Provider>
    </EngineContext.Provider>
  );
}

/** Conversation + agent state. */
export function useSignify() {
  const c = useContext(SignifyCtx);
  if (!c) throw new Error("useSignify outside provider");
  return c;
}

/** Native engine status (camera, tracking, latency, TTS) and outbound commands to Swift. */
export function useNativeBridge() {
  const c = useContext(EngineContext);
  if (!c) throw new Error("useNativeBridge outside provider");
  return c;
}
