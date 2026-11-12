import { Link, useRouterState } from "@tanstack/react-router";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
  type PanInfo,
} from "framer-motion";
import {
  MessageCircle,
  Users,
  BookOpen,
  ChevronLeft as ChevronLeftIcon,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type ComponentType,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useTheme, type ThemeChoice } from "@/lib/theme";

/* ---------------- Motion tokens (spec section 6) ---------------- */
export const EASE = [0.2, 0, 0, 1] as const;
export const EASE_EXIT = [0.4, 0, 1, 1] as const;
export const DUR = { fast: 0.15, base: 0.25, slow: 0.4 } as const;
export const SPRING_SHEET = { type: "spring", stiffness: 380, damping: 36, mass: 0.9 } as const;
export const SPRING_PILL = { type: "spring", stiffness: 500, damping: 40 } as const;
export const STAGGER = 0.04;

/** Press feedback for every tappable thing: scale 0.97 on press, spring back. */
export const press = { whileTap: { scale: 0.97 }, transition: { duration: DUR.fast } } as const;

/* ---------------- Brand ---------------- */

/** "Signify" wordmark from Figma (58 × 19). Mint on white screens, white on camera screens. */
export function Wordmark({ className }: { className?: string | undefined }) {
  return (
    <svg
      viewBox="0 0 59 20"
      width="58"
      height="19"
      className={cn("text-primary", className)}
      role="img"
      aria-label="Signify"
      fill="currentColor"
    >
      <path d="M15.1437 0.396563C15.7386 0.867507 15.9131 1.63339 15.6561 2.31101C15.4188 2.94011 14.7932 3.36253 14.0723 3.38063C13.3084 3.40049 12.6469 2.98688 12.4005 2.33088C12.1272 1.60648 12.3251 0.837083 12.9416 0.362619C13.5762 -0.126428 14.4839 -0.126428 15.1437 0.396815V0.396563Z" />
      <path d="M15.4736 14.9494H12.582V4.77139L15.4716 4.76611L15.4736 14.9494Z" />
      <path d="M9.93105 13.858C8.97106 14.7323 7.46646 15.0838 6.36264 15.1419C1.95166 15.3737 0.237861 12.638 0 10.5245H3.02153C3.26493 11.838 4.4311 12.6069 5.96336 12.6111C7.01161 12.6139 8.29721 12.145 8.34448 10.9627C8.38496 9.9459 7.68647 9.53983 6.63797 9.30348L5.00538 8.94794C4.28149 8.79255 1.55741 8.36033 0.740486 6.31865C0.345476 5.28549 0.386713 4.04867 0.813906 3.02632C1.71933 0.879543 4.24352 0.503894 5.82633 0.567508C8.12648 0.660037 10.5114 2.04395 10.879 4.75345H7.98442C7.80489 4.00869 7.28341 3.54127 6.65079 3.27851C4.8344 2.5242 2.64337 3.68333 3.58953 5.29983C3.86033 5.76222 4.44844 6.01089 5.10017 6.14667C5.59224 6.24926 6.08355 6.3624 6.44185 6.43356C7.67465 6.67871 8.61553 6.91456 9.38216 7.37872C10.351 7.93465 10.9557 8.85717 11.2174 9.93911C11.5194 11.3957 11.0427 12.891 9.93105 13.858Z" />
      <path d="M36.9215 6.17145C35.8958 4.9296 34.5094 4.563 32.905 4.5625C31.2802 4.56627 29.9156 4.92935 28.89 6.1712C28.3788 6.78999 28.2212 7.49829 28.2212 8.34941V14.9492L31.1132 14.96V8.72129C31.0919 7.79876 31.7139 7.10353 32.9057 7.10353C33.5904 7.10353 34.7088 7.37031 34.7088 8.71047V14.9489H37.5903V8.34916C37.5903 7.49804 37.4329 6.78974 36.9217 6.17095V6.17145H36.9215Z" />
      <path d="M26.9718 9.85603C26.9718 6.55414 24.6724 4.5625 21.8354 4.5625C18.9984 4.5625 16.7377 6.52145 16.7 9.77456C16.6374 12.9216 18.84 15.1659 21.8354 15.1496C22.634 15.1453 23.39 14.9917 24.0642 14.6912C24.0642 14.9507 23.8753 16.9609 21.7341 16.9609C20.5943 16.9609 19.9717 16.4193 19.6527 15.7402H16.8599C17.2482 18.0582 19.3492 19.2666 21.8347 19.2666C25.2497 19.2666 26.9718 17.0258 26.9718 14.3108V9.85603ZM21.8362 12.5954C20.4203 12.5954 19.2725 11.5648 19.2725 9.85603C19.2725 8.14725 20.4203 7.11661 21.8362 7.11661C23.252 7.11661 24.3998 8.14725 24.3998 9.85603C24.3998 11.5648 23.252 12.5954 21.8362 12.5954Z" />
      <path d="M55.257 4.74649L52.9666 11.6261L50.6129 4.74649H46.6206V3.79354C46.6206 3.22353 46.9019 2.84587 47.269 2.61304C47.6821 2.35104 48.2489 2.37216 48.8624 2.37216V0.0853338C48.1983 0.0262459 47.6578 0.012668 46.9663 0.0639614C44.7914 0.225385 43.6891 2.16146 43.727 4.19333V14.9335H46.6206V7.09694H48.5119L51.422 15.0537C50.8379 16.0469 50.059 16.3194 48.832 16.3194C48.4591 16.3194 48.3713 16.3189 48.3701 16.3189V18.6905C48.3728 18.6908 48.6303 18.7066 49.0208 18.7066C52.0393 18.7066 53.5447 17.371 54.5799 14.5277L58.2307 4.74649H55.2567H55.257Z" />
      <path d="M41.6705 0.396563C42.2654 0.867507 42.4399 1.63339 42.183 2.31101C41.9456 2.94011 41.32 3.36253 40.5992 3.38063C39.8353 3.40049 39.1738 2.98688 38.9273 2.33088C38.654 1.60648 38.8519 0.837083 39.4684 0.362619C40.1031 -0.126428 41.0108 -0.126428 41.6705 0.396815V0.396563Z" />
      <path d="M42.0004 14.9494H39.1089V4.77139L41.9984 4.76611L42.0004 14.9494Z" />
    </svg>
  );
}

