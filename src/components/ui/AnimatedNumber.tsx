'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * AnimatedNumber — counts a value up from a start to a target when it first
 * enters the viewport. Purpose (brief §18): data metrics animate once on
 * appearance, never continuously. Also handles formatted strings with a
 * decimal/percent as the display target.
 *
 * Percent / compound values are passed as a number plus a `format` renderer.
 */
interface AnimatedNumberProps {
  value: number;
  /** animation duration in seconds */
  duration?: number;
  /** renderer for the number (e.g. append % or suffix) */
  format?: (n: number) => string;
  className?: string;
  /** delay before starting, in seconds */
  delay?: number;
  startDelay?: number;
  decimals?: number;
}

export function AnimatedNumber({
  value,
  duration = 1.4,
  format = (n) => String(n),
  className,
  delay = 0,
  decimals = 0,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;

    let raf = 0;
    const start = performance.now() + delay * 1000;
    const tick = (now: number) => {
      const elapsed = now - start;
      if (elapsed < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const progress = Math.min(elapsed / (duration * 1000), 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration, reduce, delay]);

  const rounded = decimals > 0 ? display.toFixed(decimals) : String(Math.round(display));

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {format(reduce ? value : Number(rounded))}
    </span>
  );
}
