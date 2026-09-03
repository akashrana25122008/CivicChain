'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { RiskLevel } from '@/lib/risk/scoring';

/**
 * RiskLadder — 2D risk visualization for the Risk Intelligence page.
 *
 * Replaces the heavier 3D surface with a clean, readable ranked bar chart that
 * preserves the exact same semantics:
 *   - Bar length = Risk Score (0–100)
 *   - Bar color  = Severity level (LOW → MEDIUM → HIGH → CRITICAL)
 *
 * Bars are ranked top-to-bottom by risk score so the hottest areas read first,
 * with a severity band scale running the full height for at-a-glance context.
 */

interface RiskArea {
  id: string;
  name: string;
  riskScore: number;   // 0–100
  riskLevel: RiskLevel;
  activeIncidents: number;
  slaBreaches?: number;
}

interface RiskLadderProps {
  areas: RiskArea[];
  className?: string;
  /** Limit shown rows (cuts the tail, keeps the top-N by score). */
  maxRows?: number;
}

const LEVEL_META: Record<RiskLevel, { label: string; color: string; soft: string; border: string }> = {
  CRITICAL: { label: 'Critical', color: '#dc2626', soft: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800/60' },
  HIGH: { label: 'High', color: '#f97316', soft: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800/60' },
  MEDIUM: { label: 'Medium', color: '#eab308', soft: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800/60' },
  LOW: { label: 'Low', color: '#22c55e', soft: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800/60' },
};

const LEVEL_ORDER: RiskLevel[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const BAND_STOPS: Array<{ min: number; color: string }> = [
  { min: 75, color: LEVEL_META.CRITICAL.color },
  { min: 50, color: LEVEL_META.HIGH.color },
  { min: 25, color: LEVEL_META.MEDIUM.color },
  { min: 0, color: LEVEL_META.LOW.color },
];

export function RiskLadder({ areas, className, maxRows = 12 }: RiskLadderProps) {
  const rows = useMemo(() => {
    return [...areas]
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, maxRows);
  }, [areas, maxRows]);

  if (rows.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className ?? ''}`}>
        <div className="text-center px-6">
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">No risk areas to visualize</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Risk intelligence activates as data accumulates.</p>
        </div>
      </div>
    );
  }

  const topScore = Math.max(100, ...rows.map((r) => r.riskScore));

  return (
    <div className={cn('flex flex-col h-full p-3 md:p-5 overflow-y-auto', className)}>
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Area Risk Ranking
        </span>
        <span className="text-[11px] text-neutral-400">
          {rows.length} of {areas.length} areas
        </span>
      </div>

      <div className="space-y-3 flex-1 min-h-0">
        {rows.map((row, i) => {
          const meta = LEVEL_META[row.riskLevel];
          const pct = Math.round((row.riskScore / topScore) * 100);
          const bandColor = (BAND_STOPS.find((b) => row.riskScore >= b.min) ?? BAND_STOPS[BAND_STOPS.length - 1]).color;
          return (
            <div
              key={row.id}
              className={cn('group relative rounded-lg border p-2.5 transition-colors', meta.border, meta.soft)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn(
                    'w-5 h-5 flex-shrink-0 rounded-md text-[10px] font-bold flex items-center justify-center',
                    row.riskLevel === 'CRITICAL' ? 'text-red-700 dark:text-red-300' :
                    row.riskLevel === 'HIGH' ? 'text-orange-700 dark:text-orange-300' :
                    row.riskLevel === 'MEDIUM' ? 'text-amber-700 dark:text-amber-300' :
                    'text-emerald-700 dark:text-emerald-300',
                  )}>
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
                    {row.name}
                  </span>
                  {row.activeIncidents > 0 && (
                    <span className="hidden sm:inline text-[11px] text-neutral-500 dark:text-neutral-400 flex-shrink-0">
                      {row.activeIncidents} active
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: meta.color }}>
                    {meta.label}
                  </span>
                  <span className="text-sm font-mono font-bold text-neutral-900 dark:text-white w-8 text-right">
                    {row.riskScore}
                  </span>
                </div>
              </div>

              <div className="relative mt-2 h-2 rounded-full bg-black/5 dark:bg-black/40 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: row.riskLevel === 'CRITICAL' ? bandColor : meta.color,
                  }}
                />
                {/* slider notch — visual accent at the SS line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white/70 dark:bg-white/30"
                  style={{ left: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Severity band scale */}
      <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-dark-border flex-shrink-0">
        <div className="flex items-center gap-0 h-2 rounded-full overflow-hidden">
          {LEVEL_ORDER.map((lv) => (
            <div
              key={lv}
              className="flex-1"
              style={{ backgroundColor: LEVEL_META[lv].color }}
              title={`${LEVEL_META[lv].label} risk`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-neutral-500 dark:text-neutral-400">
          <span>Low</span>
          <span>Medium</span>
          <span>High</span>
          <span>Critical</span>
        </div>
        <p className="mt-2 text-[11px] text-neutral-400 dark:text-neutral-500">
          Bar length = risk score · color = severity level · ranked highest first.
        </p>
      </div>
    </div>
  );
}
