'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Radar,
  TriangleAlert,
  ArrowRight,
  BrainCircuit,
  Building2,
  Radio,
  HeartPulse,
  ShieldAlert,
  BadgeCheck,
  ChevronRight,
  Activity,
  PlusCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { ErrorState } from '@/components/dashboard/ErrorState';
import { type CommandMapPoint } from '@/components/command/CommandMap';
import { CommandIntelligencePanel } from '@/components/command/CommandIntelligencePanel';
import { OperationalCharts } from '@/components/command/OperationalCharts';
import { fadeUp, staggerContainer, listItem } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { Severity, PriorityLevel } from '../../../../generated/prisma/client';

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json();
  });

const REFRESH_INTERVAL = 30_000;

// ---------------------------------------------------------------------------
// Response types (mirror the admin command-center service `operational` block)
// ---------------------------------------------------------------------------

export interface AdminCommandCenterData {
  operational: {
    summary: {
      criticalIncidents: number;
      highPriority: number;
      unassigned: number;
      slaBreaches: number;
      generatedAt: string;
    };
    attentionQueue: Array<{
      id: string;
      publicId: string;
      title: string;
      category: string;
      categoryLabel: string;
      severity: Severity | null;
      severityLabel: string | null;
      priority: number | null;
      priorityLevel: PriorityLevel | null;
      priorityLevelLabel: string | null;
      status: string;
      statusLabel: string;
      location: string | null;
      ward: string | null;
      departmentName: string | null;
      assigned: boolean;
      slaState: string;
      slaRemainingLabel: string | null;
      createdAt: string;
      timeLabel: string;
      attentionScore: number;
      attentionLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      reason: string;
      escalationLevel: number;
      reportCount: number;
    }>;
    departments: Array<{
      id: string;
      name: string;
      activeCases: number;
      avgResponseLabel: string;
      avgResponseMinutes: number | null;
      loadLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      loadPct: number;
      operational: boolean;
      esealationsOpen: number;
      breached: number;
    }>;
    activity: Array<{
      id: string;
      kind: 'assignment' | 'escalation' | 'sla' | 'report' | 'ai' | 'verification';
      message: string;
      issuePublicId: string | null;
      actor: string | null;
      timeLabel: string;
      createdAt: string;
    }>;
    system: Array<{
      key: string;
      label: string;
      status: 'OPERATIONAL' | 'DEGRADED' | 'WARNING';
      detail: string;
    }>;
    intelligence: {
      assessment: string | null;
      recommendations: Array<{ id: string; action: string; severity: 'high' | 'medium' | 'low' }>;
      riskSignal: string | null;
      signalDirection: 'INCREASING' | 'STABLE' | 'DECREASING' | null;
      signalStrength: number | null;
      computedAt: string;
    };
    trend: {
      byDay: Array<{ day: string; created: number }>;
      byCategory: Array<{ category: string; label: string; count: number }>;
    };
    mapContext: {
      points: Array<{
        id: string;
        publicId: string;
        title: string;
        latitude: number;
        longitude: number;
        severity: Severity | null;
        priorityLevel: PriorityLevel | null;
        detail: {
          categoryLabel: string;
          severityLabel: string | null;
          priorityLevelLabel: string | null;
          location: string | null;
          statusLabel: string;
          departmentName: string | null;
          assigned: boolean;
          slaState: string;
          slaRemainingLabel: string | null;
          timeLabel: string;
          attentionLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
        };
      }>;
      center: { lat: number; lng: number } | null;
    };
  };
  generatedAt: string;
}

type Filter = 'all' | 'critical' | 'high' | 'unassigned' | 'sla';

const ACTIVE_FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'critical', label: 'Critical' },
  { id: 'high', label: 'High' },
  { id: 'unassigned', label: 'Unassigned' },
  { id: 'sla', label: 'SLA' },
];

