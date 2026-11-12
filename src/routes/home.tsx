import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import {
  AudioLines,
  Share,
  Camera,
  Captions,
  Smartphone,
  Radio as RadioIcon,
  QrCode,
  type LucideIcon,
} from "lucide-react";
import { SignHandIcon, type IconComponent } from "@/components/signify/icons";
import { toast } from "sonner";
import {
  Header,
  TabBar,
  GlassSheet,
  SheetItem,
  PrimaryButton,
  SecondaryButton,
  Eyebrow,
  Radio,
  press,
  DUR,
  EASE,
} from "@/components/signify/ui";
import { useSignify } from "@/lib/signify-store";
import { cn } from "@/lib/utils";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/home")({
  head: () => seo("Signify", "Pick who is talking: speech or signing."),
  component: Home,
});

/** Home → stagger in from the headline down (Launch → Home handoff). */
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE } },
};

function Home() {
  const nav = useNavigate();
  const s = useSignify();
  const reduce = useReducedMotion();
  const [share, setShare] = useState<0 | 1 | 2>(0); // 0 closed · 1 "Other person nearby?" · 2 "What do they get?"

  const goLive = () => {
    s.reset();
    setShare(0);
    nav({ to: "/sign", search: {} });
  };
  const goSpeech = () => {
    s.reset();
    nav({ to: "/sign", search: { mode: "speech" } });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col pb-[var(--tab-bar-clearance)]">
      <Header />
      <motion.div
        className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto pb-6"
        initial={reduce ? false : "hidden"}
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
      >
        <motion.h1 variants={item} className="headline mt-[113px] text-center text-[41.9px]">
          Hello Sam!
          <span className="block text-ink-4">Who is talking?</span>
        </motion.h1>
        <motion.p variants={item} className="t-label mt-[36px] text-ink-3">
          Pick your side
        </motion.p>

        <motion.div variants={item} className="mt-[29px] flex flex-col gap-[30px]">
          <SidePill
            icon={AudioLines}
            iconSize={22}
            title="Speech"
            sub="Spoken English"
            onClick={goSpeech}
            strong
          />
          <SidePill
            icon={SignHandIcon}
            iconSize={29.4}
            title="Signing"
            sub="ASL"
            subMuted
            onClick={() => setShare(1)}
          />
        </motion.div>

        <motion.div variants={item} className="mt-[30px] w-[251px]">
          <motion.button
            {...press}
            onClick={() => setShare(1)}
            className="t-btn h-[58px] w-full rounded-full bg-primary text-black active:brightness-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
          >
            Start a conversation
          </motion.button>
        </motion.div>
      </motion.div>
      <TabBar />

      <ShareSheet
        step={share}
        setStep={setShare}
        onSkip={goLive}
        onShare={(what) => {
          toast(what === "camera" ? "Sharing your sign camera" : "Sharing live captions");
          goLive();
        }}
      />
    </div>
  );
}

/** 251 × 79 side pill: icon on the left, title (Sora SemiBold 13) over a label (Sora 11). */
function SidePill({
  icon: Icon,
  iconSize,
  title,
  sub,
  subMuted,
  strong,
  onClick,
}: {
  icon: IconComponent;
  iconSize: number;
  title: string;
  sub: string;
  subMuted?: boolean;
  strong?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      {...press}
      onClick={onClick}
      aria-label={`${title}, ${sub}`}
      className={cn(
        "relative flex h-[79px] w-[251px] items-center justify-center rounded-[30px] bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        strong ? "border-[0.5px] border-line-strong" : "border border-line",
      )}
    >
      <Icon
        className="absolute left-[35px]"
        style={{ height: iconSize, width: "auto" }}
        aria-hidden
      />
      <span className="flex flex-col items-center pl-6">
        <span className="t-pill leading-4">{title}</span>
        <span className={cn("t-label leading-[14px]", subMuted ? "text-ink-2" : "text-foreground")}>
          {sub}
        </span>
      </span>
    </motion.button>
  );
}

/**
 * Share · Nearby (step 1) grows into Share · What they get (step 2) in the same sheet.
 * Skip keeps the conversation on this phone.
 */
