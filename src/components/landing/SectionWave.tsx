type SectionWaveProps = {
  /** Color(s) of the section this wave belongs to (fills the wave body). */
  fill: string;
  /** Secondary accent fill for a subtle two-tone depth (optional). */
  fillAccent?: string;
  /** Flip the wave so the trough (rather than peak) points downward. */
  flip?: boolean;
  /** Height in px of the wave band. */
  height?: number;
  className?: string;
};

/**
 * SectionWave — SVG curve divider used to transition between themed sections.
 * Rendered at the boundary, filled with the destination section's theme color
 * so it carves a smooth curved edge through the previous section's background
 * (no hard rectangle seam). Decorative; pointer-events disabled.
 */
export function SectionWave({
  fill,
  fillAccent,
  flip = false,
  height = 72,
  className,
}: SectionWaveProps) {
  const h = Math.max(40, height);
  return (
    <div
      aria-hidden
      className={`pointer-events-none relative z-10 w-full overflow-hidden leading-none ${className ?? ''}`}
      style={{ height: h }}
    >
      <svg
        className="block w-full h-full"
        viewBox={`0 0 1440 ${h}`}
        preserveAspectRatio="none"
      >
        {flip ? (
          <path
            d={`M0 ${h} C 240 10, 480 10, 720 ${h * 0.55} C 960 ${h * 0.95}, 1200 40, 1440 ${h * 0.6} L 1440 ${h} L 0 ${h} Z`}
            fill={fill}
          />
        ) : (
          <path
            d={`M0 0 C 240 60, 480 60, 720 12 C 960 -30, 1200 10, 1440 44 L 1440 0 L 0 0 Z`}
            fill={fill}
          />
        )}
        {fillAccent && (
          <path
            d={`M0 ${h} L 0 ${h * 0.72} C 360 ${h * 0.2}, 720 ${h * 0.9}, 1080 ${h * 0.55} C 1220 ${h * 0.42}, 1340 ${h * 0.6}, 1440 ${h * 0.7} L 1440 ${h} Z`}
            fill={fillAccent}
            opacity={0.35}
          />
        )}
      </svg>
    </div>
  );
}