/** The S mark. Light: white ends → #01D190 core. Dark: black ends → #00E59D core (Tania's dark logo). */
export function LogoMark({
  className,
  dotsCutOut = true,
}: {
  className?: string;
  dotsCutOut?: boolean;
}) {
  const { dark } = useTheme();
  const id = dark ? "mark-d" : "mark-l";
  const stops = dark
    ? ["#000", "#005D3F", "#00AA74", "#00E59D", "#00AA74", "#005D3F", "#000"]
    : ["#fff", "#87E5C9", "#3ADBA9", "#01D190", "#3DD9A8", "#87E5C9", "#fff"];
  return (
    <svg viewBox="0 0 71 72" className={className} aria-hidden>
      <defs>
        <linearGradient
          id={id}
          x1="35.15"
          y1="-4.84"
          x2="35.15"
          y2="78.8"
          gradientUnits="userSpaceOnUse"
        >
          {stops.map((c, i) => (
            <stop key={i} offset={i / 6} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <path
        fillRule={dotsCutOut ? "evenodd" : "nonzero"}
        clipRule="evenodd"
        fill={`url(#${id})`}
        d="M42.1181 28.1009H48.3529C60.4756 28.101 70.3025 37.9278 70.3025 50.0505C70.3025 62.1732 60.4756 72 48.3529 72H3.76842L28.1843 43.8991H21.9496C9.82686 43.8991 1.79015e-05 34.0723 0 21.9496C0 9.82685 9.82685 0 21.9496 0H66.534L42.1181 28.1009ZM40.631 35.0163C36.6046 35.0163 33.3406 38.2803 33.3405 42.3067C33.3405 46.3331 36.6046 49.5972 40.631 49.5972C44.6574 49.5972 47.9215 46.3331 47.9215 42.3067C47.9215 38.2803 44.6574 35.0163 40.631 35.0163ZM29.6709 22.4023C25.6445 22.4023 22.3804 25.6664 22.3804 29.6929C22.3804 33.7193 25.6445 36.9833 29.6709 36.9833C33.6973 36.9833 36.9613 33.7193 36.9613 29.6929C36.9613 25.6664 33.6973 22.4023 29.6709 22.4023Z"
      />
    </svg>
  );
}

/* ---------------- Screen + header ---------------- */

/**
 * Page wrapper with the entrance motion.
 * push: slides in from x +24 and fades (dur.slow). tab: cross-fades with an 8px upward drift (dur.base).
 */
export function Screen({
  children,
  className,
  kind = "push",
}: {
  children: ReactNode;
  className?: string;
  kind?: "push" | "tab" | "fade";
}) {
  const reduce = useReducedMotion();
  const initial = reduce
    ? { opacity: 0 }
    : kind === "push"
      ? { opacity: 0, x: 24 }
      : kind === "tab"
        ? { opacity: 0, y: 8 }
        : { opacity: 0 };
  return (
    <motion.div
      initial={initial}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{
        duration: reduce ? DUR.fast : kind === "push" ? DUR.slow : DUR.base,
        ease: EASE,
      }}
      className={cn("relative flex flex-1 flex-col", className)}
    >
      {children}
    </motion.div>
  );
}

/** 44px round header button: rgba(255,255,255,.22), 0.5px border (#D2D2D2, or white on camera screens). */
export function HeaderIconButton({
  icon: Icon,
  label,
  onClick,
  to,
  onCamera = false,
  size = 14,
  className,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  to?: string;
  onCamera?: boolean;
  size?: number;
  className?: string;
}) {
  const cls = cn(
    "grid h-11 w-11 place-items-center rounded-full border-[0.5px] bg-white/[0.22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
    onCamera ? "border-white text-black dark:text-white" : "border-line-icon",
    className,
  );
  const icon = <Icon style={{ width: size, height: size }} aria-hidden />;
  if (to) {
    return (
      <motion.span {...press} className="inline-grid">
        <Link to={to} aria-label={label} className={cls}>
          {icon}
        </Link>
      </motion.span>
    );
  }
  return (
    <motion.button {...press} type="button" aria-label={label} onClick={onClick} className={cls}>
      {icon}
    </motion.button>
  );
}

/**
 * Header row: wordmark centered at y 26; 44px buttons at x 20 / x 326, y 13.6.
 * leftExtra sits where the "● LIVE" tag goes on the camera screens.
 */
export function Header({
  left,
  right,
  onCamera = false,
  center,
}: {
  left?: ReactNode;
  right?: ReactNode;
  onCamera?: boolean;
  center?: ReactNode;
}) {
  return (
    <header className="relative z-20 grid h-[72px] shrink-0 grid-cols-[64px_1fr_64px] items-start px-5 pt-[14px]">
      <div className="flex h-11 items-center">{left}</div>
      <div className="flex justify-center pt-3">
        {center ?? (
          <Link
            to="/home"
            aria-label="Signify home"
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Wordmark className={onCamera ? "text-white" : undefined} />
          </Link>
        )}
      </div>
      <div className="flex h-11 items-center justify-end">{right}</div>
    </header>
  );
}

/** Kept for older screens: just the header with an optional back link. */
export function TopBar({
  back,
  onDark = false,
}: {
  back?: string;
  title?: string;
  onDark?: boolean;
}) {
  return (
    <Header
      onCamera={onDark}
      left={
        back ? (
          <HeaderIconButton icon={ChevronLeftIcon} label="Go back" to={back} size={16} />
        ) : undefined
      }
    />
  );
}

/** Page title: Sora 20, 0.12em, uppercase at x 20, y 92. sub = eyebrow line under it. */
export function PageTitle({
  title,
  action,
  sub,
}: {
  title: string;
  action?: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="px-5 pt-5">
      <div className="flex min-h-[25px] items-center justify-between gap-3">
        <h1 className="t-title leading-none">{title}</h1>
        {action}
      </div>
      {sub && <div className="mt-[22px]">{sub}</div>}
    </div>
  );
}

/** Eyebrow / label: Sora 11, 0.12em, uppercase, #6B6B6B. */
export function Eyebrow({
  children,
  icon: Icon,
  className,
}: {
  children: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <p className={cn("t-label flex items-center gap-[7px] text-ink-3", className)}>
      {Icon && <Icon className="h-[10px] w-[10px] shrink-0" aria-hidden />}
      {children}
    </p>
  );
}

/* ---------------- Buttons ---------------- */

type BtnProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onAnimationStart" | "onDrag" | "onDragStart" | "onDragEnd" | "style"
> & { icon?: LucideIcon };

/** 350 × 64 mint pill. Label: Sora SemiBold 11 / 0.12em / uppercase / black, optional 13px icon 10px after. */
export function PrimaryButton({ children, icon: Icon, className, ...p }: BtnProps) {
  return (
    <motion.button
      {...press}
      {...p}
      className={cn(
        "t-btn inline-flex h-16 w-full items-center justify-center gap-[10px] rounded-full bg-primary text-black transition-[filter] active:brightness-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground disabled:opacity-50",
        className,
      )}
    >
      {children}
      {Icon && <Icon className="h-[13px] w-[13px]" aria-hidden />}
    </motion.button>
  );
}

/** Skip-style button: transparent with a hairline, same label style. */
export function SecondaryButton({ children, className, ...p }: BtnProps) {
  return (
    <motion.button
      {...press}
      {...p}
      className={cn(
        "t-btn inline-flex h-11 items-center justify-center rounded-full border-[0.3px] border-foreground px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

/** Round 44px tool button (agent / type / sound) in the right-hand column. */
export function RoundButton({
  icon: Icon,
  label,
  onClick,
  dot = false,
  pulse = false,
  pressed,
  size = 17,
  className,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  dot?: boolean;
  pulse?: boolean;
  pressed?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <motion.button
      {...press}
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "relative grid h-11 w-11 place-items-center rounded-full bg-surface backdrop-blur-[24px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className,
      )}
    >
      <Icon style={{ width: size, height: size }} aria-hidden />
      {dot && (
        <span
          aria-hidden
          className={cn(
            "absolute -right-0.5 top-0 h-3 w-3 rounded-full bg-primary",
            pulse && "dot-pulse",
          )}
        />
      )}
    </motion.button>
  );
}

/* ---------------- Tab bar ---------------- */

/** Tania's hand from the Figma handoff ("Hand icon"). Outline only, same weight as the other tab icons. */
export function HandIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-1.5 -1.5 38 39"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.88}
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M 16.38 34.24 C 18.19 35.97 26.53 36.46 28.27 35.78 C 30.02 35.11 32.61 33.02 34.54 30.44 C 35.48 29.18 34.54 8.17 34.54 8.17 C 34.11 7.72 32.93 6.8 31.65 6.68 C 30.95 6.83 29.43 7.34 28.92 8.17 L 28.92 14.7 L 13.18 0.3 C 12.54 0.05 11.11 -0.38 9.96 0.69 C 9.69 0.98 8.83 1.58 9.64 3.36 L 18.8 12.33 C 19.01 12.72 19.15 13.48 18 13.37 L 6.11 2.08 C 5.42 1.93 4.18 1.43 2.9 2.53 C 2.09 3.36 2.52 4.73 2.9 5.44 L 14.3 16.33 C 14.36 16.68 14.21 17.34 13.18 17.23 L 4.18 9 C 3.53 8.46 2.42 7.81 0.81 8.76 C 0.28 9.41 -0.53 10.96 0.49 12.03 L 11.25 21.98 L 11.25 23.16 L 5.15 17.97 C 4.62 17.62 3.19 17.26 1.78 18.56 C 1.4 19.06 0.88 20.31 1.78 21.38 C 2.68 22.45 11.83 29.89 16.38 34.24 Z" />
    </svg>
  );
}

const TABS: { to: string; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { to: "/home", label: "Translate", icon: HandIcon },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/community", label: "Community", icon: Users },
  { to: "/memory", label: "Memory", icon: BookOpen },
];

/** 350 × 69 glass pill at y 745. The gray highlight slides between tabs (layoutId, spring.pill). */
export function TabBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [themeOpen, setThemeOpen] = useState(false);
  return (
    <>
      <nav
        aria-label="Main"
        className="relative z-30 mx-5 mb-[31px] mt-auto grid h-[69px] shrink-0 grid-cols-5 items-center rounded-full border-[0.75px] border-black/5 bg-[rgba(var(--glass-rgb),0.85)] px-[5px] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-[48px] dark:border-[0.5px] dark:border-white"
      >
        {TABS.map((t) => {
          const active = path === t.to || (t.to !== "/home" && path.startsWith(t.to));
          return (
            <Link
              key={t.to}
              to={t.to}
              aria-current={active ? "page" : undefined}
              aria-label={t.label}
              className="relative grid h-12 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {active && (
                <motion.span
                  layoutId="tab-highlight"
                  transition={SPRING_PILL}
                  className="absolute inset-y-0 left-1/2 w-[58px] -translate-x-1/2 rounded-full bg-tab-active"
                />
              )}
              <t.icon className="relative h-5 w-5" aria-hidden />
            </Link>
          );
        })}
        <button
          type="button"
          aria-label="Your profile and appearance"
          onClick={() => setThemeOpen(true)}
          className="grid h-12 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span
            className="relative grid h-[30px] w-[30px] place-items-center rounded-full bg-avatar text-[12px] font-medium text-black dark:text-white"
            role="img"
            aria-label="Sam"
          >
            S
            <span
              aria-hidden
              className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full bg-primary"
            />
          </span>
        </button>
      </nav>
      <ThemeSheet open={themeOpen} onClose={() => setThemeOpen(false)} />
    </>
  );
}

