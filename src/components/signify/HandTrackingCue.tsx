import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Hand-landmark skeleton (21 points, same layout as Apple Vision / MediaPipe hand output):
 * 0 wrist · 1–4 thumb · 5–8 index · 9–12 middle · 13–16 ring · 17–20 pinky.
 * Idle: an open hand gently floating ("I'm watching for hands").
 * With a `gloss`: the hand performs that sign (handshape changes + movement), so the demo looks like real tracking.
 */
type Pt = [number, number];
type FingerKind = "straight" | "fold" | "claw" | "curl";
type ThumbKind = "out" | "tuck" | "side" | "between" | "meet";

// Same connections as real hand tracking (MediaPipe / Apple Vision): wrist fans out to thumb, index and pinky bases
const WRIST: Pt = [50, 112];
const MCP: Record<"index" | "middle" | "ring" | "pinky", Pt> = { index: [40, 70], middle: [50, 68], ring: [60, 70], pinky: [69, 75] };
const SEG = { index: [20, 14, 12], middle: [22, 15, 13], ring: [20, 14, 10], pinky: [15, 10, 9] } as const;

function finger(name: keyof typeof MCP, kind: FingerKind, spread: number): Pt[] {
  const [x, y] = MCP[name];
  const [a, b, c] = SEG[name];
  if (kind === "straight") {
    return [[x, y], [x + spread * a, y - a], [x + spread * (a + b), y - a - b], [x + spread * (a + b + c), y - a - b - c]];
  }
  if (kind === "fold") return [[x, y], [x, y - 7], [x, y + 1], [x, y + 7]]; // fist: fingers folded onto the palm
  if (kind === "claw") return [[x, y], [x + spread * 10, y - 14], [x + spread * 15, y - 21], [x + spread * 16, y - 17]];
  // curl: fingertips reach toward the thumb tip (O / C / E shapes)
  return [[x, y], [x - 2, y - 13], [x - 7, y - 17], [41 + (x - 50) * 0.15, 62]];
}

function thumb(kind: ThumbKind): Pt[] {
  switch (kind) {
    case "out": return [[36, 100], [26, 88], [19, 76], [14, 66]];
    case "tuck": return [[38, 100], [34, 92], [42, 86], [51, 84]]; // across the palm
    case "side": return [[38, 100], [33, 90], [31, 80], [31, 71]]; // A: alongside the fist
    case "between": return [[38, 100], [34, 92], [40, 80], [45, 68]]; // T: tip pokes up between index and middle
    case "meet": return [[38, 100], [30, 92], [32, 78], [39, 64]]; // O: meets the fingertips
  }
}

function pose(t: ThumbKind, f: [FingerKind, FingerKind, FingerKind, FingerKind], spread = 1): Pt[] {
  return [
    WRIST, ...thumb(t),
    ...finger("index", f[0], -0.12 * spread), ...finger("middle", f[1], 0), ...finger("ring", f[2], 0.1 * spread), ...finger("pinky", f[3], 0.25 * spread),
  ];
}

const SHAPES = {
  FIVE: pose("out", ["straight", "straight", "straight", "straight"]),
  B: pose("tuck", ["straight", "straight", "straight", "straight"], 0.15),
  S: pose("tuck", ["fold", "fold", "fold", "fold"]),
  CLAW: pose("out", ["claw", "claw", "claw", "claw"]),
  I: pose("tuck", ["fold", "fold", "fold", "straight"], 0.6),
  L: pose("out", ["straight", "fold", "fold", "fold"], 0.2),
  A: pose("side", ["fold", "fold", "fold", "fold"]),
  T: pose("between", ["fold", "fold", "fold", "fold"]),
  E: pose("tuck", ["curl", "curl", "curl", "curl"]),
  O: pose("meet", ["curl", "curl", "curl", "curl"]),
  C: pose("out", ["claw", "claw", "claw", "claw"], 0.3),
} satisfies Record<string, Pt[]>;
type Shape = keyof typeof SHAPES;

