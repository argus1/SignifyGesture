import { motion } from "framer-motion";
import { Bot, Keyboard, X as XIcon } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useSignify, type AgentStep } from "@/lib/signify-store";
import { cn } from "@/lib/utils";
import {
  GlassSheet,
  HeaderIconButton,
  RoundButton,
  SheetItem,
  press,
  DUR,
  EASE,
  STAGGER,
} from "./ui";

/**
 * Agent button (44px, Bot icon, mint status dot) on every conversation screen. Opens Agent settings.
 * The dot pulses while the agent is asking about a sign and disappears when the agent is off.
 */
export function AgentButton({ className }: { className?: string }) {
  const a = useSignify();
  return (
    <>
      <RoundButton
        icon={Bot}
        label={`Signify Agent: ${a.paused ? "off" : a.step}. Open agent settings`}
        onClick={() => a.setAgentOpen(true)}
        dot={!a.paused}
        pulse={a.step === "repair"}
        {...(className ? { className } : {})}
      />
      <AgentSettings />
    </>
  );
}
/** Old name, same component. */
export const AgentChip = AgentButton;

const STEPS: { id: AgentStep; lead: string; rest: string }[] = [
  { id: "translate", lead: "Translates", rest: "your signs into English" },
  { id: "check", lead: "Checks", rest: "signs it isn’t sure about" },
  { id: "repair", lead: "Asks you", rest: "to fix them first" },
  { id: "recap", lead: "Recaps", rest: "the conversation at the end" },
];

/** 09 Agent settings: on/off chip, what it does, last action, the ask threshold, caption size, learned signs. */
function AgentSettings() {
  const a = useSignify();
  const pct = Math.round(a.threshold * 100);
  return (
    <GlassSheet
      open={a.agentOpen}
      onClose={() => a.setAgentOpen(false)}
      label="Signify Agent settings"
      className="glass-sheet-agent"
    >
      <div className="px-[34px] pb-10 pt-2">
        <SheetItem className="-ml-[10px] flex items-center justify-between">
          <motion.button
            {...press}
            onClick={() => a.setPaused(!a.paused)}
            aria-pressed={!a.paused}
            aria-label={a.paused ? "Agent is off. Turn on" : "Agent is on. Turn off"}
            className="t-btn flex h-9 items-center gap-2 rounded-full border-[0.5px] border-foreground bg-card pl-4 pr-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span
              aria-hidden
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                a.paused ? "bg-chevron" : "bg-primary",
              )}
            />
            {a.paused ? "Agent off" : "Agent on"}
            <Bot className="h-[15px] w-[15px]" aria-hidden />
          </motion.button>
          <HeaderIconButton
            icon={XIcon}
            label="Close agent settings"
            onClick={() => a.setAgentOpen(false)}
          />
        </SheetItem>

        <SheetItem>
          <p className="t-label mt-[21px]">What it does</p>
          <ol className="mt-[13px] space-y-[9px]">
            {STEPS.map((x) => {
              const now = !a.paused && a.step === x.id;
              return (
                <li
                  key={x.id}
                  aria-current={now ? "step" : undefined}
                  className="relative text-[11px] leading-[14px]"
                >
                  {now && (
                    <span
                      aria-hidden
                      className="dot-pulse absolute -left-3 top-[5px] h-1.5 w-1.5 rounded-full bg-primary"
                    />
                  )}
                  <span className="font-semibold">{x.lead}</span>{" "}
                  <span className="font-light">{x.rest}</span>
                </li>
              );
            })}
          </ol>
        </SheetItem>

        {a.lastAction && (
          <SheetItem>
            <p className="t-label mt-[26px] text-ink-3">Last thing it did</p>
            <p className="mt-2 text-[13px] font-medium">{a.lastAction.text}</p>
            <p className="text-[13px] text-ink-2">Why: {a.lastAction.reason}</p>
          </SheetItem>
        )}

        <SheetItem>
          <div className="mt-[30px] flex items-baseline justify-between">
            <label id="thr" className="t-label">
              Ask me when it’s under
            </label>
            <span className="t-pill">{pct}%</span>
          </div>
          <Slider
            aria-labelledby="thr"
            className="mt-1"
            min={0.4}
            max={0.95}
            step={0.05}
            value={[a.threshold]}
            onValueChange={([v]) => a.setThreshold(v ?? a.threshold)}
          />
          <p className="mt-1 text-[13px] leading-4 text-ink-2">
            Asks “which sign did you mean?” when it’s less than {pct}% sure.
          </p>
        </SheetItem>

        <SheetItem>
          <p id="cap" className="t-label mt-[38px] text-ink-3">
            Caption size
          </p>
          <div className="mt-1 flex items-center gap-[9px]">
            <span aria-hidden className="text-[12px]">
              A
            </span>
            <Slider
              aria-labelledby="cap"
              className="flex-1"
              min={0.85}
              max={1.5}
              step={0.05}
              value={[a.textScale]}
              onValueChange={([v]) => a.setTextScale(v ?? a.textScale)}
            />
            <span aria-hidden className="text-[22px] leading-none">
              A
            </span>
          </div>
        </SheetItem>

        <SheetItem>
          <p className="t-label mt-[26px] text-ink-3">Signs it has learned</p>
          {a.corrections.length === 0 ? (
            <p className="mt-2 text-[13px] text-ink-2">Fix a sign and it shows up here.</p>
          ) : (
            <ul className="mt-[10px] flex flex-wrap gap-2">
              {a.corrections.map((c) => (
                <li
                  key={c.heard}
                  className="flex h-9 items-center gap-1.5 rounded-full border-[0.5px] border-line-strong bg-surface px-4 text-[14px] font-medium"
                >
                  <span className="text-ink-3 line-through">{c.heard.toLowerCase()}</span>
                  <span aria-hidden>→</span>
                  <span className="sr-only">became</span>
                  {c.meant.toLowerCase()}
                </li>
              ))}
            </ul>
          )}
        </SheetItem>
      </div>
    </GlassSheet>
  );
}

