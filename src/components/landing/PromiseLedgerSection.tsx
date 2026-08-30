'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useInView } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Clock,
  MapPin,
  User,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Circle,
} from 'lucide-react';
import { DUR, EASE } from '@/lib/motion';

const TIMELINE = [
  { date: '24 Aug', label: 'Issue reported', status: 'completed', icon: Circle },
  { date: '25 Aug', label: 'Issue verified', status: 'completed', icon: CheckCircle2 },
  { date: '25 Aug', label: 'Department assigned', status: 'completed', icon: CheckCircle2 },
  { date: '26 Aug', label: 'Promise recorded', status: 'completed', icon: CheckCircle2 },
  { date: '27 Aug', label: 'Work started', status: 'completed', icon: CheckCircle2 },
  { date: '28 Aug', label: 'Resolution submitted', status: 'current', icon: AlertTriangle },
  { date: '28 Aug', label: 'Verification pending', status: 'pending', icon: Circle },
];

/**
 * CountdownDemo — simulated remaining-time countdown (§15). Clearly labelled
 * as prototype. Counts down from a starting budget and transitions status
 * ON TRACK → AT RISK → BROKEN at set thresholds. Stops when story is told.
 */
function CountdownDemo() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();

  // remaining budget in seconds for a demo (18h 42m)
  const [budget, setBudget] = useState(18 * 3600 + 42 * 60);

  // derive status
  const status =
    budget <= 4 * 3600 ? 'BROKEN PROMISE' : budget <= 10 * 3600 ? 'AT RISK' : 'ON TRACK';

  // Tick only while in view and not reduced-motion; stop once the story is told.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return undefined;
    if (!inView || reduce) return undefined;
    startedRef.current = true;
    const id = setInterval(() => {
      setBudget((b) => (b <= 1 ? 0 : b - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [inView, reduce]);

  const h = Math.floor(budget / 3600);
  const m = Math.floor((budget % 3600) / 60);
  const s = Math.floor(budget % 60);

  const statusStyle =
    status === 'ON TRACK'
      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
      : status === 'AT RISK'
      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';

  return (
    <div ref={wrapRef} className="mt-6 p-4 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-neutral-500 font-mono tracking-wider">DEADLINE COUNTDOWN</span>
        <span className="text-[10px] font-mono text-violet-500 dark:text-violet-400">DEMO</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-xl font-bold text-neutral-900 dark:text-white tabular-nums">
          {String(h).padStart(2, '0')}h {String(m).padStart(2, '0')}m {String(s).padStart(2, '0')}s
        </div>
        <motion.span
          key={status}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: DUR.fast, ease: EASE.out }}
          className={cn('px-3 py-1 rounded-full text-xs font-bold font-mono', statusStyle)}
        >
          {status}
        </motion.span>
      </div>
      <p className="text-[10px] text-neutral-400 mt-2 font-mono">
        Simulated countdown — prototype, not connected to a live backend.
      </p>
    </div>
  );
}

/** A tiny interval ticker that only runs while in view and not reduced-motion. */

