import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Bot, ChevronLeft, Play } from "lucide-react";
import { SmallHandIcon } from "@/components/signify/icons";
import { useSignify } from "@/lib/signify-store";
import {
  Header,
  HeaderIconButton,
  PrimaryButton,
  Eyebrow,
  Screen,
  press,
  DUR,
  EASE,
  STAGGER,
} from "@/components/signify/ui";
import { triggerAvatarReplay } from "@/lib/nativeBridge";
import { syncSessionToAWS } from "@/services/awsSync";
import { SIGNS } from "@/lib/sample-data";
import { cn } from "@/lib/utils";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/recap")({
  head: () =>
    seo("Coffee, sorted", "The Signify Agent's recap of your conversation, with the new signs."),
  component: Recap,
});

/** 10 Recap (opened from Memory). The agent already saved it, so there's no save toggle. */
function Recap() {
  const s = useSignify();
  const nav = useNavigate();
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => {
    s.setStep("recap");
    void syncSessionToAWS({
      captions: s.captions,
      corrections: s.corrections,
      savedAt: Date.now(),
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const play = (w: string) => {
    triggerAvatarReplay([w.toUpperCase()]);
    setPlaying(w);
    setTimeout(() => setPlaying((p) => (p === w ? null : p)), 1600);
  };

  return (
    <Screen>
      <Header
        left={<HeaderIconButton icon={ChevronLeft} label="Back to Memory" to="/memory" size={16} />}
      />
      <div className="flex flex-1 flex-col px-5 pt-5">
        <motion.h1 layoutId="recap-title" className="t-title leading-[25px]">
          Coffee, sorted.
        </motion.h1>
        <Eyebrow icon={Bot} className="mt-[25px]">
          Signify Agent recap
        </Eyebrow>
        <p className="mt-[5px] max-w-[300px] text-[16px] leading-5 text-ink-2">
          You ordered a medium iced oat milk latte.
        </p>

        <Eyebrow className="mt-[37px] justify-center">
          {SIGNS.length} new signs · tap to watch
        </Eyebrow>
        <motion.ul
          className="mt-2 grid grid-cols-3 gap-4"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: STAGGER, delayChildren: 0.15 } },
          }}
        >
          {SIGNS.map((w) => (
            <motion.li
              key={w}
              variants={{
                hidden: { opacity: 0, y: 8 },
                show: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE } },
              }}
            >
              <motion.button
                {...press}
                onClick={() => play(w)}
                aria-label={`Play the sign for ${w}`}
                className={cn(
                  "flex h-24 w-full flex-col items-center justify-center gap-[13px] rounded-[24px] border border-line bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  playing === w && "border-2 border-primary bg-surface",
                )}
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-surface">
                  <Play className="h-[10px] w-[10px]" aria-hidden />
                </span>
                <span className="text-[14px] font-medium">{w}</span>
              </motion.button>
            </motion.li>
          ))}
        </motion.ul>

        <div className="mt-auto pb-[31px]">
          <PrimaryButton
            icon={SmallHandIcon}
            onClick={() => {
              s.reset();
              nav({ to: "/sign", search: {} });
            }}
          >
            Practice these signs
          </PrimaryButton>
        </div>
      </div>
    </Screen>
  );
}
