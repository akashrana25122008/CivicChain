'use client';

import { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  FileText,
  Brain,
  Merge,
  Target,
  Users,
  Gavel,
  Activity,
  ShieldCheck,
  BarChart3,
} from 'lucide-react';

const STEPS = [
  { label: 'REPORT', description: 'Citizen submits an issue with evidence and location.', icon: FileText, color: 'from-brand-500 to-brand-600' },
  { label: 'UNDERSTAND', description: 'AI analyses the report, category, severity and supporting evidence.', icon: Brain, color: 'from-violet-500 to-purple-600' },
  { label: 'MERGE', description: 'Duplicate reports from the same area are intelligently clustered.', icon: Merge, color: 'from-cyan-500 to-blue-600' },
  { label: 'PRIORITIZE', description: 'The system calculates a civic priority score.', icon: Target, color: 'from-amber-500 to-orange-600' },
  { label: 'ASSIGN', description: 'The issue is routed to the appropriate authority or department.', icon: Users, color: 'from-emerald-500 to-green-600' },
  { label: 'PROMISE', description: 'The authority records a commitment and expected completion date.', icon: Gavel, color: 'from-pink-500 to-rose-600' },
  { label: 'TRACK', description: 'CivicChain monitors the commitment against its deadline.', icon: Activity, color: 'from-indigo-500 to-blue-600' },
  { label: 'VERIFY', description: 'AI, evidence and community feedback help assess the resolution.', icon: ShieldCheck, color: 'from-teal-500 to-cyan-600' },
  { label: 'ACCOUNT', description: 'Performance becomes measurable through transparent analytics.', icon: BarChart3, color: 'from-orange-500 to-red-600' },
];

export function SolutionSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const [reached, setReached] = useState(0);
  const reduce = useReducedMotion();

  return (
    <section
      ref={sectionRef}
      className="py-20 md:py-32 theme-light dark:bg-dark-bg-card"
      id="solution"
    >
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          className="max-w-3xl mx-auto text-center mb-16"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-brand-500" />
            The Solution
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-neutral-900 dark:text-white mb-6 text-balance">
            CivicChain Connects the Entire Accountability Loop
          </h2>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 text-pretty">
            From initial report to verified resolution — every step is tracked, verified, and held accountable.
          </p>
        </motion.div>

        <div className="relative">
          {/* Progress line — fills as the user scrolls through steps */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 bg-neutral-200 dark:bg-dark-border hidden md:block" />
          <div
            ref={lineRef}
            className="absolute left-1/2 top-0 w-0.5 -translate-x-1/2 bg-gradient-to-b from-brand-500 via-violet-500 to-accent-500 hidden md:block"
            style={{
              height: `${(reached / STEPS.length) * 100}%`,
              transition: reduce ? 'none' : 'height 0.4s cubic-bezier(0.23,1,0.32,1)',
            }}
          />

          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isLeft = index % 2 === 0;
            const active = index <= reached;

            return (
              <motion.div
                key={step.label}
                className={cn(
                  'relative md:flex items-start md:gap-8 md:py-4',
                  isLeft ? 'md:flex-row' : 'md:flex-row-reverse'
                )}
                initial={reduce ? false : { opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.45 }}
                onViewportEnter={() => setReached((r) => Math.max(r, index))}
                transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
              >
                <div className={cn('md:w-5/12', isLeft ? 'md:text-right' : 'md:text-left')}>
                  <div
                    className={cn(
                      'p-6 rounded-2xl bg-white dark:bg-dark-bg border transition-all duration-300',
                      active
                        ? 'border-brand-300 dark:border-brand-700 shadow-lg dark:shadow-dark-lg'
                        : 'border-neutral-200 dark:border-dark-border',
                      'hover:shadow-lg dark:hover:shadow-dark-lg hover:-translate-y-1'
                    )}
                  >
                    <div className={cn('flex items-center gap-3 mb-3', isLeft && 'md:flex-row-reverse')}>
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', `bg-gradient-to-br ${step.color}`)}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className={cn(isLeft && 'md:text-right')}>
                        <span className="text-[10px] font-mono text-neutral-500 dark:text-neutral-500 tracking-wider">STEP {index + 1}</span>
                        <h3 className="font-display text-lg font-semibold text-neutral-900 dark:text-white">{step.label}</h3>
                      </div>
                    </div>
                    <p className={cn('text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed', isLeft && 'md:text-right')}>
                      {step.description}
                    </p>
                  </div>
                </div>

                {/* Node */}
                <div className="hidden md:flex w-2/12 justify-center pt-5">
                  <motion.div
                    className={cn(
                      'w-12 h-12 rounded-full bg-gradient-to-br flex items-center justify-center border-4 border-neutral-50 dark:border-dark-bg-card z-10',
                      step.color,
                      active ? 'scale-105' : 'opacity-60 saturate-50'
                    )}
                    animate={{ scale: active ? 1.06 : 1, opacity: active ? 1 : 0.6 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </motion.div>
                </div>

                <div className="hidden md:block md:w-5/12" />
              </motion.div>
            );
          })}
        </div>

        <motion.div
          className="mt-12 text-center"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800">
            <span className="text-brand-600 dark:text-brand-400 font-display font-bold text-lg">
              REPORT → PROMISE → TRACK → VERIFY → ACCOUNT
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