function ShareSheet({
  step,
  setStep,
  onSkip,
  onShare,
}: {
  step: 0 | 1 | 2;
  setStep: (s: 0 | 1 | 2) => void;
  onSkip: () => void;
  onShare: (what: "camera" | "captions") => void;
}) {
  const [what, setWhat] = useState<"camera" | "captions">("camera");
  const [how, setHow] = useState<"tap" | "airdrop" | "qr">("tap");
  return (
    <GlassSheet
      open={step > 0}
      onClose={() => setStep(0)}
      label={step === 2 ? "What do they get?" : "Other person nearby?"}
      layout
    >
      {step === 1 ? (
        <div key="s1" className="px-[23px] pb-[31px]">
          <SheetItem>
            <p className="t-label mt-[19px] text-center text-white">Other person nearby?</p>
          </SheetItem>
          <SheetItem>
            <motion.button
              {...press}
              onClick={() => setStep(2)}
              className="mx-[9px] mt-3 flex h-[79px] w-[329px] max-w-[calc(100%-18px)] items-center gap-[30px] rounded-[26px] bg-card pl-[33px] pr-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-[0.5px] dark:border-white"
            >
              <Share className="h-4 w-4 shrink-0" aria-hidden />
              <span>
                <span className="block text-[15px] font-medium leading-[19px]">
                  Share to their phone
                </span>
                <span className="block text-[11.3px] leading-[14px] text-ink-2">
                  Tap phones or AirDrop. They join in their browser, no app needed.
                </span>
              </span>
            </motion.button>
          </SheetItem>
          <SheetItem className="mt-[33px] flex gap-[22px]">
            <SecondaryButton onClick={onSkip} className="w-[152px] dark:border-white">
              Skip
            </SecondaryButton>
            <motion.button
              {...press}
              onClick={() => setStep(2)}
              className="t-btn h-11 flex-1 rounded-full bg-primary text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
            >
              Share sign camera
            </motion.button>
          </SheetItem>
        </div>
      ) : (
        <div key="s2" className="px-5 pb-[31px]">
          <SheetItem>
            <p className="t-label mt-3 text-center text-white">Step 1 of 2</p>
          </SheetItem>
          <SheetItem>
            <h2 className="t-title mt-[14px] text-center">What do they get?</h2>
          </SheetItem>
          <div
            role="radiogroup"
            aria-label="What do they get?"
            className="mt-[15px] grid gap-[10px]"
          >
            <SheetItem>
              <ChoiceCard
                icon={Camera}
                title="Your sign camera"
                desc="They watch you sign live, with captions, on their phone."
                on={what === "camera"}
                onClick={() => setWhat("camera")}
              />
            </SheetItem>
            <SheetItem>
              <ChoiceCard
                icon={Captions}
                title="Live captions"
                desc="They speak into their phone. You read their words as captions."
                on={what === "captions"}
                onClick={() => setWhat("captions")}
              />
            </SheetItem>
          </div>
          <SheetItem>
            <Eyebrow className="mt-[30px] justify-center">Step 2 of 2 · How to share</Eyebrow>
          </SheetItem>
          <SheetItem>
            <div
              role="radiogroup"
              aria-label="How to share"
              className="mt-3 flex justify-between px-[30px]"
            >
              <MethodButton
                icon={Smartphone}
                label="Tap phones"
                on={how === "tap"}
                onClick={() => setHow("tap")}
              />
              <MethodButton
                icon={RadioIcon}
                label="AirDrop"
                on={how === "airdrop"}
                onClick={() => setHow("airdrop")}
              />
              <MethodButton
                icon={QrCode}
                label="QR code"
                on={how === "qr"}
                onClick={() => setHow("qr")}
              />
            </div>
          </SheetItem>
          <SheetItem className="mt-[72px]">
            <PrimaryButton icon={Smartphone} onClick={() => onShare(what)}>
              {what === "camera" ? "Share sign camera" : "Share live captions"}
            </PrimaryButton>
          </SheetItem>
        </div>
      )}
    </GlassSheet>
  );
}

/** 350 × 92 choice: selected = #F2F2F2 + 2px mint; unselected = 0.5px black hairline. */
function ChoiceCard({
  icon: Icon,
  title,
  desc,
  on,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      {...press}
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "flex h-[92px] w-full items-center gap-4 rounded-[24px] pl-4 pr-[21px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        on
          ? "border-2 border-primary bg-surface"
          : "border-[0.5px] border-foreground bg-transparent",
      )}
    >
      <span
        className={cn(
          "grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full",
          on ? "border-[0.5px] border-foreground" : "bg-card",
        )}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-medium">{title}</span>
        <span className="block text-[12px] leading-[15px] text-ink-2">{desc}</span>
      </span>
      <Radio on={on} />
    </motion.button>
  );
}

/** 64px circle, #F2F2F2; selected adds a 2px mint ring. Label below. */
function MethodButton({
  icon: Icon,
  label,
  on,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      {...press}
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className="flex w-16 flex-col items-center gap-3 focus-visible:outline-none"
    >
      <span
        className={cn(
          "grid h-16 w-16 place-items-center rounded-full bg-surface",
          on && "border-2 border-primary",
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="whitespace-nowrap text-[13px] font-medium">{label}</span>
    </motion.button>
  );
}
