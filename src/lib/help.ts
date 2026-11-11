import type {
  RecognitionStatus,
  SpeechRecognitionState,
  TrackingState,
} from "@/types/nativeBridge";

export const HELP_CONTRACT_VERSION = 1 as const;

export type HelpScreen =
  "home" | "conversation" | "messages" | "community" | "memory" | "learn" | "other";

export function helpScreenForPath(path: string): HelpScreen {
  if (path === "/home") return "home";
  if (path === "/sign") return "conversation";
  if (path === "/messages" || path.startsWith("/messages/")) return "messages";
  if (path === "/community") return "community";
  if (path === "/memory") return "memory";
  if (path === "/learn") return "learn";
  return "other";
}

/** Deliberately excludes conversation text, media, landmarks, and native error messages. */
export type HelpContext = {
  version: typeof HELP_CONTRACT_VERSION;
  screen: HelpScreen;
  nativeHost: boolean;
  cameraActive: boolean;
  tracking: TrackingState;
  recognition: RecognitionStatus | "unknown";
  speech: SpeechRecognitionState | "unknown";
};

export function getHelpContext(state: Omit<HelpContext, "version">): HelpContext {
  return {
    version: HELP_CONTRACT_VERSION,
    screen: state.screen,
    nativeHost: state.nativeHost,
    cameraActive: state.cameraActive,
    tracking: state.tracking,
    recognition: state.recognition,
    speech: state.speech,
  };
}

type HelpTopic = {
  id: string;
  title: string;
  question: string;
  keywords: string;
  guidance: (context: HelpContext) => string;
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "camera",
    title: "Camera access and recovery",
    question: "Why isn't the camera working?",
    keywords: "camera permission denied restricted settings allow access recovery preview",
    guidance: (c) =>
      c.nativeHost
        ? `Camera is ${c.cameraActive ? "reported active" : "not reported active"}. To try it, use the camera control on a camera screen and follow the iOS prompt. If access was denied, allow it in iOS Settings; restrictions may need to be changed on the device. A missing front camera cannot be fixed by permission.`
        : "The browser shows a sample scene, not a live camera. Camera access and permission prompts are handled by the iOS app.",
  },
  {
    id: "tracking",
    title: "Hand tracking and sign recognition",
    question: "Does tracking mean my signs are recognized?",
    keywords: "tracking hand pose recognition signs tracking-only vision",
    guidance: (c) =>
      `Hand tracking is ${c.tracking === "tracking" ? "reported active" : c.tracking === "lost" ? "reported lost; show your hands" : "not currently reported active"}. Tracking hand poses is not the same as recognizing signs; tracking alone does not produce a translation.`,
  },
  {
    id: "model",
    title: "Recognition model readiness",
    question: "Is sign recognition available?",
    keywords: "model recognition unavailable threshold confidence no result supported signs",
    guidance: (c) => {
      switch (c.recognition) {
        case "modelUnavailable":
          return "The sign recognition model is unavailable. Hand tracking may still work, but it does not recognize signs. You can type instead.";
        case "confidenceThresholdNotValidated":
          return "Recognition is disabled until its confidence threshold is validated. You can type instead.";
        case "noResult":
          return "The recognizer reported no result. Try again or type instead; a result is not guaranteed.";
        case "unsupportedGloss":
          return "The sign is outside the supported demo vocabulary. You can type instead.";
        default:
          return "Recognition readiness has not been reported. Do not assume that tracking means recognition is working. You can type instead.";
      }
    },
  },
  {
    id: "correction",
    title: "Correcting a caption",
    question: "How do I correct a message?",
    keywords: "edit correct correction transcript caption message type repair",
    guidance: () =>
      "In a conversation, use Edit on one of your finished messages, change the text, and save it. If the repair prompt appears, choose the intended word or type it. Review a message before choosing Speak.",
  },
  {
    id: "speech",
    title: "Optional speech and captions",
    question: "How do speech and captions work?",
    keywords: "speech speak voice microphone mic listening captions audio denied restricted",
    guidance: (c) => {
      const state =
        c.speech === "unknown"
          ? "Speech status has not been reported."
          : `Speech status: ${c.speech}.`;
      return `${state} Speech mode can request microphone and speech permissions in the iOS app. If denied or restricted, check iOS Settings or device restrictions; typing remains an option. Spoken playback requires you to choose Speak on a reviewed message, and Stop speaking stops it.`;
    },
  },
  {
    id: "local-cloud",
    title: "Local, cloud, and offline help",
    question: "Does help work offline?",
    keywords: "offline internet network local cloud privacy help agent apple foundation afm",
    guidance: () =>
      "These instructions are bundled with the frontend and do not call a help model. Offline launch requires the separately planned bundled iOS frontend. AI help, local AFM and cloud validation are not connected yet. No help text is sent to a provider by this panel.",
  },
  {
    id: "avatar",
    title: "Signing avatar",
    question: "Is the signing avatar available?",
    keywords: "avatar replay signing unavailable",
    guidance: () =>
      "The native signing avatar is not currently available; do not rely on replay as a working feature.",
  },
  {
    id: "memory",
    title: "Saving and recalling conversations",
    question: "How do I save a conversation?",
    keywords: "memory save saved recall history transcript delete erase consent",
    guidance: () =>
      "In the iOS app, end a conversation, review the recap, and explicitly choose Save to memory after consent. This saves both speakers' finalized words on the device, not audio or video. In Memory, enable global recall and allow the individual conversation before using Search saved conversations in Help. Recall returns saved words with sources, not generated sentence suggestions. You can delete one conversation or erase all; external and older backup copies cannot be erased by the app. Browser previews cannot save personal memory.",
  },
];

