import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

export type Alt = { gloss: string; confidence: number };
export type SignEvent = { gloss: string; confidence: number; alternatives?: Alt[]; isFinal?: boolean; timestamp?: number };
export type Speaker = "sam" | "other";
export type Caption = { id: number; speaker: Speaker; text: string; final: boolean };
export type Correction = { heard: string; meant: string };
export type AgentStep = "translate" | "check" | "repair" | "recap";
export type EngineStatus = "idle" | "listening" | "translating" | "checking" | "speaking";
export type Tracking = "idle" | "tracking" | "lost";

type Snapshot = { captions: Caption[]; corrections: Correction[] };

export const DEFAULT_THRESHOLD = 0.75;
export const STREAK_LIMIT = 3;

/** Pure decision used by the agent; exported for tests. */
export function decideSign(sign: SignEvent, threshold: number, corrections: Correction[], paused: boolean) {
  const learned = corrections.find((c) => c.heard.toLowerCase() === sign.gloss.toLowerCase());
  if (learned) return { kind: "learned" as const, text: learned.meant };
  if (paused || sign.confidence >= threshold) return { kind: "accept" as const, text: sign.gloss };
  return { kind: "repair" as const, text: sign.gloss };
}

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
  tracking: Tracking;
  tts: "idle" | "playing";
  readAloud: boolean;
  setReadAloud: (v: boolean) => void;
  onSignDetected: (s: SignEvent) => void;
  onSentenceTranslated: (p: { text: string; speaker?: Speaker }) => void;
  onEngineStatusChange: (s: EngineStatus | Tracking) => void;
  onTTSPlaybackState: (s: "idle" | "playing") => void;
  addCaption: (speaker: Speaker, text: string, final?: boolean) => void;
  resolveRepair: (meant: string | null) => void;
  dismissTyping: () => void;
  undo: () => void;
  override: (text: string) => void;
  setThreshold: (n: number) => void;
  setPaused: (b: boolean) => void;
  setStep: (s: AgentStep) => void;
  reset: () => void;
};

const SignifyCtx = createContext<Ctx | null>(null);
let nextId = 1;

