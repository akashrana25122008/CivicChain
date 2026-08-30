'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useInView } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import {
  Brain,
  Merge,
  Target,
  Gavel,
  ShieldCheck,
  BarChart3,
} from 'lucide-react';
import { DUR, EASE } from '@/lib/motion';

const FEATURES = [
  {
    title: 'AI Issue Intelligence',
    subtitle: 'Understand civic problems from evidence, not just text.',
    icon: Brain,
    color: 'from-brand-500 to-blue-600',
    description: 'Analyze submitted images and descriptions to identify likely issue categories, severity and relevant civic departments.',
    kind: 'detect',
  },
  {
    title: 'Duplicate Intelligence',
    subtitle: 'Turn hundreds of reports into one actionable issue.',
    icon: Merge,
    color: 'from-cyan-500 to-teal-600',
    description: 'CivicChain uses location, category, descriptions and visual similarity to identify related reports and create issue clusters.',
    kind: 'merge',
  },
  {
    title: 'Priority Intelligence',
    subtitle: 'Not every complaint has the same urgency.',
    icon: Target,
    color: 'from-amber-500 to-orange-600',
    description: 'Priority considers severity, number of affected citizens, time pending, location importance, potential safety impact, and recurrence.',
    kind: 'priority',
  },
  {
    title: 'Promise Engine',
    subtitle: 'A commitment should never disappear into a ticket number.',
    icon: Gavel,
    color: 'from-violet-500 to-purple-600',
    description: 'Authorities can record commitment, responsible department, responsible official/role, promised deadline, status updates, and supporting evidence.',
    kind: null,
  },
  {
    title: 'Resolution Verification',
    subtitle: '"Resolved" should be a claim that can be checked.',
    icon: ShieldCheck,
    color: 'from-emerald-500 to-green-600',
    description: 'CivicChain compares available before/after evidence and combines AI assessment with community verification.',
    kind: 'verify',
  },
  {
    title: 'Accountability Intelligence',
    subtitle: 'Turn civic activity into measurable performance.',
    icon: BarChart3,
    color: 'from-pink-500 to-rose-600',
    description: 'Track promise fulfillment, delays, broken promises, resolution time, verification outcomes, recurring issues, and department performance.',
    kind: null,
  },
];