/**
 * 06 Agent check card: "Which sign did you mean?" with the top 2 guesses and a way out.
 * Rises 16px and fades in, chips stagger in, the top guess pulses mint once.
 */
export function RepairCard({ onType }: { onType?: () => void }) {
  const { pending, resolveRepair, dismissTyping } = useSignify();
  const typeInstead = () => {
    resolveRepair(null);
    if (onType) {
      dismissTyping();
      onType();
    }
  };
  if (!pending) return null;
  const options = [
    { gloss: pending.gloss, confidence: pending.confidence },
    ...(pending.alternatives ?? []),
  ].slice(0, 2);
  return (
    <motion.div
      role="alertdialog"
      aria-label="Signify Agent needs to confirm a sign"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.base, ease: EASE }}
      className="rounded-[30px] border-[0.5px] border-line-strong bg-surface px-[33px] pb-[11px] pt-[13px]"
    >
      <p className="flex items-center gap-1.5 font-label text-[11px] font-semibold">
        <Bot className="h-[11px] w-[11px]" aria-hidden /> Which sign did you mean?
      </p>
      <motion.div
        className="mt-[9px] flex flex-wrap gap-[6px]"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: STAGGER, delayChildren: 0.1 } },
        }}
      >
        {options.map((o, i) => (
          <motion.button
            key={o.gloss}
            onClick={() => resolveRepair(o.gloss)}
            variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
            whileTap={{ scale: 0.96 }}
            className={cn(
              "flex h-[37px] items-center gap-1.5 rounded-full bg-card px-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              i === 0 && "mint-glow-once border-[1.5px] border-primary",
            )}
          >
            <span className="text-[14px] font-medium">{o.gloss.toLowerCase()}</span>
            <span className="text-[11px] text-ink-3">{Math.round(o.confidence * 100)}%</span>
          </motion.button>
        ))}
      </motion.div>
      <motion.button
        {...press}
        onClick={typeInstead}
        className="mt-[11px] flex h-[31px] items-center gap-2 rounded-full bg-white/60 px-3 font-label text-[11px] dark:border-[0.5px] dark:border-white dark:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Keyboard className="h-[13px] w-[13px]" aria-hidden /> Type the right word
      </motion.button>
    </motion.div>
  );
}

/** After 3 unsure signs in a row: offer typing. */
export function TypingSuggestion({ onType }: { onType: () => void }) {
  const { suggestTyping, dismissTyping } = useSignify();
  if (!suggestTyping) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-[30px] border-[0.5px] border-line-strong bg-surface py-2 pl-5 pr-2"
    >
      <p className="flex-1 text-[13px] font-medium">Tricky signs today. Type instead?</p>
      <RoundButton
        icon={Keyboard}
        label="Type instead"
        onClick={() => {
          dismissTyping();
          onType();
        }}
        size={18}
        className="bg-primary text-black"
      />
      <RoundButton
        icon={XIcon}
        label="Keep signing"
        onClick={dismissTyping}
        size={14}
        className="bg-card"
      />
    </div>
  );
}
