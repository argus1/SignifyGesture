import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, Languages, MessageCircle, Users, BookOpen, type LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string | undefined }) {
  return <span className={cn("font-display text-2xl font-black tracking-tight text-primary", className)}>Signify</span>;
}

export function Avatar({ label, size = 40, tone = 0 }: { label: string; size?: number; tone?: number }) {
  const tones = ["bg-muted", "bg-accent", "bg-secondary"];
  return (
    <div
      role="img"
      aria-label={label}
      style={{ width: size, height: size }}
      className={cn("grid shrink-0 place-items-center rounded-full font-bold", tones[tone % 3])}
    >
      <span style={{ fontSize: size * 0.4 }}>{label.slice(0, 1)}</span>
    </div>
  );
}

/** Minimal header: optional back arrow on the left, wordmark centered. */
export function TopBar({ back, onDark = false }: { back?: string; title?: string; onDark?: boolean }) {
  return (
    <header className="grid grid-cols-[44px_1fr_44px] items-center px-4 pt-4 pb-2">
      {back ? (
        <Link to={back} aria-label="Go back" className="grid h-11 w-11 place-items-center rounded-full active:bg-muted">
          <ArrowLeft className="h-6 w-6" />
        </Link>
      ) : <span />}
      <Link to="/home" className="justify-self-center" aria-label="Signify home"><Wordmark className={cn("transition-colors duration-500", onDark && "text-white drop-shadow-sm")} /></Link>
      <span />
    </header>
  );
}

const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/home", label: "Translate", icon: Languages },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/community", label: "Community", icon: Users },
  { to: "/memory", label: "Memory", icon: BookOpen },
];

/**
 * Bottom icon tab bar — glass pill.
 * "dark" glass over the camera (home); "light" glass on white screens.
 */
export function TabBar({ tone = "light" }: { tone?: "light" | "dark" }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const dark = tone === "dark";
  return (
    <nav aria-label="Main"
      className={cn("sticky bottom-0 z-30 mx-4 mb-4 mt-auto grid grid-cols-5 rounded-full border p-1.5 backdrop-blur-xl backdrop-saturate-150 transition-[background-color,border-color,color,box-shadow] duration-500",
        dark
          ? "border-white/15 bg-neutral-900/80 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_30px_rgba(0,0,0,0.25)]"
          : "border-black/5 bg-white/85 text-foreground shadow-[0_8px_30px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.06)]")}>
      {TABS.map((t) => {
        const active = path === t.to || (t.to !== "/home" && path.startsWith(t.to));
        return (
          <Link key={t.to} to={t.to} aria-current={active ? "page" : undefined} aria-label={t.label}
            className={cn("grid h-14 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40",
              dark
                ? active ? "bg-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]" : "text-white/85 active:bg-white/10"
                : active ? "bg-black/[0.07] backdrop-blur-md" : "active:bg-black/5")}>
            <t.icon className="h-6 w-6" strokeWidth={active && !dark ? 2.6 : 2.25} aria-hidden />
          </Link>
        );
      })}
      <button type="button" aria-label="Your profile" onClick={() => toast("Profile coming soon")}
        className="grid h-14 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40">
        <span className="relative">
          <span className={cn("grid h-[30px] w-[30px] place-items-center rounded-full text-xs font-bold", dark ? "bg-primary text-foreground ring-2 ring-white/80" : "bg-accent text-foreground ring-2 ring-white")} role="img" aria-label="Sam">S</span>
          <span aria-hidden className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2", dark ? "ring-neutral-900" : "ring-white")} />
        </span>
      </button>
    </nav>
  );
}

/** Round icon button with an optional tiny label underneath. */
export function IconButton({
  icon: Icon, label, showLabel = false, tone = "soft", size = 52, className, ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; showLabel?: boolean; tone?: "soft" | "mint" | "dark" | "clear"; size?: number }) {
  return (
    <button {...p} aria-label={label} className={cn("flex flex-col items-center gap-1 focus-visible:outline-none", className)}>
      <span
        style={{ width: size, height: size }}
        className={cn("grid place-items-center rounded-full transition-colors focus-visible:ring-4",
          tone === "soft" && "bg-muted active:bg-secondary",
          tone === "mint" && "bg-primary text-primary-foreground active:brightness-95",
          tone === "dark" && "bg-foreground text-background",
          tone === "clear" && "bg-background/80 backdrop-blur active:bg-background",
          p["aria-pressed"] === true && tone === "soft" && "bg-foreground text-background")}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      {showLabel && <span className="text-[11px] font-medium text-muted-foreground">{label}</span>}
    </button>
  );
}

type PillProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "outline" | "mint" | "ghost"; size?: "md" | "sm" };
/** Text button. Use "mint" for the single main action on a screen; "ghost" for soft secondary chips. */
export function Pill({ variant = "ghost", size = "md", className, ...p }: PillProps) {
  return (
    <button
      {...p}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full text-center font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 disabled:opacity-50",
        size === "md" ? "min-h-14 px-6 text-base" : "min-h-10 px-4 text-sm",
        variant === "outline" && "border-2 border-foreground bg-background text-foreground active:bg-muted",
        variant === "mint" && "bg-primary text-primary-foreground active:brightness-95",
        variant === "ghost" && "bg-muted text-foreground active:bg-secondary",
        className,
      )}
    />
  );
}

export function PillLink({ to, children, variant = "mint", className }: { to: string; children: ReactNode; variant?: "outline" | "mint"; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex min-h-14 items-center justify-center rounded-full px-6 text-base font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40",
        variant === "outline" ? "bg-muted active:bg-secondary" : "bg-primary text-primary-foreground",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Small gray caps label ("SIGNIFY AGENT"). */
export function AgentLabel({ children = "Signify Agent" }: { children?: ReactNode }) {
  return <p className="label-caps text-[10px] font-semibold text-muted-foreground">{children}</p>;
}

/** Small status pill, e.g. "● Listening". */
export function StatusPill({ children, dot = "bg-primary" }: { children: ReactNode; dot?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-xs font-semibold backdrop-blur">
      <span aria-hidden className={cn("h-2 w-2 rounded-full", dot)} />
      {children}
    </span>
  );
}

export function Headline({ dark, soft, className }: { dark: string; soft?: string; className?: string }) {
  return (
    <h1 className={cn("headline text-[40px]", className)}>
      {dark}
      {soft && <span className="block text-soft-headline">{soft}</span>}
    </h1>
  );
}

/** A tappable list row on a soft surface — replaces "row + button" patterns. */
export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex items-center gap-3 rounded-3xl bg-muted/70 p-3", className)}>{children}</div>;
}
