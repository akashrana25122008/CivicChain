'use client';

import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import { ShieldCheck, CheckCircle2, XCircle, Clock, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { ErrorState } from '@/components/dashboard/ErrorState';
import { cn } from '@/lib/utils';
import type { EvidenceQueueItem } from '@/lib/issues/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface VerificationQueue {
  items: EvidenceQueueItem[];
  counts: { needsReview: number; verified: number; rejected: number };
}

export default function DepartmentVerification() {
  const { data, error, isLoading, mutate } = useSWR<VerificationQueue>(
    '/api/department/verification',
    fetcher,
    { refreshInterval: 15000 },
  );

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [float, setFloat] = useState<string | null>(null);

  useEffect(() => {
    if (!float) return;
    const t = setTimeout(() => setFloat(null), 3000);
    return () => clearTimeout(t);
  }, [float]);

  const decide = useCallback(
    async (evidenceId: string, decision: 'VERIFIED' | 'REJECTED') => {
      if (busy) return;
      setBusy(evidenceId);
      try {
        const res = await fetch('/api/department/verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ evidenceId, status: decision, note: notes[evidenceId] ?? null }),
        });
        if (!res.ok) throw new Error();
        await mutate();
        setNotes((n) => ({ ...n, [evidenceId]: '' }));
        setFloat(decision === 'VERIFIED' ? 'Evidence verified' : 'Evidence rejected');
      } catch {
        setFloat('Verification could not be saved');
      } finally {
        setBusy(null);
      }
    },
    [busy, notes, mutate],
  );

  const counts = data?.counts;
  const pending = data?.items.filter((i) => i.verification?.status !== 'VERIFIED') ?? [];

  return (
    <div className="space-y-6">
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div>
        <div className="inline-flex items-center gap-2 mb-2">
          <span className="w-1.5 h-4 rounded-full bg-teal-500" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-600 dark:text-teal-400">
            Department Operations
          </span>
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white">
          Evidence Verification
        </h1>
        <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
          Review evidence submitted against your department&apos;s reports. Every decision is written to the permanent audit trail and notifies the reporter.
        </p>
      </div>

      {/* ── SUMMARY PILLS ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <SummaryPill icon={Clock} label="Needs review" value={counts?.needsReview ?? '…'} tone="amber" />
        <SummaryPill icon={CheckCircle2} label="Verified" value={counts?.verified ?? '…'} tone="emerald" />
        <SummaryPill icon={XCircle} label="Rejected" value={counts?.rejected ?? '…'} tone="red" />
      </div>

      {error && <ErrorState onRetry={() => mutate()} />}

      {/* ── QUEUE ────────────────────────────────────────────────── */}
      <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle as="h2" className="text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Evidence Queue
          </CardTitle>
          <span className="text-xs text-neutral-500">{pending.length} awaiting review</span>
        </CardHeader>
        <CardContent>
          {isLoading && !data ? (
            <LoadingBlock rows={4} />
          ) : (data?.items.length ?? 0) === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="Queue empty"
              description="Evidence attached to your department's reports lands here for review."
            />
          ) : (
            <div className="space-y-3">
              {data?.items.map((item) => {
                const done = item.verification?.status === 'VERIFIED' || item.verification?.status === 'REJECTED';
                const needs = item.verification?.status !== 'VERIFIED';
                return (
                  <div key={item.id} className={cn(
                    'p-4 rounded-xl border bg-neutral-50 dark:bg-dark-bg',
                    done ? 'border-neutral-200 dark:border-dark-border' : 'border-teal-300 dark:border-teal-800',
                  )}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">{item.issuePublicId}</span>
                          <Badge variant="status" status={item.issueStatus} size="sm" />
                          {item.verification?.status === 'VERIFIED' && <Badge variant="status" status="resolved" size="sm">Verified</Badge>}
                          {item.verification?.status === 'REJECTED' && <Badge variant="status" status="rejected" size="sm">Rejected</Badge>}
                        </div>
                        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mt-1">{item.issueTitle}</p>
                        <p className="text-xs text-neutral-500 mt-1 font-mono truncate">{item.fileName || item.url}</p>
                        {item.verification?.note && (
                          <p className="text-xs text-neutral-500 mt-1">Note: {item.verification.note}</p>
                        )}
                      </div>
                      <div className="py-1 flex items-center gap-2 flex-shrink-0">
                        <Button variant="outline" size="sm" asChild>
                          <a href={item.url} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" /></a>
                        </Button>
                      </div>
                    </div>

                    {needs && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          value={notes[item.id] ?? ''}
                          onChange={(e) => setNotes((n) => ({ ...n, [item.id]: e.target.value }))}
                          placeholder="Verification note (optional)"
                          className="flex-1 min-w-44 rounded-lg border border-neutral-300 dark:border-dark-border bg-white dark:bg-dark-bg-card px-2.5 py-1.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                          aria-label="Verification note"
                        />
                        <Button size="sm" variant="outline" className="border-emerald-500 text-emerald-600 dark:text-emerald-400" loading={busy === item.id} onClick={() => decide(item.id, 'VERIFIED')}>
                          <CheckCircle2 className="w-4 h-4" /> Verify
                        </Button>
                        <Button size="sm" variant="outline" className="border-red-500 text-red-600 dark:text-red-400" loading={busy === item.id} onClick={() => decide(item.id, 'REJECTED')}>
                          <XCircle className="w-4 h-4" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── FLOAT ────────────────────────────────────────────────── */}
      {float && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-teal-900 text-white dark:bg-dark-bg-card dark:text-neutral-100 border border-teal-200 dark:border-dark-border text-sm shadow-lg z-50">
          {float}
        </div>
      )}
    </div>
  );
}

function SummaryPill({ icon, label, value, tone }: { icon: typeof Clock; label: string; value: string | number; tone: 'amber' | 'emerald' | 'red' }) {
  const Icon = icon;
  const tones = {
    amber: 'text-amber-600 dark:text-amber-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-red-600 dark:text-red-400',
  };
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card px-4 py-2.5">
      <Icon className={cn('w-4 h-4', tones[tone])} aria-hidden="true" />
      <span className="text-2xl font-display font-bold text-neutral-900 dark:text-white">{value}</span>
      <span className="text-xs text-neutral-500">{label}</span>
    </div>
  );
}
