import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import { LogoMark, Wordmark } from "@/components/signify/ui";
import { useTheme } from "@/lib/theme";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () =>
    seo(
      "Every conversation, understood",
      "Signify helps Deaf and hearing people talk face to face.",
    ),
  component: Launch,
});

/** Mark-relative positions (the mark is 70.3 × 72). Dot centers in the final mark. */
const D1 = { x: 29.4, y: 29.4 };
const D2 = { x: 40.4, y: 42.1 };
const OUT_BACK = [0.34, 1.56, 0.64, 1] as const;
const IN_OUT = [0.65, 0, 0.35, 1] as const;

/**
 * 01 Launch (spec section 7), 6.3s: two dots pop in, line up on the diagonal, the group twists 180° → 0°
 * (the ASL "interpret" twist), the mark flips open around them, settles into the lockup, the wordmark rises,
 * the loading bar fills, then Home. Tap anywhere to skip.
 */
function Launch() {
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const { dark } = useTheme();
  const go = () => nav({ to: "/home" });
  useEffect(() => {
    const t = setTimeout(go, reduce ? 1000 : 6300);
    return () => clearTimeout(t);
  }, [reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  const cut = dark ? "#000000" : "#ffffff"; // dots turn into cut-outs at the flip
  const t = (s: number) => (reduce ? 0 : s);

  return (
    <button
      onClick={go}
      aria-label="Signify is loading. Tap to continue."
      className="relative flex-1 overflow-hidden bg-background focus-visible:outline-none"
    >
      {/* Mark group: starts big in the screen center, settles into the lockup at [159.8, 352.7] */}
      <motion.div
        className="absolute left-[159.8px] top-[352.7px] h-[72px] w-[70.3px]"
        initial={reduce ? false : { y: 33.8, scale: 2.347 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ delay: t(3.4), duration: t(0.6), ease: IN_OUT }}
      >
        <motion.div
          className="absolute inset-0"
          initial={reduce ? false : { rotate: 180 }}
          animate={{ rotate: 0 }}
          transition={{ delay: t(2.0), duration: t(0.9), ease: IN_OUT }}
        >
          <motion.div
            className="absolute inset-0"
            initial={reduce ? false : { scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ delay: t(2.34), duration: t(0.5), ease: OUT_BACK }}
          >
            <LogoMark className="h-full w-full" />
          </motion.div>
          {[D1, D2].map((d, i) => (
            <motion.span
              key={i}
              aria-hidden
              className="absolute h-[14px] w-[14px] rounded-full"
              style={{ left: d.x - 7, top: d.y - 7 }}
              initial={
                reduce
                  ? false
                  : {
                      scale: 0,
                      x: i === 0 ? -3.4 : 3.6,
                      y: i === 0 ? 6.35 : -6.35,
                      backgroundColor: "#01D190",
                    }
              }
              animate={{
                scale: 1,
                x: 0,
                y: 0,
                backgroundColor: cut,
              }}
              transition={{
                scale: {
                  delay: t(i === 0 ? 0.3 : 0.9),
                  type: "spring",
                  stiffness: 520,
                  damping: 14,
                },
                x: { delay: t(1.3), duration: t(0.7), ease: IN_OUT },
                y: { delay: t(1.3), duration: t(0.7), ease: IN_OUT },
                backgroundColor: { delay: t(2.34), duration: t(0.01) },
              }}
            />
          ))}
        </motion.div>
      </motion.div>

      {/* Wordmark fades in while rising 20px into place */}
      <motion.div
        className="absolute left-[121.7px] top-[443.7px] text-foreground"
        initial={reduce ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: t(3.8), duration: t(0.5), ease: "easeOut" }}
      >
        <Wordmark className="h-[48.5px] w-[146.7px] text-foreground" />
      </motion.div>

      {/* Loading bar: track #E6E6E6, mint fill 1 → 96px */}
      <motion.div
        className="absolute left-[147px] top-[657.9px] h-[3px] w-[96px] overflow-hidden rounded-full bg-[#E6E6E6] dark:bg-[#2E2E2E]"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: t(4.2), duration: t(0.3) }}
      >
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={reduce ? false : { width: 1 }}
          animate={{ width: 96 }}
          transition={{ delay: t(4.4), duration: t(1.2), ease: IN_OUT }}
        />
      </motion.div>
    </button>
  );
}
