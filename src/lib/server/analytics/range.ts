/**
 * Phase 19 — Analytics Engine: time-range normalization.
 *
 * Every metric module consumes the same RangeWindow so aggregates are always
 * computed over a consistent window regardless of which module produced them.
 * A single RANGE_DAYS map keeps the trailing-day counts canonical.
 */

import type { RangeWindow, TimeRange } from './types';

export const RANGE_DAYS: Record<TimeRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  all: 0,
};

export const RANGES: TimeRange[] = ['7d', '30d', '90d', 'all'];

export function parseTimeRange(raw: string | null): TimeRange {
  if (raw && raw in RANGE_DAYS) return raw as TimeRange;
  return '30d';
}

/** Build the canonical RangeWindow for a range, plus its previous-equivalent window. */
export function rangeWindow(range: TimeRange, now: Date = new Date()): RangeWindow {
  if (range === 'all') {
    return { range, from: null, to: null, days: 0 };
  }
  const days = RANGE_DAYS[range];
  const to = now;
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const startOfPeriod = new Date(to);
  startOfPeriod.setHours(0, 0, 0, 0);
  return { range, from, to, days };
}

export interface PreviousWindow {
  from: Date;
  to: Date;
}

/** Trailing window immediately before the current range window (for trend deltas). */
export function previousWindow(window: RangeWindow, now: Date = new Date()): PreviousWindow | null {
  if (!window.from) return null;
  const span = window.to!.getTime() - window.from.getTime();
  const to = new Date(window.from.getTime());
  const from = new Date(to.getTime() - span);
  void now;
  return { from, to };
}

/** A Prisma date predicate for a window (null bound means unbounded). */
export function dateWhere(window: RangeWindow): { gte?: Date; lte?: Date } {
  if (window.from && window.to) return { gte: window.from, lte: window.to };
  if (window.from) return { gte: window.from };
  if (window.to) return { lte: window.to };
  return {};
}