/** Profile sheet: Appearance, Light or Dark. */
function ThemeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { choice, setChoice } = useTheme();
  const opts: { id: ThemeChoice; label: string }[] = [
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
  ];
  return (
    <GlassSheet open={open} onClose={onClose} label="Appearance">
      <div className="px-5 pb-10 pt-6">
        <Eyebrow className="justify-center">Appearance</Eyebrow>
        <div role="radiogroup" aria-label="Appearance" className="mt-5 grid gap-2.5">
          {opts.map((o) => {
            const on = choice === o.id;
            return (
              <motion.button
                key={o.id}
                {...press}
                role="radio"
                aria-checked={on}
                onClick={() => setChoice(o.id)}
                className={cn(
                  "flex h-14 items-center justify-between rounded-full px-6 text-[16px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  on
                    ? "border-2 border-primary bg-surface"
                    : "border-[0.5px] border-line-strong bg-card",
                )}
              >
                {o.label}
                <Radio on={on} />
              </motion.button>
            );
          })}
        </div>
      </div>
    </GlassSheet>
  );
}

export function Radio({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-5 w-5 place-items-center rounded-full",
        on ? "bg-primary" : "border-[0.5px] border-line-strong bg-white dark:bg-transparent",
      )}
    >
      {on && <span className="h-2 w-2 rounded-full bg-white" />}
    </span>
  );
}

