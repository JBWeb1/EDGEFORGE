import { useId } from "react";

/** EDGEFORGE "E" mark: a single angular stroke with the cyan → magenta forge gradient. */
export const LOGO_PATH =
  "M225 570 165 478 365 185H875L755 350H440L385 437H690L585 600H365L190 858H705L835 700H470";

export function LogoMark({ className, glow = false }: { className?: string; glow?: boolean }) {
  const id = useId();
  return (
    <svg viewBox="0 0 1024 1024" className={className} aria-hidden="true" fill="none">
      <defs>
        <linearGradient id={`${id}-g`} x1="160" y1="180" x2="860" y2="870" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#12E0FF" />
          <stop offset="0.5" stopColor="#6E6BFF" />
          <stop offset="1" stopColor="#E11BFF" />
        </linearGradient>
        {glow && (
          <filter id={`${id}-f`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="18" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>
      <path
        d={LOGO_PATH}
        stroke={`url(#${id}-g)`}
        strokeWidth="54"
        strokeLinejoin="miter"
        strokeMiterlimit="10"
        filter={glow ? `url(#${id}-f)` : undefined}
      />
    </svg>
  );
}

export function Logo({ className = "", subtitle = true }: { className?: string; subtitle?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-8 w-8 shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="font-semibold tracking-[0.18em] text-white">EDGEFORGE</span>
        {subtitle && (
          <span className="mt-1 text-[10px] font-medium tracking-[0.22em] text-brand-cyan/80">TRADING INTELLIGENCE</span>
        )}
      </span>
    </span>
  );
}
