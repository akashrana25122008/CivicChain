'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { fadeUp } from '@/lib/motion';

export function PageHeader({
  kicker,
  title,
  description,
  children,
}: {
  kicker?: string;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      variants={reduce ? undefined : fadeUp(20)}
      initial={reduce ? undefined : 'hidden'}
      animate={reduce ? undefined : 'visible'}
      className="mb-8"
    >
      {kicker && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-600 dark:text-brand-400 mb-3 flex items-center gap-2">
          <span className="w-6 h-px bg-brand-500 dark:bg-brand-400" aria-hidden="true" />
          {kicker}
        </p>
      )}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-neutral-900 dark:text-white tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="text-neutral-500 dark:text-neutral-400 mt-2 max-w-2xl text-[15px] leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {children && (
          <div className="flex flex-wrap gap-2">
            {children}
          </div>
        )}
      </div>
    </motion.div>
  );
}