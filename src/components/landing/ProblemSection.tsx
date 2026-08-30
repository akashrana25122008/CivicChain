'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, useInView } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { Reveal } from '@/components/ui/Reveal';
import { AlertCircle, Search, Users, BarChart3, ChevronDown } from 'lucide-react';
import { DUR, EASE } from '@/lib/motion';

const FLOW_TONES = {
  neutral: 'text-white/70 border-white/10 bg-white/5',
  warn: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  bad: 'text-red-300 border-red-500/40 bg-red-500/15',
} as const;

type FlowTone = keyof typeof FLOW_TONES;
type FlowStep = { label: string; tone: FlowTone };
type Problem = {
  title: string;
  description: string;
  icon: typeof AlertCircle;
  color: string;
  bg: string;
  border: string;
  activeBorder: string;
  flow: FlowStep[];
};

const PROBLEMS: Problem[] = [
  {
    title: 'Promises Disappear',
    description: 'A complaint may be acknowledged, but the promised deadline can become difficult to track.',
    icon: AlertCircle,
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    activeBorder: 'ring-2 ring-red-500/40 border-red-400 dark:border-red-500',
    flow: [
      { label: 'Complaint', tone: 'neutral' },
      { label: 'Authority', tone: 'neutral' },
      { label: 'Promise', tone: 'neutral' },
      { label: 'Deadline', tone: 'warn' },
      { label: 'No tracking', tone: 'warn' },
      { label: 'Broken accountability', tone: 'bad' },
    ],
  },
  {
    title: 'Resolution Is Hard to Verify',
    description: 'A civic issue marked "resolved" does not automatically mean the underlying problem has actually been fixed.',
    icon: Search,
    color: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    activeBorder: 'ring-2 ring-amber-500/40 border-amber-400 dark:border-amber-500',
    flow: [
      { label: 'Marked "Resolved"', tone: 'warn' },
      { label: 'No photo evidence', tone: 'warn' },
      { label: 'No geo match', tone: 'warn' },
      { label: 'No community check', tone: 'warn' },
      { label: 'Resolution unproven', tone: 'bad' },
    ],
  },
  {
    title: 'Duplicate Reports Create Noise',
    description: 'Dozens of citizens may report the same issue separately, making it harder to understand the actual scale and priority of the problem.',
    icon: Users,
    color: 'text-brand-500',
    bg: 'bg-brand-50 dark:bg-brand-900/20',
    border: 'border-brand-200 dark:border-brand-800',
    activeBorder: 'ring-2 ring-brand-500/40 border-brand-400 dark:border-brand-500',
    flow: [
      { label: '47 separate reports', tone: 'neutral' },
      { label: 'Same location', tone: 'neutral' },
      { label: 'Same category', tone: 'neutral' },
      { label: 'No clustering', tone: 'warn' },
      { label: 'Noise hides scale', tone: 'bad' },
    ],
  },
  {
    title: 'Accountability Is Difficult to Measure',
    description: 'Citizens need a transparent way to understand resolution performance, delays, commitments and recurring civic problems.',
    icon: BarChart3,
    color: 'text-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800',
    activeBorder: 'ring-2 ring-purple-500/40 border-purple-400 dark:border-purple-500',
    flow: [
      { label: 'Promises made', tone: 'neutral' },
      { label: 'Deadlines set', tone: 'neutral' },
      { label: 'No performance record', tone: 'warn' },
      { label: 'No public metrics', tone: 'warn' },
      { label: 'Accountability invisible', tone: 'bad' },
    ],
  },
];

