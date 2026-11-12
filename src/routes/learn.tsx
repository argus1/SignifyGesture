import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { CameraViewport } from "@/components/signify/CameraViewport";
import { Eyebrow, Header, PageTitle, PrimaryButton, Screen, TabBar } from "@/components/signify/ui";
import {
  CAPTURE_INTERVAL_MS,
  CAPTURE_TOTAL_FRAMES,
  INITIAL_TRIAL,
  nextTrial,
  simulatedUsablePercentage,
  validatePracticeSearch,
} from "@/lib/practice-capture";
import { LEARN_SIGNS, SIGNS } from "@/lib/sample-data";
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
  const selectedSign = SIGNS.find((gloss) => gloss === sign) ?? SIGNS[0] ?? "Develop";
  const selectedVideo = LEARN_SIGNS.find((item) => item.gloss === selectedSign) ?? LEARN_SIGNS[0];
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

  return (
    <Screen kind="tab" className="bg-background pb-0">
      <Header />
      <div className="relative min-h-0 flex-1">
        <div
          aria-label="Learn ASL practice content"
          className="h-full overflow-y-auto overscroll-contain pb-[calc(var(--tab-bar-clearance)+24px)]"
        >
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
            <div className="relative aspect-video w-full overflow-hidden rounded-[24px] border border-line bg-surface">
              <iframe
                key={selectedVideo.videoId}
                src={`https://www.youtube-nocookie.com/embed/${selectedVideo.videoId}`}
                title={`ASL sign for ${selectedSign}`}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                loading="lazy"
              />
            </div>
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
                Prototype preview: frame counts and usable-frame estimates are simulated. No
                practice captures are saved.
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
      </div>
      <TabBar />
    </Screen>
  );
}
