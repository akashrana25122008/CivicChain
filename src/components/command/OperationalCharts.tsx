'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { TrendingUp, PieChart as PieIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { motion } from 'framer-motion';
import { fadeUp } from '@/lib/motion';

export interface OperationalTrendPoint {
  day: string;
  created: number;
}

export interface OperationalCategoryCount {
  category: string;
  label: string;
  count: number;
}

const CATEGORY_PALETTE = [
  '#8b5cf6', // violet
  '#0ea5e9', // sky
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#22d3ee', // cyan
  '#94a3b8', // slate
];

interface Props {
  loading: boolean;
  byDay?: OperationalTrendPoint[];
  byCategory?: OperationalCategoryCount[];
}

function sym(label: string): string {
  const d = new Date(`${label}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return label;
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function OperationalCharts({ loading, byDay = [], byCategory = [] }: Props) {
  const totalCategorized = byCategory.reduce((s, c) => s + c.count, 0);

  return (
    <section className="grid lg:grid-cols-2 gap-6" aria-label="Command center analytics">
      {/* Incident Volume Trend */}
      <motion.div variants={fadeUp(20, 0.1)} initial="hidden" animate="visible">
        <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80 h-full">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-500" />
              Incident Volume — 14 Day Trend
            </CardTitle>
            {!loading && byDay.length > 0 && (
              <span className="text-[11px] text-neutral-400 font-mono">
                {byDay.reduce((s, d) => s + d.created, 0)} new
              </span>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingBlock rows={3} />
            ) : byDay.length === 0 ? (
              <EmptyState icon={TrendingUp} title="No incident data" description="Incident volume will appear here as reports come in." />
            ) : (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={byDay} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ccVolume" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} vertical={false} />
                    <XAxis
                      dataKey="day"
                      tickFormatter={sym}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      minTickGap={24}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={34} />
                    <Tooltip
                      cursor={{ stroke: 'currentColor', strokeDasharray: '3 3' }}
                      contentStyle={{ fontSize: 12 }}
                      labelFormatter={(v) => String(v)}
                    />
                    <Area
                      type="monotone"
                      dataKey="created"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fill="url(#ccVolume)"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Incident Mix by Category */}
      <motion.div variants={fadeUp(20, 0.16)} initial="hidden" animate="visible">
        <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80 h-full">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-violet-500" />
              Incident Mix by Category
            </CardTitle>
            {!loading && totalCategorized > 0 && (
              <span className="text-[11px] text-neutral-400 font-mono">{totalCategorized} total</span>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingBlock rows={3} />
            ) : totalCategorized === 0 ? (
              <EmptyState icon={PieIcon} title="No category data" description="Category breakdown will appear once incidents are catalogued." />
            ) : (
              <div className="flex h-[260px] w-full items-center gap-4">
                <div className="relative h-full flex-1 min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={byCategory}
                        dataKey="count"
                        nameKey="label"
                        innerRadius="58%"
                        outerRadius="90%"
                        paddingAngle={2}
                        stroke="none"
                      >
                        {byCategory.map((row, i) => (
                          <Cell key={row.category} fill={CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="font-display text-2xl font-bold text-neutral-900 dark:text-white">{totalCategorized}</p>
                      <p className="text-[10px] uppercase tracking-wider text-neutral-400">incidents</p>
                    </div>
                  </div>
                </div>
                <div className="w-40 shrink-0 space-y-2">
                  {byCategory.slice(0, 6).map((row, i) => (
                    <div key={row.category} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] }} />
                      <span className="flex-1 truncate text-xs text-neutral-600 dark:text-neutral-300">{row.label}</span>
                      <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">{row.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </section>
  );
}
