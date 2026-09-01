'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, useInView } from 'framer-motion';
import useSWR from 'swr';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import {
  TrendingUp, Droplets, Trash2, Construction, CloudRain,
  ClipboardList, ShieldAlert, Radio, RotateCw, Zap, Wrench,
} from 'lucide-react';
import { DUR, EASE } from '@/lib/motion';

interface PublicRiskZone {
  wardId: string;
  wardName: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  activeIncidents: number;
  totalIncidents: number;
  topCategory: string;
  averageResolutionTime: number | null;
  trend: { direction: string; percentage: number };
}

interface PublicRisksResponse {
  risks: PublicRiskZone[];
  generatedAt: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const LEVEL_COLOR: Record<string, string> = {
  CRITICAL: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800',
  HIGH: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800',
  MEDIUM: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800',
  LOW: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800',
};

const CATEGORY_META: Record<string, { icon: typeof Droplets; iconColor: string; type: string }> = {
  WATER: { icon: Droplets, iconColor: 'text-blue-500', type: 'Water Risk' },
  DRAINAGE: { icon: CloudRain, iconColor: 'text-cyan-500', type: 'Drainage Risk' },
  POTHOLE: { icon: Wrench, iconColor: 'text-amber-500', type: 'Pothole Risk' },
  INFRASTRUCTURE: { icon: Construction, iconColor: 'text-amber-500', type: 'Infrastructure Risk' },
  GARBAGE: { icon: Trash2, iconColor: 'text-emerald-500', type: 'Sanitation Risk' },
  STREETLIGHT: { icon: Zap, iconColor: 'text-yellow-500', type: 'Lighting Risk' },
  OTHER: { icon: TrendingUp, iconColor: 'text-violet-500', type: 'Civic Risk' },
};

const DEFAULT_CATEGORY = { icon: TrendingUp, iconColor: 'text-violet-500', type: 'Civic Risk' };

function metaForCategory(category: string) {
  return CATEGORY_META[category] ?? DEFAULT_CATEGORY;
}

const NEXT_SCAN = 15;

function useScanCountdown(inView: boolean, reduce: boolean) {
  const [count, setCount] = useState(NEXT_SCAN);
  useEffect(() => {
    if (!inView || reduce) return;
    const id = setInterval(() => setCount((s) => (s <= 1 ? NEXT_SCAN : s - 1)), 1000);
    return () => clearInterval(id);
  }, [inView, reduce]);
  return count;
}

/**
 * SCANNING → ANALYZING → ANALYSIS COMPLETE lifecycle.
 *
 * The visualization is never cleared: completion is a persistent terminal
 * stage (3). Reduced-motion users resolve straight to the completed state via
 * the lazy initializer instead of a blank preview. `runKey` allows the
 * lifecycle to be re-run on demand (RESCAN).
 */
function useRiskLifecycle(inView: boolean, reduce: boolean, runKey: number) {
  const [stage, setStage] = useState(() => (reduce ? 3 : 0));
  useEffect(() => {
    if (reduce) return;
    if (!inView) return;
    // All transitions run in timeouts (callbacks) so the effect never calls
    // setState synchronously.
    const t1 = setTimeout(() => setStage(1), 20);
    const t2 = setTimeout(() => setStage(2), 2600);
    const t3 = setTimeout(() => setStage(3), 3500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [inView, reduce, runKey]);
  return stage;
}

/** Persistent geospatial data layer for the model preview (invariant across stages). */
const NODES = [
  { x: 14, y: 30, c: 'bg-sky-400', d: 0 },
  { x: 22, y: 62, c: 'bg-cyan-400', d: 0.5 },
  { x: 30, y: 22, c: 'bg-violet-400', d: 1.0 },
  { x: 38, y: 55, c: 'bg-amber-400', d: 1.5 },
  { x: 47, y: 36, c: 'bg-sky-400', d: 2.0 },
  { x: 56, y: 70, c: 'bg-cyan-400', d: 2.5 },
  { x: 64, y: 40, c: 'bg-violet-400', d: 3.0 },
  { x: 72, y: 60, c: 'bg-amber-400', d: 3.5 },
  { x: 81, y: 26, c: 'bg-sky-400', d: 4.0 },
  { x: 89, y: 52, c: 'bg-violet-400', d: 4.5 },
];

/** Residual heat zones rendered only after analysis completes. */
const HEAT_BLOBS = [
  { x: '34%', y: '48%', size: 150, color: 'rgba(239,68,68,0.55)' },
  { x: '68%', y: '56%', size: 120, color: 'rgba(245,158,11,0.45)' },
  { x: '52%', y: '28%', size: 130, color: 'rgba(59,130,246,0.25)' },
  { x: '20%', y: '70%', size: 110, color: 'rgba(139,92,246,0.3)' },
];

/** AI-detected hotspots revealed once the analysis completes. */
const HOTSPOTS = [
  { x: '38%', y: '55%', label: 'WL-17', dot: 'bg-red-400 ring-red-400/40', ring: 'border-red-400/70', chip: 'bg-red-500/90 text-white' },
  { x: '71%', y: '60%', label: 'DRAIN-04', dot: 'bg-amber-400 ring-amber-400/40', ring: 'border-amber-400/70', chip: 'bg-amber-500/90 text-black' },
];

const WARD_PATH = 'M 12 22 L 40 12 L 74 18 L 90 46 L 82 74 L 50 88 L 22 78 L 8 52 Z';

const STAGE_LABEL: Record<number, string> = {
  0: 'MODEL READY',
  1: 'SCANNING WARD 17…',
  2: 'ANALYZING SIGNALS…',
  3: 'ANALYSIS COMPLETE',
};

const STAGE_PILL: Record<number, string> = {
  0: 'bg-white/10 border-white/15 text-white/70',
  1: 'bg-violet-500/90 border-violet-400 text-violet-50',
  2: 'bg-amber-500/90 border-amber-300 text-black',
  3: 'bg-emerald-500/90 border-emerald-400 text-white',
};

/**
 * RiskGauge — animated semi-circular risk score dial.
 */
function RiskGauge({ score, delay = 0.5 }: { score: number; delay?: number }) {
  const C = Math.PI * 70;

  return (
    <div className="rounded-xl bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono tracking-wider text-neutral-500 dark:text-white/50">RISK SCORE</span>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-red-500 dark:text-red-400">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          HIGH
        </span>
      </div>
      <div className="relative">
        <svg viewBox="0 0 180 100" className="w-full h-auto" aria-hidden="true">
          <defs>
            <linearGradient id="risk-gauge-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="70%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
          <path
            d="M 20 95 A 70 70 0 0 1 160 95"
            className="stroke-neutral-200 dark:stroke-white/10"
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
          />
          <motion.path
            d="M 20 95 A 70 70 0 0 1 160 95"
            stroke="url(#risk-gauge-grad)"
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: C - (C * score) / 100 }}
            transition={{ duration: 1.2, delay, ease: EASE.out }}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0.5 text-center pointer-events-none">
          <AnimatedNumber
            value={score}
            delay={delay}
            format={(n) => `${n}%`}
            className="font-display text-2xl font-bold text-neutral-900 dark:text-white"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * RiskZoneDemo — SCANNING → ANALYZING → ANALYSIS COMPLETE lifecycle.
 *
 * The visualization is never cleared: the same dark technical map keeps its
 * grid, ward boundary and data nodes throughout. Scanning adds motion and
 * processing indicators; completion swaps the sweeping motion for persistent
 * analytical overlays (heat zones, AI-detected hotspots) plus restrained
 * ambient movement. Reduced-motion users resolve straight to the completed
 * state instead of a blank preview. A RESCAN control re-runs the lifecycle.
 */
function RiskZoneDemo() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef, { once: true, amount: 0.3 });
  const reduce = useReducedMotion();
  const [runKey, setRunKey] = useState(0);
  const scan = useScanCountdown(inView, !!reduce);
  const stage = useRiskLifecycle(inView, !!reduce, runKey);

  const rescan = () => setRunKey((k) => k + 1);

  const flowRows = [
    { icon: ClipboardList, label: 'Historical complaints', value: '84', caption: 'Ward 17 · last 6 months', active: stage >= 0 },
    { icon: CloudRain, label: 'Rainfall signal', value: 'High', caption: 'Monsoon onset detected', active: stage >= 1 },
    { icon: ShieldAlert, label: 'Predicted risk', value: 'HIGH', caption: '6–12h window', active: stage >= 2 },
  ];

  return (
    <div ref={wrapRef} className="max-w-4xl mx-auto mb-12">
      <div className="rounded-2xl overflow-hidden border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg shadow-2xl shadow-violet-500/5">
        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-neutral-200 dark:border-dark-border bg-neutral-50/80 dark:bg-dark-bg-card">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-xs font-mono tracking-wider text-neutral-600 dark:text-white/60">
              <Radio className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400" />
              PREDICTIVE RISK MODEL
            </span>
            <span className="px-2 py-0.5 rounded-md bg-violet-50 dark:bg-violet-900/25 border border-violet-200 dark:border-violet-800 text-[10px] font-bold font-mono text-violet-700 dark:text-violet-300">
              WARD 17
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-white dark:bg-dark-bg border border-neutral-200 dark:border-dark-border text-[10px] font-mono text-neutral-500 dark:text-white/50">
              model v2.1
            </span>
            <button
              type="button"
              onClick={rescan}
              title="Re-run analysis"
              className="flex items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg px-2 py-1 text-[10px] font-mono text-neutral-500 dark:text-white/50 transition-colors hover:border-violet-300 dark:hover:border-violet-700 hover:text-violet-600 dark:hover:text-violet-300"
            >
              <motion.span
                className="inline-flex"
                animate={stage >= 1 && stage < 3 && !reduce ? { rotate: 360 } : { rotate: 0 }}
                transition={{
                  duration: 1.1,
                  repeat: stage >= 1 && stage < 3 && !reduce ? Infinity : 0,
                  ease: 'linear',
                }}
              >
                <RotateCw className="w-3 h-3" />
              </motion.span>
              RESCAN
            </button>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/25 border border-emerald-200 dark:border-emerald-800 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE MODEL
            </span>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6 p-5 md:p-6">
          {/* animated risk zone — always keeps its dark technical visualization */}
          <div className="space-y-4">
            <div className="relative h-44 md:h-52 rounded-xl overflow-hidden border border-neutral-200 dark:border-white/10 bg-gradient-to-br from-[#0a1122] via-[#0c1428] to-[#101c38]">
              {/* technical vignette */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 50% 42%, rgba(56,116,255,0.12), transparent 68%)' }}
              />

              {/* ward boundary (persistent geographic layer) */}
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full opacity-70" aria-hidden="true">
                <path d={WARD_PATH} fill="rgba(56,116,255,0.05)" stroke="rgba(139,92,246,0.45)" strokeWidth="0.6" strokeDasharray="2.5 2" />
              </svg>

              {/* data grid */}
              <div className="absolute inset-0 grid grid-cols-8 grid-rows-3 gap-2 p-3">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded-sm border border-white/[0.03]',
                      stage === 3 && i % 5 === 0
                        ? 'bg-red-500/15'
                        : stage >= 1 && i % 4 === 0
                          ? 'bg-violet-500/10'
                          : 'bg-white/[0.04]'
                    )}
                  />
                ))}
              </div>

              {/* persistent geospatial data nodes */}
              {NODES.map((n) => {
                const resolved = stage >= 2;
                return (
                  <motion.span
                    key={`${n.x}-${n.y}`}
                    className={cn('absolute h-1.5 w-1.5 rounded-full shadow-sm', n.c)}
                    style={{ left: `calc(${n.x}% - 3px)`, top: `calc(${n.y}% - 3px)` }}
                    initial={resolved ? { opacity: 0, scale: 0.4 } : { opacity: 0.18, scale: 0.7 }}
                    animate={resolved && !reduce ? { opacity: [0.25, 1, 0.55], scale: [0.7, 1.2, 0.9] } : { opacity: resolved ? 0.65 : 0.18, scale: 0.7 }}
                    transition={resolved && !reduce ? { duration: 3 + (n.d % 3), times: [0, 0.25, 1], repeat: Infinity, delay: n.d, ease: 'easeInOut' } : {}}
                  />
                );
              })}

              {/* radar sweep — active while scanning/analyzing */}
              {!reduce && (stage === 1 || stage === 2) && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <motion.div
                    className="w-[220%] aspect-square rounded-full opacity-40"
                    style={{ background: 'conic-gradient(from 0deg, rgba(139,92,246,0.5), transparent 70deg)' }}
                    initial={{ rotate: 0 }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
                  />
                </div>
              )}

              {/* scanning sweep bar — loops, then completes a final pass while analyzing */}
              <AnimatePresence>
                {!reduce && stage === 1 && (
                  <motion.div
                    className="absolute left-0 right-0 h-8 bg-violet-500/20 border-y border-violet-400/30"
                    animate={{ top: ['0%', '80%'] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
                    exit={{ opacity: 0 }}
                  />
                )}
                {!reduce && stage === 2 && (
                  <motion.div
                    className="absolute left-0 right-0 h-8 bg-violet-500/25 border-y border-violet-400/40"
                    initial={{ top: '0%', opacity: 0.9 }}
                    animate={{ top: '80%', opacity: 0 }}
                    transition={{ duration: 1.3, ease: 'easeInOut' }}
                  />
                )}
              </AnimatePresence>

              {/* residual heat overlay */}
              <motion.div
                className="absolute inset-x-0 top-0 bottom-0 bg-gradient-to-b from-transparent via-red-500/5 to-red-500/20"
                initial={{ opacity: 0 }}
                animate={{ opacity: stage >= 3 ? (reduce ? 0.6 : 0.8) : stage >= 1 ? 0.25 : 0 }}
                transition={{ duration: 0.7 }}
              />

              {/* heat blobs — slow ambient movement after completion */}
              {HEAT_BLOBS.map((b) => (
                <motion.div
                  key={b.x}
                  className="absolute rounded-full blur-2xl pointer-events-none"
                  style={{ left: b.x, top: b.y, width: b.size, height: b.size, background: b.color, transform: 'translate(-50%, -50%)' }}
                  initial={{ opacity: 0 }}
                  animate={stage >= 3 && !reduce ? { opacity: [0.22, 0.46, 0.28] } : { opacity: stage >= 3 ? 0.35 : 0 }}
                  transition={stage >= 3 && !reduce ? { duration: 4 + (b.size % 90) / 10, repeat: Infinity, ease: 'easeInOut' } : {}}
                />
              ))}

              {/* AI-detected hotspots — persistent after completion */}
              <AnimatePresence>
                {stage >= 3 &&
                  HOTSPOTS.map((h) => (
                    <motion.div
                      key={h.label}
                      className="absolute z-10"
                      style={{ left: `calc(${h.x} - 5px)`, top: `calc(${h.y} - 5px)` }}
                      initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: DUR.standard, ease: EASE.out }}
                    >
                      <span className={cn('relative block h-2.5 w-2.5 rounded-full ring-2 shadow-lg', h.dot)}>
                        {!reduce && (
                          <motion.span
                            className={cn('absolute -inset-1 rounded-full border', h.ring)}
                            animate={{ scale: [1, 2.6], opacity: [0.9, 0] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
                          />
                        )}
                      </span>
                      <span className={cn('absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[8px] font-mono font-bold', h.chip)}>
                        {h.label}
                      </span>
                    </motion.div>
                  ))}
              </AnimatePresence>

              {/* stage status pill */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`st-${stage}`}
                  className={cn(
                    'absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-mono text-[10px] font-bold shadow-lg backdrop-blur-sm',
                    STAGE_PILL[stage]
                  )}
                  initial={reduce ? { opacity: 1 } : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={{ duration: DUR.fast }}
                >
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full animate-pulse',
                      stage === 3 ? 'bg-emerald-300' : stage === 2 ? 'bg-amber-300' : 'bg-white/80'
                    )}
                  />
                  {STAGE_LABEL[stage]}
                </motion.div>
              </AnimatePresence>

              {/* risk marker — only after analysis completes */}
              <AnimatePresence>
                {stage >= 3 && (
                  <motion.div
                    initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.8, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: DUR.standard, ease: EASE.out }}
                    className="absolute top-3 right-3 flex flex-col items-end gap-1"
                  >
                    <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/90 text-white text-xs font-bold font-mono shadow-lg">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                      </span>
                      RISK: HIGH
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-sm text-[9px] font-mono text-white/80">
                      Confidence 86%
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* processing activity — visible only while scanning/analyzing */}
              <AnimatePresence mode="wait">
                {stage === 1 && (
                  <motion.div
                    key="scan-hud"
                    className="absolute bottom-3 left-3 flex items-center gap-2 rounded-md px-2 py-1 backdrop-blur-sm bg-black/40 text-[9px] font-mono text-white/70"
                    initial={reduce ? { opacity: 1 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <span className="flex h-2 items-end gap-0.5">
                      {[0, 1, 2].map((b) => (
                        <motion.span
                          key={b}
                          className="w-0.5 rounded-full bg-violet-400"
                          animate={!reduce ? { height: [4, 10, 4] } : { height: 4 }}
                          transition={{ duration: 0.8, repeat: !reduce ? Infinity : 0, delay: b * 0.15, ease: 'easeInOut' }}
                        />
                      ))}
                    </span>
                    SCANNING 24 ZONES · 1,204 SIGNALS
                  </motion.div>
                )}
                {stage === 2 && (
                  <motion.div
                    key="resolve-hud"
                    className="absolute bottom-3 left-3 rounded-md px-2 py-1 backdrop-blur-sm bg-black/40 text-[9px] font-mono text-amber-300/90"
                    initial={reduce ? { opacity: 1 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    RESOLVING DATA NODES…
                  </motion.div>
                )}
              </AnimatePresence>

              {/* verdict panel — persistent after completion */}
              <AnimatePresence>
                {stage >= 3 && (
                  <motion.div
                    initial={reduce ? { opacity: 1 } : { opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
                    transition={{ duration: DUR.standard, ease: EASE.out }}
                    className="absolute inset-x-0 bottom-0 p-3 pt-10 bg-gradient-to-t from-black/85 via-black/50 to-transparent"
                  >
                    <div className="flex flex-wrap items-end gap-x-5 gap-y-2.5">
                      {[
                        { label: 'HISTORICAL', value: 84, color: 'bg-sky-400' },
                        { label: 'RAINFALL', value: 78, color: 'bg-cyan-400' },
                        { label: 'GEOSPATIAL', value: 63, color: 'bg-violet-400' },
                      ].map((driver, d) => (
                        <div key={driver.label} className="min-w-[96px] flex-1 max-w-[130px]">
                          <div className="flex items-center justify-between text-[9px] font-mono text-white/70 mb-1">
                            <span>{driver.label}</span>
                            <span className="text-white/90">{driver.value}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                            <motion.div
                              className={cn('h-full rounded-full', driver.color)}
                              initial={{ width: reduce ? `${driver.value}%` : '0%' }}
                              animate={{ width: `${driver.value}%` }}
                              transition={{ duration: 0.9, delay: 0.25 + d * 0.12, ease: EASE.out }}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="ml-auto flex flex-col items-end gap-1">
                        <span className="px-2 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[9px] font-mono font-bold">
                          PRE-POSITION CREW
                        </span>
                        <span className="text-[9px] font-mono text-white/60">Next rainfall window: 6–12 hrs</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* metrics strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                <p className="text-[10px] font-mono text-neutral-500 dark:text-white/40 mb-1">ML CONFIDENCE</p>
                <p className="text-sm font-display font-bold text-neutral-900 dark:text-white">
                  <AnimatedNumber value={86} delay={0.7} format={(n) => `${n}%`} />
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                <p className="text-[10px] font-mono text-neutral-500 dark:text-white/40 mb-1">PREDICTION WINDOW</p>
                <p className="text-sm font-display font-bold text-neutral-900 dark:text-white">6–12 hrs</p>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                <p className="text-[10px] font-mono text-neutral-500 dark:text-white/40 mb-1">SIGNALS IN FEED</p>
                <p className="text-sm font-display font-bold text-neutral-900 dark:text-white">1,204</p>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                <p className="text-[10px] font-mono text-neutral-500 dark:text-white/40 mb-1">NEXT SCAN</p>
                <p className="text-sm font-display font-bold text-violet-600 dark:text-violet-400 tabular-nums">
                  {inView && !reduce ? `${scan}s` : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* data → analysis → risk flow + gauge */}
          <div className="space-y-4">
            <div className="space-y-2.5">
              {flowRows.map((row, i) => {
                const Icon = row.icon;
                return (
                  <motion.div
                    key={row.label}
                    initial={reduce ? { opacity: 1 } : { opacity: 0, x: 14 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: DUR.standard, delay: i * 0.18, ease: EASE.out }}
                    className={cn(
                      'px-3 py-2.5 rounded-xl border flex items-center gap-3 transition-colors duration-300',
                      row.active
                        ? i === 2
                          ? 'border-red-500/40 bg-red-500/10'
                          : 'border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5'
                        : 'border-neutral-200 dark:border-dark-border bg-white/[0.02] opacity-50'
                    )}
                  >
                    <span
                      className={cn(
                        'w-8 h-8 shrink-0 rounded-lg flex items-center justify-center',
                        i === 2 && row.active
                          ? 'bg-red-500/15 text-red-500'
                          : 'bg-white dark:bg-dark-bg text-violet-500 dark:text-violet-400'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm font-medium truncate', row.active ? 'text-neutral-900 dark:text-white/90' : 'text-neutral-400 dark:text-white/30')}>
                        {row.label}
                      </span>
                      <span className="block text-[10px] font-mono text-neutral-400 dark:text-white/40 truncate">{row.caption}</span>
                    </span>
                    <span
                      className={cn(
                        'font-mono font-bold text-sm',
                        row.active ? (i === 2 ? 'text-red-500' : 'text-neutral-900 dark:text-white') : 'text-neutral-400 dark:text-white/30'
                      )}
                    >
                      {row.value}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            <RiskGauge score={84} delay={0.8} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PredictiveIntelligenceSection() {
  const reduce = useReducedMotion();

  const { data, error } = useSWR<PublicRisksResponse>('/api/public/risks', fetcher, {
    refreshInterval: 300000,
  });

  const risks = data?.risks ?? [];

  return (
    <section className="py-20 md:py-32 theme-tint dark:bg-dark-bg" id="predictive">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          className="max-w-3xl mx-auto text-center mb-16"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: DUR.section, ease: EASE.out }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-violet-500" />
            Predictive Intelligence
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-neutral-900 dark:text-white mb-6 text-balance">
            Move From Reactive Complaints to Preventive Action.
          </h2>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 text-pretty">
            CivicChain combines historical civic reports with geospatial and environmental signals to identify areas that may require preventive attention.
          </p>
        </motion.div>

        <RiskZoneDemo />

        {error && (
          <p className="mb-8 text-center text-sm text-amber-600 dark:text-amber-400">
            Live risk zones are temporarily unavailable. Check back shortly.
          </p>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {risks.length === 0 && !error ? (
            <div className="col-span-full p-10 text-center rounded-2xl border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                No risk zones detected yet. As citizens submit reports across the city, high-risk areas will appear here.
              </p>
            </div>
          ) : (
            risks.map((risk, i) => {
              const meta = metaForCategory(risk.topCategory);
              const Icon = meta.icon;
              const dir = risk.trend.direction === 'UP' ? '+' : risk.trend.direction === 'DOWN' ? '−' : '→';
              return (
                <motion.div
                  key={risk.wardId}
                  initial={reduce ? false : { opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: DUR.section, delay: i * 0.06, ease: EASE.out }}
                >
                  <Card
                    variant="elevated"
                    className="p-6 bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border hover:-translate-y-1 hover:shadow-xl transition-all duration-300 hover:border-violet-300 dark:hover:border-violet-700"
                  >
                    <CardContent>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-mono text-neutral-500 tracking-wider">{risk.wardName}</span>
                        <span className={cn('px-2 py-1 rounded text-xs font-bold font-mono border', LEVEL_COLOR[risk.riskLevel] ?? LEVEL_COLOR.MEDIUM)}>
                          {risk.riskLevel}
                        </span>
                      </div>

                      <motion.div
                        className="flex items-center gap-3 mb-4"
                        whileHover={reduce ? undefined : { scale: 1.03 }}
                        transition={{ duration: DUR.fast, ease: EASE.out }}
                      >
                        <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-dark-border flex items-center justify-center">
                          <Icon className={cn('w-5 h-5', meta.iconColor)} />
                        </div>
                        <h3 className="font-display text-lg font-semibold text-neutral-900 dark:text-white">{meta.type}</h3>
                      </motion.div>

                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-500">Risk Score</span>
                          <AnimatedNumber value={risk.riskScore} delay={0.4} className="font-mono font-medium text-neutral-900 dark:text-white" />
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-500">Active Reports</span>
                          <span className="font-mono font-medium text-neutral-900 dark:text-white">{risk.activeIncidents}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-500">30-Day Trend</span>
                          <span className={cn('font-mono font-medium', risk.trend.percentage >= 0 ? 'text-red-500' : 'text-emerald-500')}>
                            {dir}{Math.abs(risk.trend.percentage)}%
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>

        <div className="mt-12 max-w-3xl mx-auto p-6 rounded-2xl bg-neutral-50 dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
          <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed text-center">
            <strong>Important:</strong> Risk zones shown above are computed from live CivicChain data — reported issues, severity, SLA breaches, and repeat incidents per ward. They are decision-support signals, not guarantees of future events.
          </p>
        </div>
      </div>
    </section>
  );
}