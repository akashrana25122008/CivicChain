'use client';

import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { FileText, Gavel, ShieldCheck, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const CHAPTERS = [
  {
    icon: FileText,
    step: '01',
    title: 'A citizen reports',
    body: 'An issue is filed with evidence and location — the first link in an accountable chain.',
    accent: 'text-brand-500 bg-brand-50 dark:bg-brand-900/30',
  },
  {
    icon: Gavel,
    step: '02',
    title: 'An authority promises',
    body: 'A commitment is recorded with a deadline, owner and department — public and time-stamped.',
    accent: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30',
  },
  {
    icon: ShieldCheck,
    step: '03',
    title: 'Work is verified',
    body: 'AI and community evidence check that what was promised actually happened on the ground.',
    accent: 'text-violet-600 bg-violet-50 dark:bg-violet-900/30',
  },
  {
    icon: BarChart3,
    step: '04',
    title: 'Performance is measured',
    body: 'Fulfillment, delays and outcomes become transparent analytics every citizen can see.',
    accent: 'text-brand-600 bg-brand-50 dark:bg-brand-900/30',
  },
];

/**
 * StoryScroll — horizontal storytelling band (§23).
 * A tall section whose inner sticky viewport slides four narrative chapters
 * horizontally as the page scrolls. Framer-motion useScroll drives a
 * translateX (GPU transform) with zero React re-renders. On mobile the same
 * group becomes a vertical list (no horizontal overflow). Reduced motion
 * renders the chapters stacked statically.
 */
export function StoryScroll() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });
  const x = useTransform(scrollYProgress, [0, 1], ['0%', '-75%']);

  return (
    <section ref={ref} className="relative theme-deep dark:bg-dark-bg" id="story-scroll">
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 w-full mb-10 md:mb-14">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-brand-300 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-brand-400" />
            The Accountability Story
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-white mt-6 mb-2 text-balance">
            From a Single Complaint to Lasting Change.
          </h2>
          <p className="text-white/60 md:text-lg">
            {reduce ? 'Four steps, one continuous loop.' : 'Scroll — four chapters, one continuous loop.'}
          </p>
        </div>

        {reduce ? (
          <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 grid gap-6 md:grid-cols-2">
            {CHAPTERS.map((c) => <ChapterCard key={c.step} chapter={c} />)}
          </div>
        ) : (
          <motion.div
            className="flex gap-6 md:gap-8 will-change-transform"
            style={{ x }}
          >
            {CHAPTERS.map((c) => (
              <div key={c.step} className="w-[78vw] sm:w-[56vw] md:w-[44vw] lg:w-[34vw] shrink-0">
                <ChapterCard chapter={c} />
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}

function ChapterCard({ chapter }: { chapter: (typeof CHAPTERS)[number] }) {
  const Icon = chapter.icon;
  return (
    <div className="h-[46vh] md:h-[52vh] rounded-3xl border border-white/10 bg-dark-bg-card/80 backdrop-blur p-8 md:p-10 flex flex-col justify-between overflow-hidden">
      <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center', chapter.accent)}>
        <Icon className="w-7 h-7" />
      </div>
      <div>
        <div className="text-xs font-mono text-white/40 mb-4">CHAPTER {chapter.step}</div>
        <h3 className="font-display text-2xl md:text-3xl font-bold text-white mb-3">{chapter.title}</h3>
        <p className="text-white/60 leading-relaxed">{chapter.body}</p>
      </div>
    </div>
  );
}