function DetectionDemo() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();
  const [scanning, setScanning] = useState(false);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    const t1 = setTimeout(() => setScanning(true), 500);
    const stages = [
      () => setStage(1), // detected
      () => setStage(2), // confidence
      () => setStage(3), // severity
    ];
    const timers = stages.map((fn, i) => setTimeout(fn, 1100 + i * 650));
    const reset = setTimeout(() => {
      setScanning(false);
      setStage(0);
    }, 3600);
    return () => {
      clearTimeout(t1);
      timers.forEach(clearTimeout);
      clearTimeout(reset);
    };
  }, [inView, reduce]);

  return (
    <div ref={wrapRef} className="p-4 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-[10px] font-mono text-neutral-400 ml-2">AI ANALYSIS — PROTOTYPE</span>
      </div>

      <div className="flex items-center gap-4">
        {/* simulated evidence image with scanning band */}
        <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-gradient-to-br from-brand-700 via-dark-bg to-dark-bg-card border border-neutral-200 dark:border-dark-border flex items-center justify-center shrink-0">
          <div className="relative z-10 text-center">
            <div className="w-8 h-8 mx-auto rounded-full bg-brand-500/30 flex items-center justify-center">
              <span className="text-brand-300 text-xs font-bold">⌂</span>
            </div>
            <span className="text-[8px] font-mono text-white/50 mt-1 block">EVIDENCE</span>
          </div>
          {scanning && (
            <motion.div
              className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-brand-400 to-transparent shadow-[0_0_12px_3px_rgba(96,165,250,0.55)]"
              initial={{ top: '-4%', opacity: 0 }}
              animate={{ top: '104%', opacity: [0, 1, 1, 0.4] }}
              transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-br from-transparent to-brand-900/40" />
        </div>

        <div className="flex-1 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-500">Detected Issue</span>
            <motion.span
              className={cn('font-mono font-bold', stage >= 1 ? 'text-brand-600 dark:text-brand-400' : 'text-neutral-300 dark:text-neutral-600')}
              animate={{ opacity: stage >= 1 ? 1 : 0.4 }}
            >
              {stage >= 1 ? 'Road Pothole' : 'Analyzing…'}
            </motion.span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-neutral-500">Confidence</span>
            <motion.span
              className={cn('font-mono font-bold', stage >= 2 ? 'text-brand-600 dark:text-brand-400' : 'text-neutral-300 dark:text-neutral-600')}
              animate={{ opacity: stage >= 2 ? 1 : 0.4 }}
            >
              {stage >= 2 ? '94%' : '…'}
            </motion.span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-neutral-500">Severity</span>
            <motion.span
              className={cn('font-mono font-bold', stage >= 3 ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-300 dark:text-neutral-600')}
              animate={{ opacity: stage >= 3 ? 1 : 0.4 }}
            >
              {stage >= 3 ? 'HIGH' : '…'}
            </motion.span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-neutral-500">Department</span>
            <motion.span
              className={cn('font-medium', stage >= 3 ? 'text-neutral-900 dark:text-white' : 'text-neutral-300 dark:text-neutral-600')}
              animate={{ opacity: stage >= 3 ? 1 : 0.4 }}
            >
              {stage >= 3 ? 'Roads & Infrastructure' : '…'}
            </motion.span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MergeDemo() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    const timers = [
      setTimeout(() => setStage(1), 700),
      setTimeout(() => setStage(2), 1500),
      setTimeout(() => setStage(0), 2900),
    ];
    return () => timers.forEach(clearTimeout);
  }, [inView, reduce]);

  return (
    <div ref={wrapRef} className="p-4 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border text-center">
      <AnimatedStage
        stage={stage}
      />
    </div>
  );
}

function AnimatedStage({
  stage,
}: {
  stage: number;
}) {
  return (
    <div className="space-y-2.5">
      <motion.div
        className={cn('transition-colors', stage === 1 ? 'opacity-30' : 'opacity-100')}
      >
        <div className="text-2xl font-display font-bold text-neutral-900 dark:text-white">47</div>
        <div className="text-xs text-neutral-500">individual reports</div>
      </motion.div>

      <motion.div
        className="flex items-center justify-center gap-1"
        animate={{ opacity: 1 }}
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-1 h-1 rounded-full bg-brand-400"
            // Tween keyframes (0 → -4 → 0) — NOT spring. Springs only support
            // two keyframes; a multi-keyframe tween animates the bob cleanly.
            animate={stage === 1 ? { y: [0, -4, 0] } : { y: 0, opacity: 0.5 }}
            transition={{
              duration: 0.7,
              delay: i * 0.12,
              ease: 'easeInOut',
              repeat: stage === 1 ? Infinity : 0,
              repeatType: 'reverse',
            }}
          />
        ))}
      </motion.div>

      <motion.div
        className={cn('transition-colors', stage === 1 || stage === 2 ? 'opacity-100' : 'opacity-40')}
      >
        <div className={cn('text-xl font-display font-bold', stage < 1 ? 'text-neutral-400' : 'text-brand-600 dark:text-brand-400')}>
          1 Civic Issue
        </div>
        <div className="text-xs text-neutral-500">merged & verified</div>
      </motion.div>

      <motion.div
        className={cn('transition-colors', stage === 2 ? 'opacity-100' : 'opacity-40')}
      >
        <div className="text-sm text-neutral-600 dark:text-neutral-400">63 affected citizens</div>
      </motion.div>
    </div>
  );
}

