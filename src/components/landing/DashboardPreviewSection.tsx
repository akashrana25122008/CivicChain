'use client';

import { useRef } from 'react';
import { motion, useReducedMotion, useInView } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Clock,
  Users,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { DUR, EASE } from '@/lib/motion';

const KPI = [
  { label: 'Issues Tracked', value: 12842, icon: FileText, color: 'text-brand-500', bg: 'bg-brand-50 dark:bg-brand-900/20' },
  { label: 'Resolved', value: 9421, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  { label: 'Promise Fulfillment', value: 82.6, decimals: 1, suffix: '%', icon: TrendingUp, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/20' },
  { label: 'Broken Promises', value: 1318, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
  { label: 'Avg Resolution Time', value: 4.2, decimals: 1, suffix: ' days', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  { label: 'AI-Verified', value: 91.3, decimals: 1, suffix: '%', icon: Users, color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
];

const DEPARTMENTS = [
  { name: 'Roads & Infrastructure', fulfillment: 89, delay: '2.1 days', broken: 8 },
  { name: 'Sanitation', fulfillment: 84, delay: '1.7 days', broken: 5 },
  { name: 'Electrical', fulfillment: 93, delay: '1.1 days', broken: 2 },
  { name: 'Drainage', fulfillment: 67, delay: '4.8 days', broken: 6 },
];

export function DashboardPreviewSection() {
  const reduce = useReducedMotion();
  const deptRef = useRef<HTMLDivElement>(null);
  const deptInView = useInView(deptRef, { once: true, amount: 0.3 });

  return (
    <section className="py-20 md:py-32 theme-light dark:bg-dark-bg-card" id="dashboard">
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
            Dashboard
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-neutral-900 dark:text-white mb-6 text-balance">
            Make Civic Performance Understandable.
          </h2>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 text-pretty">
            Public accountability dashboard with transparent metrics on promises, resolutions, and civic performance.
          </p>
        </motion.div>

        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {KPI.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.label}
                  initial={reduce ? false : { opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: DUR.standard, delay: i * 0.06, ease: EASE.out }}
                >
                  <Card variant="elevated" className="p-4 bg-white dark:bg-dark-bg border border-neutral-200 dark:border-dark-border h-full">
                    <CardContent>
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', item.bg)}>
                        <Icon className={cn('w-4 h-4', item.color)} />
                      </div>
                      <p className="text-2xl font-display font-bold text-neutral-900 dark:text-white">
                        <AnimatedNumber
                          value={item.value}
                          decimals={item.decimals || 0}
                          delay={0.3}
                          format={(n) => `${item.decimals ? n.toFixed(item.decimals) : Math.round(n)}${item.suffix || ''}`}
                        />
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">{item.label}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <p className="text-center text-[10px] text-neutral-400 mb-8 font-mono">PROTOTYPE DATA</p>

          <div className="p-8 rounded-2xl bg-white dark:bg-dark-bg border border-neutral-200 dark:border-dark-border shadow-lg dark:shadow-dark-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-lg font-semibold text-neutral-900 dark:text-white">Department Performance</h3>
              <span className="text-xs text-neutral-500 font-mono">PROTOTYPE DATA</span>
            </div>

            <div ref={deptRef} className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {DEPARTMENTS.map((dept, i) => (
                <motion.div
                  key={dept.name}
                  className="p-4 rounded-xl bg-neutral-50 dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border"
                  initial={reduce ? false : { opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: DUR.standard, delay: i * 0.08, ease: EASE.out }}
                >
                  <h4 className="text-sm font-medium text-neutral-900 dark:text-white mb-3">{dept.name}</h4>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-neutral-500">Fulfillment</span>
                        <span className="font-mono text-neutral-900 dark:text-white">
                          <AnimatedNumber value={dept.fulfillment} delay={0.3} format={(n) => `${Math.round(n)}%`} />
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-neutral-200 dark:bg-dark-border overflow-hidden">
                        <motion.div
                          className={cn(
                            'h-full rounded-full',
                            dept.fulfillment >= 85 ? 'bg-emerald-500' : dept.fulfillment >= 70 ? 'bg-amber-500' : 'bg-red-500'
                          )}
                          initial={{ width: '0%' }}
                          animate={deptInView ? { width: `${dept.fulfillment}%` } : {}}
                          transition={{ duration: 0.9, delay: 0.3 + i * 0.1, ease: EASE.out }}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">Avg Delay</span>
                      <span className="font-mono text-neutral-900 dark:text-white">{dept.delay}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">Broken Promises</span>
                      <span className="font-mono text-red-500">{dept.broken}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mt-8 text-center">
            <motion.div
              whileHover={reduce ? undefined : { scale: 1.04, y: -1 }}
              whileTap={reduce ? undefined : { scale: 0.97 }}
              transition={{ duration: DUR.fast, ease: EASE.out }}
            >
              <Button size="lg" asChild>
                <Link href="/dashboard" className="group">
                  Explore Full Dashboard
                  <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