export function PromiseLedgerSection() {
  const reduce = useReducedMotion();

  return (
    <section className="py-20 md:py-32 theme-light dark:bg-dark-bg-card" id="promise-ledger">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          className="max-w-3xl mx-auto text-center mb-16"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: DUR.section, ease: EASE.out }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Promise Ledger
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-neutral-900 dark:text-white mb-6 text-balance">
            Every Promise Leaves a Trace
          </h2>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 text-pretty">
            When an authority commits to resolving an issue, CivicChain records the commitment as a structured, time-stamped accountability record.
          </p>
        </motion.div>

        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
          {/* Promise detail card */}
          <motion.div
            className="p-8 rounded-2xl bg-white dark:bg-dark-bg border border-neutral-200 dark:border-dark-border shadow-lg dark:shadow-dark-lg"
            initial={reduce ? false : { opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: DUR.section, ease: EASE.out }}
          >
            <div className="flex items-center gap-2 mb-6">
              <span className="text-xs font-mono text-neutral-500 tracking-wider">PROMISE</span>
              <span className="text-xs font-mono text-brand-600 dark:text-brand-400 font-bold">#CC-00421</span>
            </div>

            <h3 className="font-display text-2xl font-bold text-neutral-900 dark:text-white mb-6">
              Road Repair
            </h3>

            <div className="space-y-4 mb-8">
              {[
                { icon: User, color: 'text-brand-600 dark:text-brand-400', bg: 'bg-brand-50 dark:bg-brand-900/30', label: 'Authority', value: 'Municipal Roads Department' },
                { icon: Calendar, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30', label: 'Committed Deadline', value: '28 August 2026' },
                { icon: Clock, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/30', label: 'Created', value: '24 August 2026' },
                { icon: MapPin, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30', label: 'Location', value: 'Sector 12, Navapur' },
              ].map((row, i) => {
                const Icon = row.icon;
                return (
                  <motion.div
                    key={row.label}
                    className="flex items-start gap-4"
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: DUR.standard, delay: i * 0.06, ease: EASE.out }}
                  >
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', row.bg)}>
                      <Icon className={cn('w-5 h-5', row.color)} />
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 mb-1">{row.label}</p>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">{row.value}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Current Status</span>
                <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-800/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold font-mono">
                  ON TRACK
                </span>
              </div>
            </div>

            <CountdownDemo />
          </motion.div>

          {/* Activity timeline — progresses as it enters */}
          <motion.div
            className="p-8 rounded-2xl bg-white dark:bg-dark-bg border border-neutral-200 dark:border-dark-border shadow-lg dark:shadow-dark-lg"
            initial={reduce ? false : { opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: DUR.section, ease: EASE.out }}
          >
            <h4 className="text-xs font-mono text-neutral-500 tracking-wider mb-6">ACTIVITY TIMELINE</h4>

            <div className="relative">
              <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-neutral-200 dark:bg-dark-border" />
              <motion.div
                className="absolute left-5 top-2 w-0.5 bg-gradient-to-b from-emerald-500 via-emerald-400 to-amber-400"
                initial={{ height: 0 }}
                whileInView={{ height: '100%' }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 1.4, ease: EASE.out }}
              />

              <div className="space-y-6">
                {TIMELINE.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={index}
                      className="relative flex items-start gap-4"
                      initial={reduce ? false : { opacity: 0, y: 12 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.4 }}
                      transition={{ duration: DUR.standard, delay: index * 0.12, ease: EASE.out }}
                    >
                      <div className="relative">
                        <div className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center z-10 border-4 border-white dark:border-dark-bg',
                          item.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                          item.status === 'current' ? 'bg-amber-100 dark:bg-amber-900/30' :
                          'bg-neutral-100 dark:bg-dark-border'
                        )}>
                          <Icon className={cn(
                            'w-4 h-4',
                            item.status === 'completed' ? 'text-emerald-600 dark:text-emerald-400' :
                            item.status === 'current' ? 'text-amber-600 dark:text-amber-400' :
                            'text-neutral-400'
                          )} />
                        </div>
                        {item.status === 'current' && (
                          <motion.span
                            className="absolute -inset-1 rounded-full border-2 border-amber-400/70"
                            animate={reduce ? undefined : { scale: [1, 1.6], opacity: [0.6, 0] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                          />
                        )}
                      </div>
                      <div className="flex-1 pt-2">
                        <p className="text-xs text-neutral-500 mb-1">{item.date}</p>
                        <p className={cn(
                          'text-sm',
                          item.status === 'current' ? 'font-medium text-amber-700 dark:text-amber-300' :
                          item.status === 'completed' ? 'text-neutral-700 dark:text-neutral-300' :
                          'text-neutral-500 dark:text-neutral-500'
                        )}>
                          {item.label}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 p-4 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800">
              <p className="text-xs text-brand-700 dark:text-brand-300 leading-relaxed">
                <strong>Important:</strong> A promise must not automatically become fulfilled simply because an authority changes the issue status. Resolution requires verified evidence.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
