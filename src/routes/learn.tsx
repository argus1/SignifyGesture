import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, ChevronRight, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CameraViewport } from "@/components/signify/CameraViewport";
import { HandTrackingCue } from "@/components/signify/HandTrackingCue";
import { Eyebrow, Header, PageTitle, PrimaryButton, Screen, TabBar } from "@/components/signify/ui";
import { triggerAvatarReplay } from "@/lib/nativeBridge";
import {
  CAPTURE_INTERVAL_MS,
  CAPTURE_TOTAL_FRAMES,
  INITIAL_TRIAL,
  nextTrial,
  simulatedUsablePercentage,
  validatePracticeSearch,
} from "@/lib/practice-capture";
import { SIGNS } from "@/lib/sample-data";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/learn")({
  validateSearch: validatePracticeSearch,
  head: () =>
    seo("Learn ASL", "Watch ASL signs, practice with your camera, and contribute to research."),
  component: Learn,
});

type CaptureState = "idle" | "capturing" | "captured";

function Learn() {
  const { sign } = Route.useSearch();
  const selectedSign = sign ?? SIGNS[0]!;
  const [captureState, setCaptureState] = useState<CaptureState>("idle");
  const [frames, setFrames] = useState(0);
  const [trial, setTrial] = useState(INITIAL_TRIAL);
  const usablePercent = simulatedUsablePercentage(frames);

  useEffect(() => {
    setCaptureState("idle");
    setFrames(0);
    setTrial(INITIAL_TRIAL);
  }, [selectedSign]);

  useEffect(() => {
    if (captureState !== "capturing") return;
    const timer = window.setInterval(() => {
      setFrames((current) => Math.min(CAPTURE_TOTAL_FRAMES, current + 1));
    }, CAPTURE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [captureState]);

  useEffect(() => {
    if (captureState === "capturing" && frames === CAPTURE_TOTAL_FRAMES) {
      setCaptureState("captured");
      setTrial(nextTrial);
    }
  }, [captureState, frames]);

  const playSign = () => {
    triggerAvatarReplay([selectedSign.toUpperCase().replace(" ", "-")]);
    toast(`Playing “${selectedSign}”`);
  };

  return (
    <Screen kind="tab">
      <Header />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PageTitle title="Learn ASL" />

        <div className="mt-5 flex gap-2 overflow-x-auto px-5 pb-1" aria-label="Signs to practice">
          {SIGNS.map((item) => {
            const selected = item === selectedSign;
            return (
              <Link
                key={item}
                to="/learn"
                search={{ sign: item }}
                resetScroll={false}
                aria-pressed={selected}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-[14px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  selected ? "border-primary bg-surface" : "border-line bg-card",
                )}
              >
                {item}
              </Link>
            );
          })}
        </div>

        <section className="px-5 pt-4" aria-label={`${selectedSign} sign video`}>
          <button
            type="button"
            onClick={playSign}
            className="group relative aspect-video w-full overflow-hidden rounded-[24px] border border-line bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`Play the sign for ${selectedSign}`}
          >
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid h-14 w-14 place-items-center rounded-full border border-line bg-card transition-transform group-active:scale-95">
                <Play className="h-5 w-5" aria-hidden />
              </span>
            </span>
          </button>
          <h2 className="mt-3 text-[20px] font-medium leading-6">{selectedSign}</h2>
          <p className="mt-1 text-[13px] text-ink-2">Watch, then practice</p>
        </section>

        <section className="px-5 pt-6" aria-label="Practice capture">
          <Eyebrow>Practice</Eyebrow>
          <div className="mt-3 rounded-[24px] border border-line bg-card p-3">
            <CameraViewport
              label={`${selectedSign} practice camera`}
              className="aspect-[4/3] rounded-[18px] border border-line"
            >
              <div
                className="absolute inset-x-0 top-0 h-1 bg-card/70"
                role="progressbar"
                aria-label="Capture progress"
                aria-valuemin={0}
                aria-valuemax={CAPTURE_TOTAL_FRAMES}
                aria-valuenow={frames}
              >
                <div
                  className="h-full bg-primary transition-[width] duration-75"
                  style={{ width: `${(frames / CAPTURE_TOTAL_FRAMES) * 100}%` }}
                />
              </div>
              <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                <span className="rounded-full bg-card/90 px-3 py-1.5 text-[12px] font-medium backdrop-blur-md">
                  {frames} / {CAPTURE_TOTAL_FRAMES} frames
                </span>
                <span className="rounded-full bg-card/90 px-3 py-1.5 text-[12px] font-medium backdrop-blur-md">
                  Usable frames {usablePercent}%
                </span>
              </div>
              <HandTrackingCue
                gloss={selectedSign.toUpperCase().replace(" ", "-")}
                className="absolute inset-x-0 top-1/2 -translate-y-1/2 [&_svg]:h-[178px] [&_svg]:w-[150px]"
              />
            </CameraViewport>
            <p className="mt-4 text-center text-[14px] font-medium" aria-live="polite">
              Trial {trial} of 5
            </p>
            <PrimaryButton
              className="mt-3 h-12"
              disabled={captureState !== "idle"}
              onClick={() => {
                setFrames(0);
                setCaptureState("capturing");
              }}
            >
              {captureState === "capturing"
                ? "Capturing…"
                : captureState === "captured"
                  ? "Captured ✓"
                  : "Start capture"}
            </PrimaryButton>
            <p className="mt-3 text-center text-[12px] leading-5 text-ink-2">
              Practice the sign once before you capture.
            </p>
          </div>
        </section>

        <div className="px-5 pt-4">
          <Link
            to="/contribute"
            search={{ sign: selectedSign }}
            className="t-btn inline-flex h-11 w-full items-center justify-center rounded-full border border-foreground px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Contribute to ASL research
          </Link>
        </div>

        <div className="px-5 pb-5 pt-4">
          <Link
            to="/memory"
            search={{}}
            className="flex min-h-14 items-center gap-3 rounded-[24px] border border-line bg-card px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <BookOpen className="h-5 w-5 shrink-0" aria-hidden />
            <span className="flex-1 text-[15px] font-medium">Saved conversations</span>
            <ChevronRight className="h-4 w-4 text-chevron" aria-hidden />
          </Link>
        </div>
      </div>
      <TabBar />
    </Screen>
  );
}
