'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { DUR, EASE } from '@/lib/motion';

const FOOTER_LINKS = {
  Platform: [
    { label: 'Overview', href: '/' },
    { label: 'Civic Intelligence', href: '/#features' },
    { label: 'Accountability', href: '/#promise-ledger' },
    { label: 'How It Works', href: '/#solution' },
  ],
  Resources: [
    { label: 'Documentation', href: '/docs' },
    { label: 'Methodology', href: '/methodology' },
    { label: 'Open Data', href: '/data' },
  ],
  Project: [
    { label: 'About CivicChain', href: '/about' },
    { label: 'Technology', href: '/technology' },
    { label: 'Contact', href: '/contact' },
  ],
};

export function Footer() {
  const reduce = useReducedMotion();

  return (
    <footer className="bg-neutral-900 dark:bg-neutral-950 border-t border-neutral-200 dark:border-dark-border">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-16">
        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-5 gap-12"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: DUR.section, ease: EASE.out }}
        >
          <motion.div
            className="lg:col-span-2"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: DUR.section, delay: 0.05, ease: EASE.out }}
          >
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <span className="font-display font-bold text-xl text-white">CivicChain</span>
            </Link>
            <p className="text-sm text-neutral-400 leading-relaxed mb-4 max-w-sm">
              From Civic Complaints to Verifiable Accountability. An AI-powered civic accountability platform connecting citizens, authorities, evidence, and public accountability.
            </p>
            <p className="text-xs text-neutral-500 italic">
              CivicChain is a prototype concept demonstrating an AI-assisted civic accountability workflow.
            </p>
          </motion.div>

          {Object.entries(FOOTER_LINKS).map(([category, links], colIndex) => (
            <motion.div
              key={category}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: DUR.section, delay: 0.1 + colIndex * 0.08, ease: EASE.out }}
            >
              <h3 className="text-sm font-semibold text-white mb-4">{category}</h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-neutral-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="mt-12 pt-8 border-t border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-4"
          initial={reduce ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: DUR.section, delay: 0.15 }}
        >
          <p className="text-xs text-neutral-500">
            © {new Date().getFullYear()} CivicChain. Prototype demonstration.
          </p>
          <div className="flex items-center gap-4 text-xs text-neutral-500">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/accessibility" className="hover:text-white transition-colors">Accessibility</Link>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}