/* ---------------- Glass sheet ---------------- */

/**
 * Bottom sheet (spec Effects + 6 "Sheet up / down"). Backdrop fades in, the sheet rises on spring.sheet,
 * follows the finger from the grabber, and closes past 30% of its height, on a flick, on the backdrop or Escape.
 */
export function GlassSheet({
  open,
  onClose,
  children,
  label,
  className,
  backdrop = true,
  layout = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  className?: string;
  backdrop?: boolean;
  /** "Sheet grow": animate the height when the content changes (Share step 1 → step 2) */
  layout?: boolean;
}) {
  const controls = useDragControls();
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  // Sheets always cover the whole phone, wherever the button that opens them lives
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.getElementById("phone-frame")), []);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    const h = (document.getElementById("glass-sheet")?.offsetHeight ?? 400) * 0.3;
    if (info.offset.y > h || info.velocity.y > 500) onClose();
  };
  if (!host) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end">
          {backdrop && (
            <motion.button
              type="button"
              aria-label="Close"
              tabIndex={-1}
              onClick={onClose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: DUR.base, ease: EASE_EXIT } }}
              transition={{ duration: DUR.base }}
              className="absolute inset-0 bg-[var(--scrim)] dark:backdrop-blur-[4px]"
            />
          )}
          <motion.div
            id="glass-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            drag={reduce ? false : "y"}
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 1 }}
            onDragEnd={onDragEnd}
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={
              reduce
                ? { opacity: 0 }
                : { y: "100%", transition: { duration: DUR.slow, ease: EASE_EXIT } }
            }
            transition={reduce ? { duration: DUR.fast } : SPRING_SHEET}
            className={cn(
              "glass-sheet relative max-h-[92%] overflow-y-auto rounded-t-[24px]",
              className,
            )}
          >
            <div
              onPointerDown={(e) => controls.start(e)}
              className="sticky top-0 z-10 flex h-6 cursor-grab touch-none justify-center pt-2.5"
            >
              <span className="h-1 w-10 rounded-full bg-grabber" />
            </div>
            <AutoHeight enabled={layout}>
              <motion.div
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: STAGGER, delayChildren: 0.05 } },
                }}
              >
                {children}
              </motion.div>
            </AutoHeight>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    host,
  );
}

