'use client';

import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion, animate } from 'framer-motion';
import { Cpu, Radar } from 'lucide-react';

/**
 * City Risk Intelligence visualization.
 *
 * Persistent by design: when the "scan" animation completes, the final risk
 * state REMAINS on screen with a subtle continuous scanning ring. It never
 * blinks out to white or disappears — the result is always visible.
 *
 * Labels are deliberately NOT "AI" — the risk score is a deterministic,
 * weighted computation over real issue data (see src/lib/risk/scoring.ts),
 * not a machine-learning inference. Stay honest about that.
 */

const STAGES = [
  'LOADING CIVIC DATA',
  'SCANNING ISSUE FEED',
  'ANALYZING RISK FACTORS',
  'CALCULATING WEIGHTED SCORE',
  'RESULT READY',
] as const;

interface RiskEngineProps {
  score?: number | null;
  level?: string | null;
  ward?: string | null;
  trend?: string | null;
  confidence?: number | null;
  predictedIncidents?: number | null;
  live?: boolean;
}

const LEVEL_COLOR: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#22c55e',
  MODERATE: '#7692ff',
  NONE: '#22c55e',
};

export function RiskEngine({
  score = null,
  level = null,
  ward = null,
  trend = null,
  confidence = null,
  predictedIncidents = null,
  live = true,
}: RiskEngineProps) {
  const reduce = useReducedMotion();
  const hasData = score != null;
  const scoreValue = score ?? 0;
  const [stage, setStage] = useState<number>(-1);
  const [scanning, setScanning] = useState(false);
  const shownScore = useMotionValue(0);
  const springScore = useSpring(shownScore, { stiffness: 60, damping: 20 });
  const [displayScore, setDisplayScore] = useState(0);

  // Keep the spring's number synced into state for the <text> label.
  useEffect(() => springScore.on('change', (v) => setDisplayScore(Math.round(v))), [springScore]);

  // A continuous subtle rotation for the scanning ring — persisted forever.
  const [ringRotation, setRingRotation] = useState(0);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = t - last;
      last = t;
      setRingRotation((r) => (r + dt * 0.02) % 360);
      raf = requestAnimationFrame(tick);
    };
    if (reduce) return;
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  const runScan = () => {
    if (scanning) return;
    setScanning(true);
    setStage(-1);
    shownScore.set(0);
    STAGES.forEach((_, i) => {
      window.setTimeout(() => setStage(i), i * 650);
    });
    window.setTimeout(() => {
      animate(shownScore, scoreValue, { duration: reduce ? 0 : 1.2, ease: 'easeOut' });
    }, STAGES.length * 650);
    window.setTimeout(() => setScanning(false), STAGES.length * 650 + 1400);
  };

  // Run one scan on mount so the visualization is alive immediately.
  // Deferred out of the synchronous effect body (React 19 lint) so the scan's
  // state updates happen in a normal tick, not during the render commit.
  useEffect(() => {
    const t = window.setTimeout(() => runScan(), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const color = LEVEL_COLOR[level ?? ''] ?? '#7692ff';
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, scoreValue)) / 100;

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card shadow-sm p-6 relative overflow-hidden">
      {/* subtle upward-tinted glow (accent, not full background) */}
      <div className="pointer-events-none absolute -right-16 -top-16 w-64 h-64 rounded-full bg-brand-500/10 blur-3xl" aria-hidden="true" />

      <div className="relative">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">City Risk Intelligence</p>
            <h3 className="font-display text-lg font-bold text-neutral-900 dark:text-white mt-0.5">Live Risk Overview</h3>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
            <span className={scanning ? 'animate-pulse text-brand-600 dark:text-brand-300' : 'text-emerald-500'}>●</span>
            {scanning ? 'Scanning' : live ? 'Live' : 'Review'}
          </span>
        </div>

        {/* Radial gauge */}
        <div className="my-6 flex items-center justify-center">
          <div className="relative h-[11rem] w-[11rem]">
            {/* track */}
            <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(59,83,236,0.12)" strokeWidth="12" />
              {/* progress */}
              <motion.circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke="url(#riskGrad)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: circumference * (1 - progress) }}
                transition={{ duration: reduce ? 0 : 1.4, ease: 'easeOut', delay: STAGES.length * 0.65 }}
              />
              <defs>
                <linearGradient id="riskGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#1b2cc1" />
                  <stop offset="100%" stopColor="#7692ff" />
                </linearGradient>
              </defs>
            </svg>

            {/* rotating scanning ring (subtle, permanent) */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ transform: `rotate(${ringRotation}deg)` }}
              aria-hidden="true"
            >
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[9.2rem] h-[9.2rem]">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background:
                      'conic-gradient(from 0deg, transparent 0deg, rgba(118,146,255,0.25) 70deg, transparent 120deg)',
                    WebkitMask: 'radial-gradient(farthest-side, transparent 78%, black 80%)',
                    mask: 'radial-gradient(farthest-side, transparent 78%, black 80%)',
                  }}
                />
              </div>
            </div>

            {/* centre readout */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <p className="text-5xl font-display font-bold text-neutral-900 dark:text-white" style={{ color }}>
                {hasData ? displayScore : '—'}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-widest mt-1" style={{ color }}>
                {level ?? 'No data'}
              </p>
              <p className="text-[10px] text-neutral-400 mt-1 font-mono">/ 100</p>
            </div>
          </div>
        </div>

        {/* stage / persistent status */}
        <div className="min-h-[2.25rem] mb-4 flex items-center justify-center">
          {stage >= 0 && (
            <motion.p
              key={stage}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-mono text-[11px] tracking-wider text-brand-600 dark:text-brand-400"
            >
              {scanning || stage < STAGES.length - 1 ? `▸ ${STAGES[stage]}` : `✓ ${STAGES[stage]}`}
            </motion.p>
          )}
        </div>

        {/* persistent metrics grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border p-3">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Risk Load</p>
            <p className="font-mono text-sm font-semibold text-neutral-900 dark:text-white mt-1">
              {confidence != null ? `${Math.round(confidence * 100)}%` : '—'}
            </p>
          </div>
          <div className="rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border p-3">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Active Issues</p>
            <p className="font-mono text-sm font-semibold text-neutral-900 dark:text-white mt-1">
              {predictedIncidents != null ? `${predictedIncidents}` : '—'}
            </p>
          </div>
          <div className="rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border p-3">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Trend</p>
            <p className="font-mono text-sm font-semibold text-brand-600 dark:text-brand-400 mt-1 truncate">
              {trend ?? '—'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-[11px] text-neutral-400 dark:text-neutral-500">
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" /> WEIGHTED RISK MODEL
          </span>
          <span className="truncate">{ward ?? 'No ward data yet'}</span>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={runScan}
            disabled={scanning}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 transition-colors disabled:opacity-60"
          >
            <Radar className="w-4 h-4" aria-hidden="true" />
            {scanning ? 'Scanning…' : 'Re-run Risk Scan'}
          </button>
        </div>
      </div>
    </div>
  );
}
