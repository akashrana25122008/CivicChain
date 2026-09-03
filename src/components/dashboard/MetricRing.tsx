'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MetricRingProps {
  value: number;
  max?: number;
  label: string;
  sublabel?: string;
  color?: string;
  trackColor?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function MetricRing({
  value,
  max = 100,
  label,
  sublabel,
  color = '#3f53ec',
  trackColor,
  size = 120,
  strokeWidth = 10,
  className,
}: MetricRingProps) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(0, value), max);
  const progress = clamped / max;
  const [display, setDisplay] = useState(reduce ? progress : 0);

  useEffect(() => {
    if (!inView || reduce) return;
    let raf = 0;
    const start = performance.now();
    const duration = 1200;
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(progress * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, progress, reduce]);

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          ref={ref}
          className="w-full h-full -rotate-90"
          viewBox={`0 0 ${size} ${size}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={trackColor ?? 'rgba(118,146,255,0.1)'}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - display)}
            className="transition-none"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-display text-xl font-bold text-neutral-900 dark:text-white">
            {Math.round(display * max)}
          </span>
          {sublabel && (
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">{sublabel}</span>
          )}
        </div>
      </div>
      <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 text-center">{label}</p>
    </div>
  );
}
