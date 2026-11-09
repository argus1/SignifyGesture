import { Link } from "@tanstack/react-router";
import { Menu, ArrowLeft } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return <span className={cn("font-display text-2xl font-black tracking-tight text-primary", className)}>Signify</span>;
}

export function Avatar({ label, size = 40, tone = 0 }: { label: string; size?: number; tone?: number }) {
  const tones = ["bg-muted", "bg-accent", "bg-secondary"];
  return (
    <div
      role="img"
      aria-label={label}
      style={{ width: size, height: size }}
      className={cn("grid shrink-0 place-items-center rounded-full border-2 border-foreground font-bold", tones[tone % 3])}
    >
      <span style={{ fontSize: size * 0.38 }}>{label.slice(0, 1)}</span>
    </div>
  );
}

export function TopBar({ back }: { back?: string }) {
  return (
    <header className="grid grid-cols-[48px_1fr_48px] items-center px-4 pt-4 pb-2">
      {back ? (
        <Link to={back} aria-label="Go back" className="grid h-12 w-12 place-items-center rounded-full hover:bg-muted">
          <ArrowLeft className="h-6 w-6" />
        </Link>
      ) : (
        <Link to="/" aria-label="Home menu" className="grid h-12 w-12 place-items-center rounded-full hover:bg-muted">
          <Menu className="h-6 w-6" />
        </Link>
      )}
      <Link to="/home" className="justify-self-center" aria-label="Signify home"><Wordmark /></Link>
      <div className="justify-self-end"><Avatar label="Sam" /></div>
    </header>
  );
}

type PillProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "outline" | "mint" | "ghost"; size?: "md" | "sm" };
export function Pill({ variant = "outline", size = "md", className, ...p }: PillProps) {
  return (
    <button
      {...p}
      className={cn(
        "label-caps inline-flex items-center justify-center gap-2 rounded-full border-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 disabled:opacity-50",
        size === "md" ? "min-h-14 px-6 text-xs" : "min-h-11 px-4 text-[11px]",
        variant === "outline" && "border-foreground bg-background text-foreground hover:bg-muted",
        variant === "mint" && "border-primary bg-primary text-primary-foreground hover:brightness-95",
        variant === "ghost" && "border-transparent bg-muted text-foreground hover:bg-secondary",
        className,
      )}
    />
  );
}

export function PillLink({ to, children, variant = "outline", className }: { to: string; children: ReactNode; variant?: "outline" | "mint"; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "label-caps inline-flex min-h-14 items-center justify-center rounded-full border-2 px-6 text-xs focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40",
        variant === "outline" ? "border-foreground hover:bg-muted" : "border-primary bg-primary text-primary-foreground",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Headline({ dark, soft, className }: { dark: string; soft?: string; className?: string }) {
  return (
    <h1 className={cn("headline text-[44px]", className)}>
      {dark}
      {soft && <span className="block text-soft-headline">{soft}</span>}
    </h1>
  );
}
