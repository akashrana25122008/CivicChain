'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, Users, ArrowUpRight, CheckCircle2, Quote, ChevronLeft, ChevronRight } from 'lucide-react';
import { DUR, EASE } from '@/lib/motion';

const RESOLVED_STORIES = [
  {
    ci: 'Road repair — Sector 12',
    who: 'Municipal Roads Department',
    outcome: 'Repaired, AI-verified',
    quote: 'The pothole was fixed within the promised window and confirmed by neighbourhood photos.',
  },
  {
    ci: 'Streetlight restoration — Market St',
    who: 'Electrical Department',
    outcome: 'Restored in 5 days',
    quote: 'A recurring outage was logged, promised, and resolved — visible to the whole ward.',
  },
  {
    ci: 'Drain clearance — Ward 4',
    who: 'Drainage Department',
    outcome: 'Cleared, verified',
    quote: 'Community verification matched the before/after evidence within 48 hours.',
  },
];

export function BrokenPromiseSection() {
  const reduce = useReducedMotion();

  const cardVariants = {
    hidden: { opacity: 0, y: 24 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: DUR.section, delay: i * 0.08, ease: EASE.out },
    }),
  };

  return (
    <section className="py-20 md:py-32 theme-tint dark:bg-dark-bg" id="broken-promise">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          className="max-w-3xl mx-auto text-center mb-16"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: DUR.section, ease: EASE.out }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Broken Promises
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-neutral-900 dark:text-white mb-6 text-balance">
            When a Deadline Passes, Accountability Begins.
          </h2>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 text-pretty">
            CivicChain automatically identifies commitments that remain unresolved after their recorded deadline.
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          <motion.div
            className="p-8 md:p-10 rounded-2xl bg-white dark:bg-dark-bg-card border-2 border-red-200 dark:border-red-800 shadow-xl dark:shadow-dark-xl"
            initial={reduce ? false : { opacity: 0, y: 28, scale: 0.985 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: DUR.section, ease: EASE.out }}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
              <div>
                <span className="text-xs font-mono text-red-500 tracking-wider">PROMISE EXPIRED</span>
                <h3 className="font-display text-2xl font-bold text-neutral-900 dark:text-white mt-2">
                  Promise #CC-00421
                </h3>
              </div>
              <motion.div
                className="px-4 py-2 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800"
                initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: DUR.standard, delay: 0.3, ease: EASE.out }}
              >
                <span className="text-sm font-bold text-red-700 dark:text-red-300 font-mono">BROKEN PROMISE</span>
              </motion.div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                {[
                  { icon: Clock, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', label: 'Deadline', value: '28 August 2026' },
                  { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', label: 'Current Status', value: 'Issue unresolved', valueColor: 'text-red-600 dark:text-red-400' },
                  { icon: Users, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', label: 'Affected Citizens', value: '63' },
                ].map((row, i) => {
                  const Icon = row.icon;
                  return (
                    <motion.div
                      key={row.label}
                      custom={i}
                      variants={cardVariants}
                      initial={reduce ? false : 'hidden'}
                      whileInView="show"
                      viewport={{ once: true, amount: 0.4 }}
                      className="flex items-start gap-4"
                    >
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', row.bg)}>
                        <Icon className={cn('w-5 h-5', row.color)} />
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500 mb-1">{row.label}</p>
                        <p className={cn('text-sm font-medium text-neutral-900 dark:text-white', row.valueColor)}>{row.value}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="space-y-6">
                <motion.div
                  custom={0}
                  variants={cardVariants}
                  initial={reduce ? false : 'hidden'}
                  whileInView="show"
                  viewport={{ once: true, amount: 0.4 }}
                  className="flex items-start gap-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
                    <ArrowUpRight className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Overdue</p>
                    <p className="text-2xl font-display font-bold text-red-600 dark:text-red-400">3 days</p>
                  </div>
                </motion.div>
                <motion.div
                  custom={1}
                  variants={cardVariants}
                  initial={reduce ? false : 'hidden'}
                  whileInView="show"
                  viewport={{ once: true, amount: 0.4 }}
                  className="flex items-start gap-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-violet-600 dark:text-violet-400">2</span>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Escalation Level</p>
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">Level 2 — Senior Department Review</p>
                  </div>
                </motion.div>
              </div>
            </div>

            <motion.div
              className="mt-8 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
              initial={reduce ? false : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: DUR.standard, delay: 0.4 }}
            >
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                CivicChain focuses on <strong>Accountability</strong>, <strong>Escalation</strong>, and <strong>Performance visibility</strong> — not punishment. The goal is systematic improvement, not blame.
              </p>
            </motion.div>
          </motion.div>
        </div>

        <div className="max-w-4xl mx-auto mt-16">
          <SuccessCarousel />
        </div>
      </div>
    </section>
  );
}

/**
 * SuccessCarousel — auto-advancing, draggable showcase (#13) of resolved &
 * verified commitments. AnimatePresence crossfade with dots + arrows. Auto-play
 * pauses on hover; reduced motion / coarse pointers fall back to a static grid
 * (no forced animation, no horizontal overflow).
 */
function SuccessCarousel() {
  const reduce = useReducedMotion();
  const [coarse, setCoarse] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = RESOLVED_STORIES.length;

  useEffect(() => {
    setCoarse(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  useEffect(() => {
    if (reduce || paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), 4200);
    return () => clearInterval(id);
  }, [reduce, paused, count]);

  const story = RESOLVED_STORIES[Math.min(index, count - 1)];

  return (
    <motion.div
      className="p-6 md:p-8 rounded-2xl bg-white dark:bg-dark-bg-card border border-emerald-200 dark:border-emerald-800 shadow-xl dark:shadow-dark-xl"
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: DUR.section, ease: EASE.out }}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 tracking-wider">
            OUTCOME SHOWCASE — THE LOOP WORKING
          </span>
          <h3 className="font-display text-xl md:text-2xl font-bold text-neutral-900 dark:text-white mt-2">
            When Promises Are Kept
          </h3>
        </div>
        {!coarse && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous story"
              onClick={() => setIndex((i) => (i - 1 + count) % count)}
              className="p-2 rounded-lg border border-neutral-200 dark:border-dark-border text-neutral-600 hover:text-brand-600 dark:text-neutral-300 dark:hover:text-brand-300 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Next story"
              onClick={() => setIndex((i) => (i + 1) % count)}
              className="p-2 rounded-lg border border-neutral-200 dark:border-dark-border text-neutral-600 hover:text-brand-600 dark:text-neutral-300 dark:hover:text-brand-300 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {coarse || reduce ? (
        <div className="grid md:grid-cols-3 gap-4">
          {RESOLVED_STORIES.map((s) => (
            <StoryCard key={s.ci} story={s} />
          ))}
        </div>
      ) : (
        <div className="relative min-h-[180px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={story.ci}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: DUR.standard, ease: EASE.out }}
            >
              <StoryCard story={story} />
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex items-center justify-center gap-2">
            {RESOLVED_STORIES.map((s, i) => (
              <button
                key={s.ci}
                type="button"
                aria-label={`Show ${s.ci}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  i === index ? 'w-6 bg-emerald-500' : 'w-2 bg-neutral-300 dark:bg-dark-border'
                )}
              />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function StoryCard({ story }: { story: (typeof RESOLVED_STORIES)[number] }) {
  return (
    <div className="grid md:grid-cols-[auto_1fr] gap-4 items-start md:items-center">
      <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
        <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div>
        <p className="font-semibold text-neutral-900 dark:text-white">{story.ci}</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
          {story.who} · <span className="text-emerald-600 dark:text-emerald-400 font-medium">{story.outcome}</span>
        </p>
        <p className="text-sm text-neutral-600 dark:text-neutral-300 flex gap-2">
          <Quote className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <span className="italic">{story.quote}</span>
        </p>
      </div>
    </div>
  );
}
