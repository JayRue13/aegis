import { useId } from "react";

/** The AEGIS mark: a symmetrical, fluid four-point star over a faint diagonal echo. */
export function Logo({
  size = 28,
  animated = false,
  className,
}: {
  size?: number;
  animated?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-label="AEGIS" role="img">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a99bff" />
          <stop offset="0.55" stopColor="#7c8cff" />
          <stop offset="1" stopColor="#5fe3ff" />
        </linearGradient>
      </defs>
      <g className={animated ? "animate-star" : undefined}>
        <path
          transform="rotate(45 32 32)"
          opacity="0.35"
          fill={`url(#g${id})`}
          d="M32 14 C33.6 27 37 30.4 50 32 C37 33.6 33.6 37 32 50 C30.4 37 27 33.6 14 32 C27 30.4 30.4 27 32 14 Z"
        />
        <path
          fill={`url(#g${id})`}
          d="M32 4 C34.4 25 39 29.6 60 32 C39 34.4 34.4 39 32 60 C29.6 39 25 34.4 4 32 C25 29.6 29.6 25 32 4 Z"
        />
      </g>
    </svg>
  );
}
