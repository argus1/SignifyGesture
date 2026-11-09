/**
 * Signify logo rebuilt as SVG so it can animate:
 * the two halves of the S slide together along the diagonal, the two dots pop in,
 * then the wordmark rises letter by letter. Respects prefers-reduced-motion (see styles.css).
 */
export function AnimatedLogo({ className }: { className?: string }) {
  const letters = "Signify".split("");
  return (
    <div className={className} role="img" aria-label="Signify">
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 345 348" className="h-20 w-20 overflow-visible" aria-hidden>
          <defs>
            <linearGradient id="sg-mint" x1="0" y1="0" x2="0" y2="348" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#DDFBF0" />
              <stop offset="0.5" stopColor="#12E2A0" />
              <stop offset="1" stopColor="#DDFBF0" />
            </linearGradient>
          </defs>
          {/* top half: rounded left, cut by the diagonal */}
          <path className="logo-top" d="M100 3 H320 L137 212 H100 A104.5 104.5 0 0 1 100 3 Z" fill="url(#sg-mint)" />
          {/* bottom half: rounded right, cut by the same diagonal */}
          <path className="logo-bottom" d="M203 138 H240 A103.5 103.5 0 0 1 240 345 H20 Z" fill="url(#sg-mint)" />
          <circle className="logo-dot logo-dot-1" cx="140" cy="140" r="28" fill="#fff" />
          <circle className="logo-dot logo-dot-2" cx="197" cy="203" r="34" fill="#fff" />
        </svg>
        <span className="flex text-[54px] font-extrabold leading-none tracking-tight" aria-hidden>
          {letters.map((l, i) => (
            <span key={i} className="logo-letter inline-block" style={{ animationDelay: `${600 + i * 45}ms` }}>{l}</span>
          ))}
        </span>
      </div>
    </div>
  );
}