function loadTone(level: string): { text: string; bar: string; label: string } {
  switch (level) {
    case 'CRITICAL':
      return { text: 'text-red-600 dark:text-red-400', bar: 'bg-red-500', label: 'Critical' };
    case 'HIGH':
      return { text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500', label: 'High' };
    case 'MEDIUM':
      return { text: 'text-brand-600 dark:text-brand-400', bar: 'bg-brand-500', label: 'Medium' };
    default:
      return { text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500', label: 'Low' };
  }
}

function priorityChip(
  level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
): { cls: string } {
  const t = loadTone(level);
  return { cls: cn('inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-full border', t.text, t.bar === 'bg-red-500' ? 'bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-800' : t.bar === 'bg-amber-500' ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800' : t.bar === 'bg-brand-500' ? 'bg-brand-50 border-brand-200 dark:bg-brand-900/30 dark:border-brand-800' : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800') };
}

export default function AdminCommandCenter() {
  const reduce = useReducedMotion();
  const { data, error, isLoading, mutate } = useSWR<AdminCommandCenterData>(
    '/api/admin/command-center',
    fetcher,
    { refreshInterval: REFRESH_INTERVAL },
  );
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const op = data?.operational;
  const summary = op?.summary;
  const queue = useMemo(() => op?.attentionQueue ?? [], [op]);
  const departments = op?.departments ?? [];
  const activity = op?.activity ?? [];
  const system = op?.system ?? [];
  const intel = op?.intelligence;
  const trend = op?.trend;

  const filteredQueue = useMemo(() => {
    switch (filter) {
      case 'critical':
        return queue.filter((q) => q.attentionLevel === 'CRITICAL');
      case 'high':
        return queue.filter((q) => q.attentionLevel === 'HIGH');
      case 'unassigned':
        return queue.filter((q) => !q.assigned);
      case 'sla':
        return queue.filter((q) => q.slaState === 'BREACHED' || q.slaState === 'AT_RISK');
      default:
        return queue;
    }
  }, [queue, filter]);

  const mapPoints = useMemo<CommandMapPoint[]>(() => {
    const raw: CommandMapPoint[] = (op?.mapContext.points ?? []).map((p) => ({
      id: p.id,
      publicId: p.publicId,
      title: p.title,
      latitude: p.latitude,
      longitude: p.longitude,
      severity: p.severity,
      priorityLevel: p.priorityLevel,
      detail: p.detail
        ? {
            categoryLabel: p.detail.categoryLabel,
            severityLabel: p.detail.severityLabel,
            priorityLevelLabel: p.detail.priorityLevelLabel,
            location: p.detail.location,
            statusLabel: p.detail.statusLabel,
            departmentName: p.detail.departmentName,
            assigned: p.detail.assigned,
            slaState: p.detail.slaState,
            slaRemainingLabel: p.detail.slaRemainingLabel,
            timeLabel: p.detail.timeLabel,
            attentionLevel: p.detail.attentionLevel,
          }
        : null,
    }));
    // Keep map + Incident Index driven by the same active filter.
    if (filter === 'all') return raw;
    return raw.filter((p) => {
      const d = p.detail;
      if (!d) return false;
      switch (filter) {
        case 'critical':
          return d.attentionLevel === 'CRITICAL';
        case 'high':
          return d.attentionLevel === 'HIGH';
        case 'unassigned':
          return !d.assigned;
        case 'sla':
          return d.slaState === 'BREACHED' || d.slaState === 'AT_RISK';
        default:
          return true;
      }
    });
  }, [op, filter]);

  const timestamp = summary?.generatedAt ?? data?.generatedAt;
  const clockLabel = timestamp ? new Date(timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

  return (
    <div className="space-y-6">
      {/* ═══════════ SECTION 1 — COMMAND CENTER HEADER ═══════════ */}
      <motion.div
        initial={reduce ? undefined : 'hidden'}
        animate={reduce ? undefined : 'visible'}
        variants={reduce ? undefined : fadeUp(16, 0)}
        className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
      >
        <div>
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="w-1.5 h-4 rounded-full bg-brand-500" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400">
              Command Center
            </span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Civic Operations Control
          </h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
            Monitor critical incidents, coordinate departments, and manage city-wide civic response operations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Live status */}
          <div className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card px-3 py-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Live</span>
            {clockLabel && <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500">{clockLabel}</span>}
          </div>

          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/health">
              <HeartPulse className="w-4 h-4 flex-shrink-0" />
              System Health
            </Link>
          </Button>

          <Button size="sm" asChild>
            <Link href="/report">
              <PlusCircle className="w-4 h-4 flex-shrink-0" />
              Create Emergency Incident
            </Link>
          </Button>
        </div>
      </motion.div>

      {error && <ErrorState onRetry={() => mutate()} />}

      {/* ═══════════ SECTION 2 — CRITICAL OPERATIONS SUMMARY ═══════════ */}
      <motion.section
        variants={reduce ? undefined : staggerContainer(0.06, 0.02)}
        initial={reduce ? undefined : 'hidden'}
        animate={reduce ? undefined : 'visible'}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        aria-label="Critical operations summary"
      >
        <SummaryCell
          label="Critical Incidents"
          value={summary?.criticalIncidents ?? '…'}
          loading={isLoading}
          active={filter === 'critical'}
          critical
          onClick={() => setFilter(filter === 'critical' ? 'all' : 'critical')}
        />
        <SummaryCell
          label="High Priority"
          value={summary?.highPriority ?? '…'}
          loading={isLoading}
          active={filter === 'high'}
          high
          onClick={() => setFilter(filter === 'high' ? 'all' : 'high')}
        />
        <SummaryCell
          label="Unassigned"
          value={summary?.unassigned ?? '…'}
          loading={isLoading}
          active={filter === 'unassigned'}
          onClick={() => setFilter(filter === 'unassigned' ? 'all' : 'unassigned')}
        />
        <SummaryCell
          label="SLA Breaches"
          value={summary?.slaBreaches ?? '…'}
          loading={isLoading}
          active={filter === 'sla'}
          warning={Boolean(summary?.slaBreaches)}
          onClick={() => setFilter(filter === 'sla' ? 'all' : 'sla')}
        />
      </motion.section>

      {/* ═══════════ SECTIONS 3 + 4 — MAP + AI INTELLIGENCE ═══════════ */}
      <section className="grid lg:grid-cols-3 gap-6">
        {/* Live Incident Command Map — hybrid 2D/3D intelligence panel */}
        <motion.div
          variants={reduce ? undefined : fadeUp(20, 0.1)}
          initial={reduce ? undefined : 'hidden'}
          animate={reduce ? undefined : 'visible'}
          className="lg:col-span-2"
        >
          {!data ? (
            <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80">
              <CardContent className="p-6">
                <LoadingBlock rows={3} />
              </CardContent>
            </Card>
          ) : (
            <CommandIntelligencePanel
              mapPoints={mapPoints}
              selectedId={selectedId}
              onSelectIssue={setSelectedId}
              mapContext={{
                points: (op?.mapContext.points ?? []).map((p) => ({
                  id: p.id,
                  lat: p.latitude,
                  lng: p.longitude,
                  attentionLevel: p.detail.attentionLevel,
                  severity: p.severity as string | null,
                })),
                center: op?.mapContext.center ?? null,
              }}
            />
          )}
        </motion.div>

        {/* Civic AI Intelligence */}
        <motion.div
          variants={reduce ? undefined : fadeUp(20, 0.16)}
          initial={reduce ? undefined : 'hidden'}
          animate={reduce ? undefined : 'visible'}
        >
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80 h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-violet-500" />
                Civic AI Intelligence
              </CardTitle>
              {intel?.signalDirection && (
                <span
                  className={cn(
                    'text-[11px] font-medium inline-flex items-center gap-1',
                    intel.signalDirection === 'INCREASING' ? 'text-red-500' : intel.signalDirection === 'DECREASING' ? 'text-emerald-500' : 'text-neutral-400',
                  )}
                >
                  {intel.signalDirection === 'INCREASING' ? '▲' : intel.signalDirection === 'DECREASING' ? '▼' : '•'} Velocity
                </span>
              )}
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Current assessment */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Current Assessment</p>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  {intel?.assessment ?? '—'}
                </p>
              </div>

              {/* Recommended actions */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">Recommended Actions</p>
                {!data ? (
                  <LoadingBlock rows={2} />
                ) : intel && intel.recommendations.length > 0 ? (
                  <ol className="space-y-2">
                    {intel.recommendations.map((r, i) => (
                      <li key={r.id} className="flex gap-2.5">
                        <span
                          className={cn(
                            'flex-shrink-0 w-4 h-4 mt-0.5 rounded-full flex items-center justify-center text-[10px] font-bold text-white',
                            r.severity === 'high' ? 'bg-red-500' : r.severity === 'medium' ? 'bg-amber-500' : 'bg-emerald-500',
                          )}
                        >
                          {i + 1}
                        </span>
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-snug">{r.action}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-neutral-400">No immediate intervention is currently recommended.</p>
                )}
              </div>

              {/* Risk signal */}
              {intel?.riskSignal && (
                <div className="rounded-lg border border-violet-200/70 bg-violet-50/50 dark:border-violet-900/40 dark:bg-violet-900/10 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-violet-500" />
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">Risk Signal</p>
                  </div>
                  <p className="text-xs text-violet-700 dark:text-violet-300 leading-relaxed">{intel.riskSignal}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* ═══════════ SECTION 5 — OPERATIONAL ANALYTICS GRAPHS ═══════════ */}
      <OperationalCharts
        loading={isLoading}
        byDay={trend?.byDay}
        byCategory={trend?.byCategory}
      />

      {/* ═══════════ SECTION 6 — REQUIRES IMMEDIATE ATTENTION ═══════════ */}
      <motion.section
        variants={reduce ? undefined : fadeUp(20, 0.1)}
        initial={reduce ? undefined : 'hidden'}
        animate={reduce ? undefined : 'visible'}
      >
        <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                <Radar className="w-4 h-4 text-red-500" />
                Requires Immediate Attention
              </CardTitle>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Operational decisions requiring the administrator</p>
            </div>

            {/* Filter tabs */}
            <div className="flex flex-wrap gap-1.5">
              {ACTIVE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    filter === f.id
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-dark-bg dark:text-neutral-300 dark:hover:bg-dark-border',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent>
            {!data ? (
              <LoadingBlock rows={4} />
            ) : queue.length === 0 ? (
              <EmptyState
                icon={BadgeCheck}
                title="No critical incidents require immediate attention"
                description="Your current queue is clear. New alerts will surface here as they come in."
              />
            ) : filteredQueue.length === 0 ? (
              <EmptyState
                icon={Radar}
                title={`No ${filter} incidents`}
                description={`No incidents match the "${filter}" filter in the current queue.`}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[720px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 border-b border-neutral-100 dark:border-dark-border">
                      <th className="py-2.5 pr-3 font-semibold">Priority</th>
                      <th className="py-2.5 pr-3 font-semibold">Incident</th>
                      <th className="py-2.5 pr-3 font-semibold">Location</th>
                      <th className="py-2.5 pr-3 font-semibold">Department</th>
                      <th className="py-2.5 pr-3 font-semibold">Status</th>
                      <th className="py-2.5 pr-3 font-semibold">SLA</th>
                      <th className="py-2.5 pr-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-dark-border">
                    <AnimatePresence initial={false}>
                      {filteredQueue.slice(0, 8).map((item) => (
                        <motion.tr
                          key={item.id}
                          layout
                          initial={reduce ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={reduce ? undefined : { opacity: 0 }}
                          className="group hover:bg-neutral-50 dark:hover:bg-dark-bg transition-colors"
                        >
                          <td className="py-3 pr-3">
                            <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold rounded-full border px-2 py-0.5', priorityChip(item.attentionLevel).cls)}>
                              {item.attentionLevel === 'CRITICAL' && <TriangleAlert className="w-3 h-3" />}
                              {item.attentionLevel}
                            </span>
                          </td>
                          <td className="py-3 pr-3">
                            <button
                              type="button"
                              onClick={() => setSelectedId(item.id)}
                              className="block text-left group/link"
                              title="Focus on the incident map"
                            >
                              <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">{item.publicId}</span>
                              <span className="block text-sm text-neutral-800 dark:text-neutral-200 max-w-[220px] truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{item.title}</span>
                            </button>
                          </td>
                          <td className="py-3 pr-3">
                            <span className="text-sm text-neutral-600 dark:text-neutral-300">{item.location ?? item.ward ?? '—'}</span>
                          </td>
                          <td className="py-3 pr-3">
                            {item.assigned ? (
                              <span className="text-sm text-neutral-600 dark:text-neutral-300">{item.departmentName ?? '—'}</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500">
                                <TriangleAlert className="w-3 h-3" /> Unassigned
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-3">
                            <Badge variant="outline" size="sm">{item.statusLabel}</Badge>
                          </td>
                          <td className="py-3 pr-3">
                            {item.slaState === 'BREACHED' ? (
                              <span className="text-xs font-semibold text-red-500">Breached</span>
                            ) : item.slaState === 'AT_RISK' ? (
                              <span className="text-xs font-semibold text-amber-500">At risk</span>
                            ) : item.slaRemainingLabel ? (
                              <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">{item.slaRemainingLabel}</span>
                            ) : (
                              <span className="text-xs text-neutral-400">—</span>
                            )}
                          </td>
                          <td className="py-3 pr-3 text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/admin/issues`}>
                                {!item.assigned ? 'Assign' : 'Review'} <ChevronRight className="w-3.5 h-3.5" />
                              </Link>
                            </Button>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}

            {/* AI reasoning strip — compact, not every row */}
            {filteredQueue.length > 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-neutral-50 dark:bg-dark-bg border border-neutral-200/70 dark:border-dark-border px-3 py-2.5">
                <BrainCircuit className="w-3.5 h-3.5 text-violet-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {filteredQueue[0].reason}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.section>

      {/* ═══════════ SECTION 7 + 8 — DEPT RESPONSE + LIVE ACTIVITY ═══════════ */}
      <section className="grid lg:grid-cols-2 gap-6">
        {/* Department Response Status */}
        <motion.div
          variants={reduce ? undefined : fadeUp(20, 0.14)}
          initial={reduce ? undefined : 'hidden'}
          animate={reduce ? undefined : 'visible'}
        >
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80 h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand-500" />
                Department Response Status
              </CardTitle>
              <Link href="/admin/departments" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">Manage</Link>
            </CardHeader>
            <CardContent>
              {!data ? (
                <LoadingBlock rows={4} />
              ) : departments.length === 0 ? (
                <EmptyState icon={Building2} title="No departments configured" description="Departments will appear here once they are created." />
              ) : (
                <div className="space-y-4">
                  {departments.map((d) => {
                    const t = loadTone(d.loadLevel);
                    return (
                      <div key={d.id} className="flex items-center gap-4">
                        <div className="w-40 shrink-0">
                          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">{d.name}</p>
                          <p className="text-[11px] text-neutral-400 dark:text-neutral-500">{d.activeCases} active · {d.avgResponseLabel} avg</p>
                        </div>
                        <div className="flex-1">
                          <div className="h-2 rounded-full bg-neutral-100 dark:bg-dark-border overflow-hidden">
                            <div className={cn('h-full rounded-full transition-all duration-700', t.bar)} style={{ width: `${d.loadPct}%` }} />
                          </div>
                        </div>
                        <div className="w-20 text-right shrink-0">
                          <span className={cn('text-xs font-semibold', t.text)}>{t.label}</span>
                        </div>
                        <Link
                          href="/admin/health"
                          className="shrink-0 text-[11px] text-neutral-400 hover:text-brand-500 transition-colors"
                          aria-label={`Open ${d.name} details`}
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Live Command Activity */}
        <motion.div
          variants={reduce ? undefined : fadeUp(20, 0.2)}
          initial={reduce ? undefined : 'hidden'}
          animate={reduce ? undefined : 'visible'}
        >
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80 h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-500" />
                Live Command Activity
              </CardTitle>
              <span className="text-[11px] text-neutral-400 font-mono flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> streaming
              </span>
            </CardHeader>
            <CardContent>
              {!data ? (
                <LoadingBlock rows={4} />
              ) : activity.length === 0 ? (
                <EmptyState icon={Activity} title="No operational events" description="Command activity appears here as incidents are worked in real time." />
              ) : (
                <ol className="relative space-y-4 pl-0">
                  {activity.slice(0, 8).map((a, i) => (
                    <li key={a.id} className="relative flex gap-3">
                      <span className="flex flex-col items-center">
                        <span className={cn('w-2 h-2 rounded-full mt-1.5', a.kind === 'escalation' ? 'bg-red-500' : a.kind === 'assignment' ? 'bg-brand-500' : a.kind === 'ai' ? 'bg-violet-500' : a.kind === 'sla' ? 'bg-amber-500' : 'bg-neutral-300 dark:bg-neutral-600')} />
                        {i < Math.min(activity.length, 8) - 1 && <span className="w-px flex-1 bg-neutral-100 dark:bg-dark-border" />}
                      </span>
                      <div className="min-w-0 pb-1">
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-snug">
                          {a.issuePublicId && (
                            <span className="font-mono text-xs text-brand-600 dark:text-brand-400 mr-1.5">{a.issuePublicId}</span>
                          )}
                          {a.message}
                        </p>
                        <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5 font-mono">
                          {a.timeLabel}{a.actor ? ` · ${a.actor}` : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* ═══════════ SECTION 9 — SYSTEM STATUS SUMMARY ═══════════ */}
      <motion.section
        variants={reduce ? undefined : fadeUp(20, 0.1)}
        initial={reduce ? undefined : 'hidden'}
        animate={reduce ? undefined : 'visible'}
      >
        <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-emerald-500" />
              System Status
            </CardTitle>
            <Link href="/admin/health" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">View System Health</Link>
          </CardHeader>
          <CardContent>
            {!data ? (
              <LoadingBlock rows={2} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {system.map((s) => {
                  const ok = s.status === 'OPERATIONAL';
                  const warn = s.status === 'WARNING';
                  return (
                    <div
                      key={s.key}
                      className={cn(
                        'rounded-lg border px-3 py-2.5',
                        ok
                          ? 'border-neutral-200/80 bg-neutral-50/60 dark:border-dark-border dark:bg-dark-bg'
                          : warn
                            ? 'border-amber-200/80 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-900/10'
                            : 'border-red-200/80 bg-red-50/40 dark:border-red-900/40 dark:bg-red-900/10',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn('w-1.5 h-1.5 rounded-full', ok ? 'bg-emerald-500' : warn ? 'bg-amber-500' : 'bg-red-500')} />
                        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{s.label}</span>
                      </div>
                      <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1 ml-3.5">{s.detail}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.section>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  loading,
  active,
  critical,
  high,
  warning,
  onClick,
}: {
  label: string;
  value: number | string | undefined;
  loading: boolean;
  active?: boolean;
  critical?: boolean;
  high?: boolean;
  warning?: boolean;
  onClick?: () => void;
}) {
  const borderCls = critical
    ? 'border-l-[3px] border-l-red-500'
    : high
      ? 'border-l-[3px] border-l-amber-500'
      : warning
        ? 'border-l-[3px] border-l-amber-500'
        : 'border-l-[3px] border-l-brand-500';

  const valueCls = critical
    ? 'text-red-600 dark:text-red-400'
    : high || warning
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-brand-600 dark:text-brand-400';

  return (
    <motion.button
      variants={listItem(12)}
      onClick={onClick}
      className={cn(
        'text-left rounded-xl border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card px-4 py-3 transition-all duration-200',
        borderCls,
        active ? 'ring-2 ring-brand-500/60' : 'hover:bg-neutral-50 dark:hover:bg-dark-bg',
      )}
      aria-pressed={active}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">{label}</p>
      <p className={cn('font-display text-2xl font-bold mt-1', valueCls)}>
        {loading && value === undefined ? (
          <span className="inline-block w-6 h-6 animate-pulse rounded bg-neutral-200 dark:bg-dark-border" />
        ) : (
          value ?? '…'
        )}
      </p>
    </motion.button>
  );
}
