'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { AuthActions } from './AuthActions';
import { ArrowRight, FileText, BarChart3 } from 'lucide-react';
import { DUR, EASE } from '@/lib/motion';

export function CTASection() {
  const reduce = useReducedMotion();

  return (
    <section className="py-20 md:py-32 bg-dark-bg relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-900/20 via-dark-bg to-violet-900/20" />

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          className="max-w-4xl mx-auto text-center"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: DUR.section, ease: EASE.out }}
        >
          <motion.h2
            className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 text-balance"
            initial={reduce ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: DUR.section, delay: 0.05, ease: EASE.out }}
          >
            Ready to Transform Civic Accountability?
          </motion.h2>
          <motion.p
            className="text-lg text-white/60 mb-10 text-pretty max-w-2xl mx-auto"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: DUR.section, delay: 0.15, ease: EASE.out }}
          >
            Join the movement toward transparent, verifiable, and accountable civic governance. Every report matters. Every promise counts.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: DUR.section, delay: 0.25, ease: EASE.out }}
          >
            <AuthActions />
          </motion.div>

          <motion.div
            className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-white/40"
            initial={reduce ? false : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: DUR.section, delay: 0.35 }}
          >
            <span>AI-assisted</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>Evidence-based</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>Geospatial</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>Transparent</span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
