'use client';

import { useReducedMotion, motion } from 'framer-motion';
import { staggerContainer, listItem } from '@/lib/motion';
import { cn } from '@/lib/utils';

export function DashboardGrid({
  children,
  className,
  cols = 3,
}: {
  children: React.ReactNode;
  className?: string;
  cols?: 2 | 3 | 4;
}) {
  const reduce = useReducedMotion();
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  };

  return (
    <motion.div
      variants={reduce ? undefined : staggerContainer(0.06)}
      initial={reduce ? undefined : 'hidden'}
      animate={reduce ? undefined : 'visible'}
      className={cn('grid gap-4', gridCols[cols], className)}
    >
      {children}
    </motion.div>
  );
}

export function DashboardItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      variants={reduce ? undefined : listItem(16)}
      className={className}
    >
      {children}
    </motion.div>
  );
}