/** Search bundled content only; unknown questions never produce an invented answer. */
export function searchHelp(query: string, context: HelpContext) {
  const words = query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  if (!words.length)
    return HELP_TOPICS.map((topic) => ({ ...topic, answer: topic.guidance(context) }));
  const stop = new Set([
    "a",
    "an",
    "and",
    "are",
    "can",
    "do",
    "does",
    "how",
    "i",
    "is",
    "it",
    "my",
    "the",
    "what",
    "why",
    "work",
  ]);
  const terms = words.filter((word) => !stop.has(word));
  if (!terms.length) return [];
  return HELP_TOPICS.map((topic) => {
    const text = `${topic.title} ${topic.question} ${topic.keywords}`.toLowerCase();
    const score = terms.filter((word) => text.includes(word)).length;
    return { ...topic, answer: topic.guidance(context), score };
  })
    .filter((topic) => topic.score > 0)
    .sort((a, b) => b.score - a.score);
}

export type HelpConnection = "online" | "offline" | "unstable";
export type LocalModelAvailability = "ready" | "unavailable" | "unknown";
export type HelpInferencePlan =
  | { primary: "cloud"; validation: "local" | "cloud" }
  | { primary: "local"; validation: "none" }
  | { primary: "unavailable"; reason: "offline" | "local-readiness-unknown" };

export type CloudHelpProvider = "openai" | "anthropic" | "openrouter";

/** Interface for a future authenticated service; no provider is implemented in this build. */
export interface HelpAgentProvider {
  request(input: {
    question: string;
    context: HelpContext;
    signal: AbortSignal;
  }): Promise<{ answer: string; validation: "local" | "cloud" | "none" }>;
}

/** Policy only: the native readiness signal and both inference providers are not connected yet. */
export function planHelpInference(
  connection: HelpConnection,
  local: LocalModelAvailability,
): HelpInferencePlan {
  if (connection === "online") {
    if (local === "unknown") {
      return { primary: "unavailable", reason: "local-readiness-unknown" };
    }
    return { primary: "cloud", validation: local === "ready" ? "local" : "cloud" };
  }
  if (local === "ready") return { primary: "local", validation: "none" };
  return {
    primary: "unavailable",
    reason: local === "unknown" ? "local-readiness-unknown" : "offline",
  };
}

export function helpAgentUnavailableMessage(connection: HelpConnection): string {
  if (connection === "offline") {
    return "You are offline. AI help is not connected yet; the instructions below are still available while this screen is open.";
  }
  return "AI help is not connected yet. Use the instructions below; no question was sent to a model.";
}