/** Animates its height to fit the content (spring.sheet). Used for "sheet grow". */
export function AutoHeight({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const [h, setH] = useState<number | "auto">("auto");
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!el || !enabled) return;
    const ro = new ResizeObserver(() => setH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, enabled]);
  if (!enabled) return <>{children}</>;
  return (
    <motion.div
      animate={{ height: h }}
      initial={false}
      transition={SPRING_SHEET}
      style={{ overflow: "hidden" }}
    >
      <div ref={setEl}>{children}</div>
    </motion.div>
  );
}

/** Child of a GlassSheet that fades up 8px in the stagger. */
export function SheetItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ---------------- Small parts ---------------- */

/** 48px circle with an initial (Messages, Community). */
export function Avatar({ label, size = 48 }: { label: string; size?: number; tone?: number }) {
  return (
    <div
      role="img"
      aria-label={label}
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-full bg-surface text-[16px] font-medium"
    >
      {label.slice(0, 1)}
    </div>
  );
}

/** "6 SIGNS" style tag: 22px tall, 1.5px mint border. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="t-label inline-flex h-[22px] items-center rounded-full border-[1.5px] border-primary px-2.5 leading-none text-foreground">
      {children}
    </span>
  );
}

/* ---------------- Legacy helpers (older routes still use these) ---------------- */

type PillProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "outline" | "mint" | "ghost";
  size?: "md" | "sm";
};
export function Pill({ variant = "ghost", size = "md", className, ...p }: PillProps) {
  return (
    <button
      {...p}
      className={cn(
        "t-btn inline-flex items-center justify-center gap-2 rounded-full text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
        size === "md" ? "min-h-14 px-6" : "min-h-10 px-4",
        variant === "outline" && "border-[0.5px] border-foreground",
        variant === "mint" && "bg-primary text-black active:brightness-95",
        variant === "ghost" && "bg-surface",
        className,
      )}
    />
  );
}

export function PillLink({
  to,
  children,
  variant = "mint",
  className,
}: {
  to: string;
  children: ReactNode;
  variant?: "outline" | "mint";
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "t-btn inline-flex min-h-14 items-center justify-center rounded-full px-6",
        variant === "outline" ? "bg-surface" : "bg-primary text-black",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function IconButton({
  icon: Icon,
  label,
  showLabel = false,
  tone = "soft",
  size = 52,
  className,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  showLabel?: boolean;
  tone?: "soft" | "mint" | "dark" | "clear";
  size?: number;
}) {
  return (
    <button
      {...p}
      aria-label={label}
      className={cn("flex flex-col items-center gap-1 focus-visible:outline-none", className)}
    >
      <span
        style={{ width: size, height: size }}
        className={cn(
          "grid place-items-center rounded-full",
          tone === "mint"
            ? "bg-primary text-black"
            : tone === "dark"
              ? "bg-foreground text-background"
              : "bg-surface",
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      {showLabel && <span className="t-label text-ink-3">{label}</span>}
    </button>
  );
}

export function AgentLabel({ children = "Signify Agent" }: { children?: ReactNode }) {
  return <p className="t-label text-ink-3">{children}</p>;
}

export function StatusPill({
  children,
  dot = "bg-primary",
}: {
  children: ReactNode;
  dot?: string;
}) {
  return (
    <span
      role="status"
      className="t-label inline-flex items-center gap-2 rounded-full bg-card/90 px-3 py-1.5 backdrop-blur"
    >
      <span aria-hidden className={cn("h-2 w-2 rounded-full", dot)} />
      {children}
    </span>
  );
}

export function Headline({
  dark,
  soft,
  className,
}: {
  dark: string;
  soft?: string;
  className?: string;
}) {
  return (
    <h1 className={cn("headline text-[41.9px]", className)}>
      {dark}
      {soft && <span className="block text-ink-4">{soft}</span>}
    </h1>
  );
}

export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-3xl bg-surface p-3", className)}>
      {children}
    </div>
  );
}