export function ProblemSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const inView = useInView(sectionRef, { once: true, amount: 0.15 });

  const current = PROBLEMS[active];

  return (
    <section
      ref={sectionRef}
      className="py-20 md:py-32 theme-tint dark:bg-dark-bg"
      id="problem"
    >
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            The Problem
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-neutral-900 dark:text-white mb-6 text-balance">
            A Complaint Is Recorded. But What Happens to the Promise?
          </h2>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 text-pretty">
            Citizens can report potholes, broken streetlights, blocked drains, garbage accumulation and other civic issues. But reporting an issue is only the beginning. The critical questions often remain unanswered.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {PROBLEMS.map((problem, index) => {
            const Icon = problem.icon;
            const isActive = active === index;
            return (
              <motion.div
                key={problem.title}
                initial={reduce ? false : { opacity: 0, y: 24 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: DUR.section, delay: index * 0.08, ease: EASE.out }}
              >
                <Card
                  variant="elevated"
                  onClick={() => setActive(index)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActive(index);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isActive}
                  aria-label={`${problem.title} — select to see the sequence`}
                  className={cn(
                    'group relative p-8 transition-all duration-300 cursor-pointer h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                    'bg-white dark:bg-dark-bg-card border',
                    isActive ? problem.activeBorder : `hover:-translate-y-1 ${problem.border}`
                  )}
                >
                  <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <span className="text-2xl text-neutral-300 dark:text-neutral-600">+</span>
                  </div>
                  <CardContent>
                    <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center mb-6 transition-transform duration-300', problem.bg, isActive && 'scale-105')}>
                      <Icon className={cn('w-7 h-7', problem.color)} />
                    </div>
                    <h3 className="font-display text-xl font-semibold text-neutral-900 dark:text-white mb-3">
                      {problem.title}
                    </h3>
                    <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      {problem.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Interactive problem flow — updates on selection */}
        <div className="mt-12 rounded-2xl bg-dark-bg border border-dark-border overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border flex-wrap gap-2">
            <span className="text-xs font-mono text-white/50 tracking-wider">SELECTED — {current.title.toUpperCase()}</span>
            <span className="flex items-center gap-2 text-[10px] font-mono text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              WHY IT FAILS
            </span>
          </div>

          <div className="p-6 md:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.title}
                className="flex flex-col md:flex-row items-stretch gap-3 w-full"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: DUR.standard, ease: EASE.out }}
              >
                {current.flow.map((step, i) => (
                  <div key={step.label} className="flex flex-1 items-center">
                    <motion.div
                      className={cn(
                        'flex-1 rounded-lg border px-4 py-3 text-center md:text-left',
                        FLOW_TONES[step.tone]
                      )}
                      initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: DUR.standard, delay: i * 0.06, ease: EASE.out }}
                    >
                      <span className="text-xs font-mono text-white/30 mr-1">{i + 1}.</span>
                      <span className="text-sm font-medium">{step.label}</span>
                    </motion.div>
                    {i < current.flow.length - 1 && (
                      <span className="mx-1 md:mx-2 text-white/30 shrink-0">
                        <ChevronDown className="w-4 h-4 md:rotate-[-90deg]" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* The Unanswered Questions */}
        <div className="mt-12 p-6 rounded-2xl bg-neutral-50 dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <Reveal direction="right" distance={24}>
              <p className="text-sm text-neutral-500 dark:text-neutral-500 mb-2 font-mono uppercase tracking-wider">The Unanswered Questions</p>
              <ul className="space-y-3 text-neutral-700 dark:text-neutral-300">
                {[
                  'Who committed to fixing it?',
                  'When did they promise to fix it?',
                  'Was the promise fulfilled on time?',
                  'Was the resolution actually genuine?',
                  'How can citizens measure accountability?',
                ].map((q, i) => (
                  <motion.li
                    key={q}
                    initial={reduce ? false : { opacity: 0, x: -12 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: DUR.standard, delay: i * 0.06, ease: EASE.out }}
                    className="flex items-start gap-3"
                  >
                    <span className="text-brand-500 font-bold mt-0.5">?</span>
                    <span>{q}</span>
                  </motion.li>
                ))}
              </ul>
            </Reveal>
            <Reveal direction="left" distance={24} delay={0.08}>
              <Card variant="elevated" className="h-full bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border p-6">
                <CardContent>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed text-center">
                    <strong>The result:</strong> without tracking and verification, each complaint becomes a one-way message — reported, then forgotten.
                  </p>
                </CardContent>
              </Card>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
