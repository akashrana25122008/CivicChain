'use client';

import { motion, useReducedMotion } from 'framer-motion';
import useSWR from 'swr';
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
} from 'lucide-react';
import { DUR, EASE } from '@/lib/motion';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface LandingIntelligence {
  liveIssues: number;
  resolvedToday: number;
  promisesTracked: number;
  brokenPromises: number;
  activeRiskZones: number;
  averageResolutionTime: number | null;
  slaSuccessRatePct: number | null;
  verifiedResolutions: number;
  aiConfidence: number | null;
  resolutionRatePct: number | null;
  totalIssues: number;
  resolvedIssues: number;
  generatedAt: string;
}

export function DashboardPreviewSection() {
  const reduce = useReducedMotion();
  const { data } = useSWR<LandingIntelligence>('/api/public/intelligence', fetcher, {
    refreshInterval: 300000,
  });

  const avgDays =
    data?.averageResolutionTime != null
      ? Math.round((data.averageResolutionTime / (60 * 24)) * 10) / 10
      : 0;

  const KPI = [
    { label: 'Issues Tracked', value: data?.totalIssues ?? 0, decimals: 0, suffix: '', icon: FileText, color: 'text-brand-500', bg: 'bg-brand-50 dark:bg-brand-900/20' },
    { label: 'Resolved', value: data?.resolvedIssues ?? 0, decimals: 0, suffix: '', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Promise Fulfillment', value: data?.slaSuccessRatePct ?? 0, decimals: 1, suffix: '%', icon: TrendingUp, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/20' },
    { label: 'Broken Promises', value: data?.brokenPromises ?? 0, decimals: 0, suffix: '', icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
    { label: 'Avg Resolution Time', value: avgDays, decimals: 1, suffix: ' days', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { label: 'AI-Verified Resolutions', value: data?.verifiedResolutions ?? 0, decimals: 0, suffix: '', icon: Users, color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
  ];

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

          <p className="text-center text-[10px] text-neutral-400 mb-8 font-mono">LIVE DATA — DIRECT FROM THE CIVICCHAIN DATABASE</p>


        </div>
      </div>
    </section>
  );
}
