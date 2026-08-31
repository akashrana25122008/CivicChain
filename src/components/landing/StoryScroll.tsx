'use client';

import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { FileText, Gavel, ShieldCheck, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChapterScene } from './StoryScene';

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
 * Desktop: the section is 300vh tall so the inner sticky viewport pins while
 * the four chapters slide horizontally as the page scrolls (framer-motion
 * useScroll drives a GPU translateX with zero React re-renders). The travel
 * height is what gives the scroll progress a real 0→1 range — without it the
 * animation would cut/jump, so it is gated to the scrub layout only.
 * Mobile + reduced motion: chapters render as a static vertical stack.
 */
export function StoryScroll() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const scrub = !reduce;
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });
  const x = useTransform(scrollYProgress, [0, 1], ['0%', '-75%']);

  const grid = (
    <div className="grid gap-6 md:grid-cols-2">
      {CHAPTERS.map((c) => (
        <ChapterCard key={c.step} chapter={c} />
      ))}
    </div>
  );

  return (
    <section
      ref={ref}
      className={cn('relative theme-deep dark:bg-dark-bg', scrub && 'lg:h-[300vh]')}
      id="story-scroll"
    >
      <div
        className={cn(
          'flex flex-col justify-center overflow-hidden',
          scrub && 'lg:sticky lg:top-0 lg:h-screen'
        )}
      >
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 w-full mb-10 md:mb-14">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-brand-300 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-brand-400" />
            The Accountability Story
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-white mt-6 mb-2 text-balance">
            From a Single Complaint to Lasting Change.
          </h2>
          <p className="text-white/60 md:text-lg">
            {scrub ? 'Scroll — four chapters, one continuous loop.' : 'Four steps, one continuous loop.'}
          </p>
        </div>

        {scrub ? (
          <>
            <div className="lg:hidden w-full max-w-[1400px] mx-auto px-4 md:px-6 pb-20">
              {grid}
            </div>
            <motion.div
              className="hidden lg:flex gap-6 md:gap-8 will-change-transform px-[min(8vw,6rem)]"
              style={{ x }}
            >
              {CHAPTERS.map((c) => (
                <div key={c.step} className="w-[34vw] max-w-[520px] shrink-0">
                  <ChapterCard chapter={c} />
                </div>
              ))}
            </motion.div>
          </>
        ) : (
          <div className="w-full max-w-[1400px] mx-auto px-4 md:px-6 pb-20">
            {grid}
          </div>
        )}
      </div>
    </section>
  );
}

function ChapterCard({ chapter }: { chapter: (typeof CHAPTERS)[number] }) {
  const Icon = chapter.icon;
  return (
    <div className="flex h-[46vh] md:h-[52vh] flex-col overflow-hidden rounded-3xl border border-white/10 bg-dark-bg-card/80 backdrop-blur">
      <div className="relative h-[42%] min-h-[120px] shrink-0 overflow-hidden">
        <ChapterScene step={chapter.step} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-dark-bg-card/90 via-transparent to-transparent" />
        <div
          className={cn(
            'absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-xl shadow-lg ring-1 ring-white/10',
            chapter.accent
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-center px-6 py-5 md:px-8">
        <div className="mb-3 text-xs font-mono tracking-widest text-white/40">
          CHAPTER {chapter.step}
        </div>
        <h3 className="font-display text-2xl md:text-3xl font-bold text-white">{chapter.title}</h3>
        <p className="mt-3 leading-relaxed text-white/60">{chapter.body}</p>
      </div>
    </div>
  );
}