declare global {
  interface Window {
    NativeASLBridge?: Pick<Ctx, "onSignDetected" | "onSentenceTranslated" | "onEngineStatusChange" | "onTTSPlaybackState">;
  }
}

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
  const [engine, setEngine] = useState<EngineStatus>("idle");
  const [tracking, setTracking] = useState<Tracking>("idle");
  const [tts, setTts] = useState<"idle" | "playing">("idle");
  const [readAloud, setReadAloud] = useState(true);
  const history = useRef<Snapshot[]>([]);
  const state = useRef({ captions, corrections, threshold, paused, streak });
  state.current = { captions, corrections, threshold, paused, streak };

  const snapshot = () => history.current.push({ captions: state.current.captions, corrections: state.current.corrections });

  const appendSam = useCallback((word: string) => {
    setCaptions((cs) => {
      const last = cs[cs.length - 1];
      if (last && last.speaker === "sam" && !last.final) {
        return [...cs.slice(0, -1), { ...last, text: `${last.text} ${word}`.trim() }];
      }
      return [...cs, { id: nextId++, speaker: "sam", text: word, final: false }];
    });
  }, []);

  const onSignDetected = useCallback((s: SignEvent) => {
    const { threshold, corrections, paused, streak } = state.current;
    setTracking("tracking");
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
    setLastAction(
      d.kind === "learned"
        ? { text: `Swapped “${s.gloss.toLowerCase()}” for “${d.text.toLowerCase()}”`, reason: "Used a learned correction" }
        : { text: `Added “${s.gloss.toLowerCase()}”`, reason: paused ? "Agent paused — no checking" : `${Math.round(s.confidence * 100)}% confident` },
    );
  }, [appendSam]);

  const onSentenceTranslated = useCallback(({ text, speaker = "sam" }: { text: string; speaker?: Speaker }) => {
    snapshot();
    setCaptions((cs) => {
      const last = cs[cs.length - 1];
      const base = last && last.speaker === speaker && !last.final ? cs.slice(0, -1) : cs;
      return [...base, { id: nextId++, speaker, text, final: true }];
    });
    setEngine(speaker === "sam" && readAloud ? "speaking" : "listening");
    setStep("translate");
    setLastAction({ text: speaker === "sam" ? "Turned signs into an English sentence" : "Captioned the hearing person", reason: "Sentence complete" });
  }, [readAloud]);

  const onEngineStatusChange = useCallback((s: EngineStatus | Tracking) => {
    if (s === "tracking" || s === "lost") {
      setTracking(s);
      if (s === "lost") setLastAction({ text: "Hands out of view", reason: "Tracking lost — waiting for hands" });
    } else if (s === "idle") {
      setEngine("idle");
      setTracking("idle");
    } else setEngine(s);
  }, []);

  const addCaption = useCallback((speaker: Speaker, text: string, final = true) => {
    snapshot();
    setCaptions((cs) => {
      const last = cs[cs.length - 1];
      if (!final && last && last.speaker === speaker && !last.final) return [...cs.slice(0, -1), { ...last, text }];
      if (final && last && last.speaker === speaker && !last.final) return [...cs.slice(0, -1), { ...last, text, final: true }];
      return [...cs, { id: nextId++, speaker, text, final }];
    });
  }, []);

  const resolveRepair = useCallback((meant: string | null) => {
    const p = pending;
    if (!p) return;
    setPending(null);
    if (meant === null) {
      setSuggestTyping(true);
      setLastAction({ text: "Signer chose to type instead", reason: "None of the options were right" });
      return;
    }
    snapshot();
    appendSam(meant.toLowerCase());
    if (meant.toLowerCase() !== p.gloss.toLowerCase()) {
      setCorrections((c) => [{ heard: p.gloss, meant }, ...c.filter((x) => x.heard !== p.gloss)]);
      toast.success("Got it — I'll remember that");
    } else {
      toast.success(`Confirmed “${meant.toLowerCase()}”`);
    }
    setStreak(0);
    setStep("translate");
    setLastAction({ text: `Confirmed “${meant.toLowerCase()}”`, reason: "Signer picked it" });
  }, [pending, appendSam]);

  const undo = useCallback(() => {
    const prev = history.current.pop();
    if (!prev) { toast("Nothing to undo"); return; }
    setCaptions(prev.captions);
    setCorrections(prev.corrections);
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
    setCaptions([]); setPending(null); setStreak(0); setSuggestTyping(false);
    setStep("translate"); setLastAction(null); setEngine("idle"); setTracking("idle");
  }, []);

  const value = useMemo<Ctx>(() => ({
    captions, pending, streak, suggestTyping, threshold, paused, corrections, step, lastAction, engine, tracking, tts, readAloud,
    setReadAloud, onSignDetected, onSentenceTranslated, onEngineStatusChange, onTTSPlaybackState: setTts, addCaption, resolveRepair,
    dismissTyping: () => { setSuggestTyping(false); setStreak(0); }, undo, override, setThreshold, setPaused, setStep, reset,
  }), [captions, pending, streak, suggestTyping, threshold, paused, corrections, step, lastAction, engine, tracking, tts, readAloud,
    onSignDetected, onSentenceTranslated, onEngineStatusChange, addCaption, resolveRepair, undo, override, reset]);

  useEffect(() => {
    window.NativeASLBridge = { onSignDetected, onSentenceTranslated, onEngineStatusChange, onTTSPlaybackState: setTts };
  }, [onSignDetected, onSentenceTranslated, onEngineStatusChange]);

  return <SignifyCtx.Provider value={value}>{children}</SignifyCtx.Provider>;
}

export function useSignify() {
  const c = useContext(SignifyCtx);
  if (!c) throw new Error("useSignify outside provider");
  return c;
}