/** Animated priority gauge — a circular ring + score that fills on view (§: detail). */
function PriorityDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const score = 91;

  return (
    <div
      ref={ref}
      className="p-4 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border flex items-center gap-4"
    >
      <div className="relative w-14 h-14 shrink-0">
        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="24" fill="none" strokeWidth="6" className="stroke-neutral-200 dark:stroke-dark-border" />
          <motion.circle
            cx="28"
            cy="28"
            r="24"
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            className="stroke-amber-500"
            strokeDasharray={2 * Math.PI * 24}
            initial={{ strokeDashoffset: 2 * Math.PI * 24 }}
            animate={inView && !reduce ? { strokeDashoffset: 2 * Math.PI * 24 * (1 - score / 100) } : {}}
            transition={{ duration: 1.1, delay: 0.2, ease: EASE.out }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            className={cn('text-sm font-display font-bold', reduce ? 'text-amber-500' : 'text-neutral-300 dark:text-neutral-500')}
            animate={inView ? { color: ['#d97706', '#f59e0b'] } : {}}
            transition={reduce ? { duration: 0 } : { duration: 1, delay: 0.6 }}
          >
            {score}
          </motion.span>
        </div>
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-neutral-900 dark:text-white">Priority Score</div>
        <div className="mt-1 inline-flex items-center gap-1.5">
          <motion.span
            className="w-2 h-2 rounded-full bg-amber-500"
            animate={reduce ? undefined : { opacity: [0.4, 1, 0.4], scale: [1, 1.3, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="text-xs font-mono text-amber-600 dark:text-amber-400 font-semibold">HIGH PRIORITY</span>
        </div>
      </div>
    </div>
  );
}

/** Animated verification meters — bars fill and glow on view (§: detail). */
function VerifyDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();

  const rows = [
    { label: 'Location Match', value: 98, color: 'bg-emerald-500' },
    { label: 'Visual Improvement', value: 84, color: 'bg-emerald-500' },
    { label: 'Repair Quality', value: 71, color: 'bg-amber-500' },
  ];

  return (
    <div ref={ref} className="p-4 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border space-y-3">
      {rows.map((row, i) => (
        <div key={row.label}>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-neutral-500">{row.label}</span>
            <motion.span
              className={cn('font-mono font-semibold', row.color === 'bg-emerald-500' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}
              initial={reduce ? false : { opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ duration: DUR.standard, delay: 0.3 + i * 0.15 }}
            >
              {row.value}%
            </motion.span>
          </div>
          <div className="h-1.5 rounded-full bg-neutral-200 dark:bg-dark-border overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full', row.color)}
              initial={reduce ? { width: `${row.value}%` } : { width: '0%' }}
              animate={inView ? { width: `${row.value}%` } : {}}
              transition={{ duration: 0.9, delay: 0.2 + i * 0.15, ease: EASE.out }}
            />
          </div>
        </div>
      ))}
      <div className="pt-2 mt-2 border-t border-neutral-200 dark:border-dark-border">
        <span className="text-xs font-mono text-amber-600 dark:text-amber-400 font-semibold">PARTIALLY RESOLVED</span>
      </div>
    </div>
  );
}

export function FeaturesSection() {
  const reduce = useReducedMotion();

  return (
    <section className="py-20 md:py-32 theme-tint dark:bg-dark-bg" id="features">
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
            Intelligence Layer
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-neutral-900 dark:text-white mb-6 text-balance">
            Intelligence Behind Every Civic Issue
          </h2>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 text-pretty">
            From duplicate detection to priority scoring to resolution verification — every feature serves accountability.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={reduce ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: DUR.section, delay: (index % 3) * 0.08, ease: EASE.out }}
              >
                <Card
                  variant="elevated"
                  className="group p-8 bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border hover:-translate-y-1 hover:shadow-xl transition-all duration-300 hover:border-brand-300 dark:hover:border-brand-700"
                >
                  <CardContent>
                    <motion.div
                      className={cn('w-14 h-14 rounded-xl flex items-center justify-center mb-6 bg-gradient-to-br', feature.color)}
                      whileHover={reduce ? undefined : { scale: 1.08, rotate: 4 }}
                      transition={{ duration: DUR.fast, ease: EASE.out }}
                    >
                      <Icon className="w-7 h-7 text-white" />
                    </motion.div>
                    <h3 className="font-display text-xl font-semibold text-neutral-900 dark:text-white mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-sm font-medium text-brand-600 dark:text-brand-400 mb-4">
                      {feature.subtitle}
                    </p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed mb-6">
                      {feature.description}
                    </p>

                    {feature.kind === 'detect' && <DetectionDemo />}
                    {feature.kind === 'merge' && <MergeDemo />}
                    {feature.kind === 'priority' && <PriorityDemo />}
                    {feature.kind === 'verify' && <VerifyDemo />}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
