'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { DUR, EASE } from '@/lib/motion';
import { LocalAssessment, LocalRoadPanel } from '@/components/landing/CivicBeforeAfter';

export function AIVerificationSection() {
  const reduce = useReducedMotion();

  return (
    <section className="py-20 md:py-32 theme-light bg-[#F5F7FC] dark:bg-dark-bg-card" id="ai-verification">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          className="max-w-3xl mx-auto text-center mb-16"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: DUR.section, ease: EASE.out }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-brand-500" />
            AI Verification
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-neutral-900 dark:text-white mb-6 text-balance">
            A Resolution Claim Should Be Evidence-Backed.
          </h2>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 text-pretty">
            When an issue is marked as resolved, CivicChain shows before-and-after
            photographs of the location so the change can be compared directly.
            Drag the divider to compare the damaged and repaired road.
          </p>
        </motion.div>

        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
          <LocalRoadPanel />

          <motion.div
            className="h-fit"
            initial={reduce ? false : { opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: DUR.section, ease: EASE.out }}
          >
            <LocalAssessment />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
