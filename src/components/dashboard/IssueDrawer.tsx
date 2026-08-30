'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import {
  X,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { IssueDetail } from '@/lib/issues/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

interface IssueDrawerProps {
  issueId: string | null;
  /** Detail endpoint; when null the drawer stays closed. */
  endpoint: string | null;
  onClose: () => void;
  onChanged?: () => void;
  canUpdateStatus?: boolean;
  canVerify?: boolean;
  canEscalate?: boolean;
}

export function IssueDrawer({
  issueId,
  endpoint,
  onClose,
  onChanged,
  canUpdateStatus = false,
  canVerify = false,
  canEscalate = false,
}: IssueDrawerProps) {
  const open = Boolean(issueId && endpoint);
  const { data, error, isLoading, mutate } = useSWR<{ issue: IssueDetail }>(
    open ? endpoint : null,
    fetcher,
  );
  const detail = data?.issue ?? null;

  const [status, setStatus] = useState<string>('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingEvidence, setSavingEvidence] = useState<string | null>(null);
  const [escalating, setEscalating] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [savingEscalation, setSavingEscalation] = useState(false);
  const [float, setFloat] = useState<string | null>(null);

  // The status state holds the selected NEXT transition (or '' when none chosen).
  const transitions = detail?.allowedTransitions ?? [];

  useEffect(() => {
    if (!float) return;
    const t = setTimeout(() => setFloat(null), 3000);
    return () => clearTimeout(t);
  }, [float]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const applyStatus = async () => {
    if (
      !detail ||
      status === '' ||
      !transitions.includes(status) ||
      status === detail.status ||
      savingStatus
    ) {
      return;
    }
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/issues/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      await mutate();
      onChanged?.();
      setFloat('Status updated');
    } catch {
      setFloat('Status update failed');
    } finally {
      setSavingStatus(false);
    }
  };

  const decide = async (evidenceId: string, decision: 'VERIFIED' | 'REJECTED') => {
    if (savingEvidence) return;
    setSavingEvidence(evidenceId);
    try {
      const res = await fetch('/api/department/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidenceId, status: decision, note: notes[evidenceId] ?? null }),
      });
      if (!res.ok) throw new Error();
      await mutate();
      onChanged?.();
      setFloat(decision === 'VERIFIED' ? 'Evidence verified' : 'Evidence rejected');
      setNotes((n) => ({ ...n, [evidenceId]: '' }));
    } catch {
      setFloat('Verification could not be saved');
    } finally {
      setSavingEvidence(null);
    }
  };

  const escalate = async () => {
    if (!detail || savingEscalation) return;
    setSavingEscalation(true);
    try {
      const res = await fetch('/api/department/escalations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId: detail.id, reason: escalateReason }),
      });
      if (!res.ok) throw new Error();
      setEscalating(false);
      setEscalateReason('');
      onChanged?.();
      setFloat('Escalation raised');
    } catch {
      setFloat('Escalation could not be raised');
    } finally {
      setSavingEscalation(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Report ${detail?.publicId ?? ''}`}>
      <div className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-y-0 right-0 w-full max-w-xl bg-white dark:bg-dark-bg shadow-2xl flex flex-col">
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-neutral-200 dark:border-dark-border">
          <div className="min-w-0">
            <p className="font-mono text-xs text-neutral-500">{detail?.publicId ?? 'Loading…'}</p>
            <h2 className="font-display text-lg font-semibold text-neutral-900 dark:text-white truncate">
              {detail?.title ?? 'Loading report…'}
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {isLoading && !detail && (
            <div className="space-y-4" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-neutral-100 dark:bg-dark-border animate-pulse" />
              ))}
            </div>
          )}
          {error && !detail && (
            <p className="text-sm text-red-600 dark:text-red-400 py-8 text-center">
              Could not load this report. It may have been removed.
            </p>
          )}

          {detail && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="status" status={detail.displayStatus} />
                <Badge variant="default" size="sm">{detail.categoryLabel}</Badge>
                {detail.severityLabel && <Badge variant="outline" size="sm">{detail.severityLabel}</Badge>}
                {detail.priority != null && <Badge variant="priority" priority={detail.priority} size="sm" />}
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <p className="text-xs text-neutral-500">Location</p>
                  <p className="font-medium text-neutral-800 dark:text-neutral-200 mt-0.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                    {detail.location || 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Department</p>
                  <p className="font-medium text-neutral-800 dark:text-neutral-200 mt-0.5">{detail.authority ?? 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Reported</p>
                  <p className="font-medium text-neutral-800 dark:text-neutral-200 mt-0.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-neutral-400" />
                    {formatRelativeTime(detail.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Reporter</p>
                  <p className="font-medium text-neutral-800 dark:text-neutral-200 mt-0.5">
                    {detail.reporterName ?? (detail.byCurrentUser ? 'You' : '—')}
                  </p>
                </div>
              </div>

              {canUpdateStatus && transitions.length > 0 && (
                <Card variant="outlined" padding="sm" className="bg-neutral-50/60 dark:bg-dark-bg/40">
                  <CardContent>
                    <p className="text-sm font-medium mb-2 text-neutral-800 dark:text-neutral-200">
                      Move to next stage
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="flex-1 min-w-40 rounded-lg border border-neutral-300 dark:border-dark-border bg-white dark:bg-dark-bg-card px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                        aria-label="Next lifecycle status"
                      >
                        <option value="">Choose a transition…</option>
                        {transitions.map((s) => (
                          <option key={s} value={s}>{statusLabel(s)}</option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        loading={savingStatus}
                        onClick={applyStatus}
                        disabled={status === '' || !transitions.includes(status) || status === detail.status}
                      >
                        Apply
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Description</h3>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                  {detail.description || 'No description provided.'}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">
                  Evidence {detail.evidence.length > 0 && `· ${detail.evidence.length}`}
                </h3>
                <div className="space-y-3">
                  {detail.evidence.length === 0 && (
                    <p className="text-sm text-neutral-500">No evidence attached.</p>
                  )}
                  {detail.evidence.map((ev) => (
                    <div key={ev.id} className="p-3 rounded-xl border border-neutral-200 dark:border-dark-border bg-neutral-50 dark:bg-dark-bg">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-mono text-neutral-500 truncate">{ev.fileName || ev.url}</p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <VerificationBadge status={ev.verification?.status ?? null} />
                            {ev.verification?.verifierName && (
                              <span className="text-[11px] text-neutral-400">by {ev.verification.verifierName}</span>
                            )}
                          </div>
                        </div>
                        {ev.verification?.note && (
                          <p className="text-[11px] text-neutral-500 max-w-40 text-right">{ev.verification.note}</p>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <a href={ev.url} target="_blank" rel="noreferrer">Open file</a>
                        </Button>
                        {canVerify && ev.verification?.status !== 'VERIFIED' && (
                          <>
                            <input
                              value={notes[ev.id] ?? ''}
                              onChange={(e) => setNotes((n) => ({ ...n, [ev.id]: e.target.value }))}
                              placeholder="Verification note (optional)"
                              className="flex-1 min-w-36 rounded-lg border border-neutral-300 dark:border-dark-border bg-white dark:bg-dark-bg-card px-2.5 py-1.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                              aria-label="Verification note"
                            />
                            <Button size="sm" variant="outline" className="border-emerald-500 text-emerald-600 dark:text-emerald-400" loading={savingEvidence === ev.id} onClick={() => decide(ev.id, 'VERIFIED')}>
                              <CheckCircle2 className="w-4 h-4" /> Verify
                            </Button>
                            <Button size="sm" variant="outline" className="border-red-500 text-red-600 dark:text-red-400" loading={savingEvidence === ev.id} onClick={() => decide(ev.id, 'REJECTED')}>
                              <XCircle className="w-4 h-4" /> Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {canEscalate && (
                <Card variant="outlined" padding="sm" className="bg-red-50/40 dark:bg-dark-bg/40 border-red-200 dark:border-red-900/40">
                  <CardContent>
                    {!escalating ? (
                      <Button variant="outline" className="border-red-500 text-red-600 dark:text-red-400" onClick={() => setEscalating(true)}>
                        <AlertTriangle className="w-4 h-4" /> Escalate this report
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Escalation reason</p>
                        <textarea
                          value={escalateReason}
                          onChange={(e) => setEscalateReason(e.target.value)}
                          rows={2}
                          className="w-full rounded-lg border border-neutral-300 dark:border-dark-border bg-white dark:bg-dark-bg-card px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                          placeholder="Why does this need to go up a level?"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" loading={savingEscalation} onClick={escalate} disabled={!escalateReason.trim()}>
                            Raise escalation
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setEscalating(false)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">Timeline</h3>
                {detail.timeline.length === 0 ? (
                  <p className="text-sm text-neutral-500">No activity recorded yet.</p>
                ) : (
                  <ol className="space-y-0">
                    {detail.timeline.map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className={cn(
                            'w-2.5 h-2.5 rounded-full mt-1.5',
                            step.state === 'current'
                              ? 'bg-brand-600 dark:bg-brand-400'
                              : 'bg-neutral-300 dark:bg-neutral-600',
                          )} />
                          {i < detail.timeline.length - 1 && <span className="w-px flex-1 bg-neutral-200 dark:bg-dark-border" />}
                        </div>
                        <div className="pb-5">
                          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{step.label}</p>
                          <p className="text-xs text-neutral-500">{step.date}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </>
          )}
        </div>

        {float && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-dark-bg-card dark:text-neutral-100 border border-neutral-200 dark:border-dark-border text-sm shadow-lg">
            {float}
          </div>
        )}
      </div>
    </div>
  );
}

function VerificationBadge({ status }: { status: string | null }) {
  if (status === 'VERIFIED') {
    return <Badge variant="status" status="resolved" size="sm">Verified</Badge>;
  }
  if (status === 'REJECTED') {
    return <Badge variant="status" status="rejected" size="sm">Rejected</Badge>;
  }
  return <Badge variant="status" status="verificationPending" size="sm">Pending review</Badge>;
}