/** How each demo sign is made: handshapes over time + one movement. Fingerspelled words step through letters. */
type Choreo = { shapes: [Shape, number][]; motion?: "hello" | "tap" | "pull" | "shiver" | "squeeze" | "circle" | "rock" | "thanks" };
const spell = (word: string): Choreo => ({ shapes: [...word].map((ch) => [ch as Shape, 260] as [Shape, number]) });
const SIGNS: Record<string, Choreo> = {
  HELLO: { shapes: [["B", 0]], motion: "hello" },
  I: { shapes: [["I", 0]], motion: "tap" },
  WANT: { shapes: [["FIVE", 0], ["CLAW", 380]], motion: "pull" },
  ICED: { shapes: [["S", 0]], motion: "shiver" },
  COLD: { shapes: [["S", 0]], motion: "shiver" },
  LATTE: spell("LATTE"),
  OAT: spell("OAT"),
  "OAT-MILK": { shapes: [["O", 0], ["A", 240], ["T", 240], ["C", 260], ["S", 200], ["C", 200], ["S", 200]] },
  MILK: { shapes: [["C", 0], ["S", 200], ["C", 200], ["S", 200], ["C", 200], ["S", 200]] },
  COFFEE: { shapes: [["S", 0]], motion: "circle" },
  MEDIUM: { shapes: [["B", 0]], motion: "rock" },
  PLEASE: { shapes: [["B", 0]], motion: "circle" },
  "THANK-YOU": { shapes: [["B", 0]], motion: "thanks" },
};

const BONES: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [9, 10], [10, 11], [11, 12],
  [13, 14], [14, 15], [15, 16], [0, 17], [17, 18], [18, 19], [19, 20], [5, 9], [9, 13], [13, 17]];

/** Smoothly morph the 21 points to a new handshape. */
function useMorph(target: Pt[]) {
  const [pts, setPts] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    const from = cur.current;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 170);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const next = from.map((p, i) => [p[0] + (target[i]![0] - p[0]) * e, p[1] + (target[i]![1] - p[1]) * e] as Pt);
      cur.current = next;
      setPts(next);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return pts;
}

export function HandTrackingCue({ className, gloss, signKey }: { className?: string; gloss?: string | null | undefined; signKey?: number | undefined }) {
  const choreo = gloss ? SIGNS[gloss.toUpperCase()] : undefined;
  const [shape, setShape] = useState<Shape>("FIVE");

  // Step through the sign's handshapes
  useEffect(() => {
    if (!choreo) { setShape(gloss ? "B" : "FIVE"); return; }
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = 0;
    for (const [s, delay] of choreo.shapes) { at += delay; timers.push(setTimeout(() => setShape(s), at)); }
    return () => timers.forEach(clearTimeout);
  }, [gloss, signKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const pts = useMorph(SHAPES[shape]);
  const signing = !!gloss;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg viewBox="0 0 100 120" className={cn("h-44 w-40 overflow-visible", !signing && "hand-cue")} aria-hidden>
        <g key={signKey} className={choreo?.motion ? `sign-motion sign-${choreo.motion}` : undefined}>
          {BONES.map(([a, b], i) => (
            <line key={i} x1={pts[a]![0]} y1={pts[a]![1]} x2={pts[b]![0]} y2={pts[b]![1]} stroke="white" strokeOpacity="0.6" strokeWidth="1.2" strokeLinecap="round" />
          ))}
          {pts.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i === 0 ? 2.6 : 2} fill="#00FFAE" className={signing ? undefined : "hand-dot"} style={signing ? undefined : { animationDelay: `${i * 60}ms` }} />
          ))}
        </g>
      </svg>
      {/* What the camera thinks it sees right now */}
      <span className={cn("mt-4 rounded-full bg-black/35 px-3 py-1 text-xs font-bold tracking-wide text-white backdrop-blur-md transition-opacity duration-300", signing ? "opacity-100" : "opacity-0")}>
        {gloss ?? " "}
      </span>
    </div>
  );
}
