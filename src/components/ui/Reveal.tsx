'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DUR, EASE } from '@/lib/motion';

/**
 * Reveal — a reusable in-view entrance wrapper.
 *
 * Purpose: establishes hierarchy as a section enters the viewport
 * (section reveals, per the brief §8). Uses framer-motion's whileInView so
 * it composits on the GPU and respects `prefers-reduced-motion`.
 *
 * Gesture is varied per usage via the `from`/`direction` props rather than
 * applying one uniform fade-up to everything (anti-slop: identical reveals
 * everywhere reads as a template).
 */
interface RevealProps {
  children: ReactNode;
  className?: string;
  /** distance in px to travel from */
  distance?: number;
  /** direction of travel; center = fade only */
  direction?: 'up' | 'down' | 'left' | 'right' | 'center';
  /** per-instance delay (s) to chain reveals */
  delay?: number;
  /** duration override (s) */
  duration?: number;
  /** run the reveal only once (default true) */
  once?: boolean;
  as?: 'div' | 'section' | 'span' | 'li' | 'article' | 'h2' | 'h3' | 'p';
  amount?: number;
}

export function Reveal({
  children,
  className,
  distance = 28,
  direction = 'up',
  delay = 0,
  duration = DUR.section,
  once = true,
  as: Tag = 'div',
  amount = 0.25,
}: RevealProps) {
  const reduce = useReducedMotion();

  const offsets: Record<NonNullable<RevealProps['direction']>, { x: number; y: number }> = {
    up: { x: 0, y: distance },
    down: { x: 0, y: -distance },
    left: { x: distance, y: 0 },
    right: { x: -distance, y: 0 },
    center: { x: 0, y: 0 },
  };

  const offset = offsets[direction];

  const MotionTag = motion[Tag];

  return (
    <MotionTag
      className={cn(className)}
      initial={reduce ? false : { opacity: 0, x: offset.x, y: offset.y, scale: direction === 'center' ? 0.98 : 1 }}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ once, amount }}
      transition={
        reduce
          ? { duration: 0.01, delay: 0 }
          : { duration, delay, ease: EASE.out }
      }
    >
      {children}
    </MotionTag>
  );
}
