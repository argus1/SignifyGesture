import { cn } from "@/lib/utils";

/**
 * The Signify Agent's little robot face (same shape as lucide "Bot"), but alive:
 * - idle: blinks every few seconds (sometimes a double blink)
 * - thinking (asking "which sign did you mean?"): eyes glance side to side
 * - off: eyes closed
 */
export function AgentIcon({ mood = "idle", className }: { mood?: "idle" | "thinking" | "off"; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className={cn("h-5 w-5", className)} aria-hidden>
      <g className={cn(mood === "idle" && "agent-antenna")}>
        <path d="M12 8V4H8" />
      </g>
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      {mood === "off" ? (
        <>
          <path d="M8 14h2" />
          <path d="M14 14h2" />
        </>
      ) : (
        <g className={mood === "thinking" ? "agent-eyes-look" : "agent-eyes-blink"}>
          <path d="M15 13v2" />
          <path d="M9 13v2" />
        </g>
      )}
    </svg>
  );
}
