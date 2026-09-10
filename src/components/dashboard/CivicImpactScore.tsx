'use client';

import { useEffect, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { CivicImpactItem } from '@/lib/issues/types';

/**
 * CivicImpactScore — the transparency-led differentiator.
 *
 * Renders a single "predicted civic impact" total with a radial gauge and a
 * per-factor breakdown (Severity / 30, Population / 25, School–Hospital / 20,
 * Citizen Reports / 15, Duration / 10), plus the verdict banner.
 *
 * This is what lets an officer answer "why solve THIS before THAT?" — not by
 * submission order, but by predicted civic impact. Everything shown is real,
 * computed data; unavailable factors are surfaced as "n/a" rather than faked.
 */

const VERDICT_STYLES: Record<string, { text: string; ring: string; badge: string; stroke: string; track: string }> = {
  CRITICAL: {
    text: 'text-red-600 dark:text-red-400',
    ring: 'ring-red-500/30',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
    stroke: '#ef4444',
    track: 'text-red-200 dark:text-red-900/40',
  },
  HIGH: {
    text: 'text-amber-600 dark:text-amber-400',
    ring: 'ring-amber-500/30',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    stroke: '#f59e0b',
    track: 'text-amber-200 dark:text-amber-900/40',
  },
  MEDIUM: {
    text: 'text-brand-600 dark:text-brand-400',
    ring: 'ring-brand-500/30',
    badge: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 border-brand-200 dark:border-brand-800',
    stroke: '#4f46e5',
    track: 'text-brand-200 dark:text-brand-900/40',
  },
  LOW: {
    text: 'text-emerald-600 dark:text-emerald-400',
    ring: 'ring-emerald-500/30',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    stroke: '#10b981',
    track: 'text-emerald-200 dark:text-emerald-900/40',
  },
};

const DEFAULT_STYLE = VERDICT_STYLES.LOW;

function RadialGauge({ score, stroke }: { score: number; stroke: string }) {
  const reduce = useReducedMotion();
  const ref = { current: null as SVGElement | null };
  const inView = useInView(ref as never, { once: true, amount: 0.4 });
  const [display, setDisplay] = useState(reduce ? score : 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  const offset = C - (Math.min(100, Math.max(0, display)) / 100) * C;

  useEffect(() => {
    if (!inView || reduce) return;
    let raf = 0;
    const start = performance.now();
    const duration = 1100;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(score * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setDisplay(score);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, score]);

  return (
    <div className="relative w-32 h-32" ref={ref as never}>
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        {/* track */}
        <circle cx="60" cy="60" r={R} fill="none" strokeWidth="10" className="stroke-neutral-200 dark:stroke-dark-border" />
        {/* progress */}
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={stroke}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold text-neutral-900 dark:text-white tabular-nums">
          {Math.round(display)}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-medium">/100 impact</span>
      </div>
    </div>
  );
}

const NO_UNSET_STYLE = { width: '0%' };

export function CivicImpactScore({
  impact,
  compact = false,
}: {
  impact: CivicImpactItem;
  compact?: boolean;
}) {
  const style = VERDICT_STYLES[impact?.verdict ?? ''] ?? DEFAULT_STYLE;

  if (!impact) {
    return (
      <div className="p-5 rounded-xl border border-neutral-200 dark:border-dark-border bg-neutral-50/60 dark:bg-dark-bg text-sm text-neutral-500">
        Civic impact analysis is pending — it is computed once the report has been classified.
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-11 h-11 rounded-full ring-2 flex items-center justify-center',
            style.ring,
            'bg-white dark:bg-dark-bg-card',
          )}
        >
          <span className={cn('font-display text-lg font-bold tabular-nums', style.text)}>{impact.score}</span>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Civic Impact</p>
          <p className={cn('text-sm font-bold uppercase tracking-wide', style.text)}>{impact.verdict}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border p-6', style.badge, 'bg-opacity-40 dark:bg-opacity-10')}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        {/* Gauge */}
        <RadialGauge score={impact.score} stroke={style.stroke} />

        {/* Verdict + explanation */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
            Predicted Civic Impact
          </p>
          <p className={cn('font-display text-xl font-bold mt-1 tracking-wide', style.text)}>
            {impact.verdictLabel}
          </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-2 leading-relaxed">{impact.explanation}</p>
        </div>
      </div>

      {/* Factor breakdown */}
      <div className="mt-6 space-y-2.5">
        {impact.factors.map((f) => (
          <div key={f.key} className="flex items-center gap-3 text-sm">
            <span className="w-40 flex-none text-neutral-600 dark:text-neutral-300">{f.label}</span>
            <div className="flex-1 h-2 rounded-full bg-neutral-100 dark:bg-dark-border overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  f.origin === 'unavailable' ? 'bg-neutral-300 dark:bg-neutral-600' : undefined,
                )}
                style={
                  f.origin === 'unavailable'
                    ? NO_UNSET_STYLE
                    : { width: `${f.pct}%`, backgroundColor: style.stroke }
                }
              />
            </div>
            <span className="w-16 text-right font-mono text-xs text-neutral-600 dark:text-neutral-400 tabular-nums">
              {f.origin === 'unavailable' ? 'n/a' : `${f.earned}/${f.max}`}
            </span>
          </div>
        ))}
      </div>

      {impact.unavailable.length > 0 && (
        <p className="mt-3 text-[11px] text-neutral-500 dark:text-neutral-400 italic">
          Not available: {impact.unavailable.join(', ')} — shown neutral, not invented.
        </p>
      )}
    </div>
  );
}
