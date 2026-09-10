'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {
  ArrowLeft,
  Award,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  Gauge,
  Image as ImageIcon,
  MapPin,
  MessageSquare,
  Upload,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { ErrorState } from '@/components/dashboard/ErrorState';
import { CivicImpactScore } from '@/components/dashboard/CivicImpactScore';
import { TamperEvidentLedger } from '@/components/ledger/TamperEvidentLedger';
import { cn } from '@/lib/utils';
import type { IssueDetail } from '@/lib/issues/types';

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
});

/**
 * ResolutionWorkbenchView — the Step 7 "before / after evidence" resolution
 * flow. An assigned officer reviews the reporter's original ("before")
 * evidence, attaches their own "after" evidence showing the fix, writes a
 * resolution note, and submits the resolution. The issue then moves to RESOLVED
 * and the citizen is asked to confirm (Step 8). All evidence is real, uploaded
 * files — nothing is fabricated for the demo.
 */
export function ResolutionWorkbenchView({ id }: { id: string }) {
  const { data, error, isLoading, mutate } = useSWR<{ issue: IssueDetail }>(
    `/api/department/issues/${id}`,
    fetcher,
  );
  const detail = data?.issue ?? null;

  const [afterFiles, setAfterFiles] = useState<File[]>([]);
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [float, setFloat] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!float) return;
    const t = setTimeout(() => setFloat(null), 3200);
    return () => clearTimeout(t);
  }, [float]);

  const state = detail?.status ?? null;
  const isInProgress = state === 'IN_PROGRESS';
  const isResolved = state === 'RESOLVED';

  const addFiles = useCallback((list: FileList | null) => {
    if (!list) return;
    const next = Array.from(list).slice(0, 10);
    setAfterFiles((prev) => {
      const merged = [...prev, ...next].slice(0, 10);
      return merged;
    });
  }, []);

  const removeFile = useCallback((name: string, size: number) => {
    setAfterFiles((prev) => prev.filter((f) => !(f.name === name && f.size === size)));
  }, []);

  const submit = async () => {
    if (!detail || submitting) return;
    setSubmitting(true);
    try {
      // 1. Attach "after" evidence (real upload, sanitized server-side).
      if (afterFiles.length > 0) {
        const form = new FormData();
        for (const f of afterFiles) form.append('file', f);
        const ev = await fetch(`/api/issues/${detail.id}/evidence`, { method: 'POST', body: form });
        if (!ev.ok) throw new Error('evidence');
      }
      // 2. Mark the issue resolved (staff-only domain action).
      const res = await fetch(`/api/issues/${detail.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() || null }),
      });
      if (!res.ok) throw new Error('resolve');
      await mutate();
      setAfterFiles([]);
      setNote('');
      setFloat('Resolution submitted — the citizen can now confirm the fix.');
    } catch (err) {
      setFloat(err instanceof Error && err.message === 'evidence' ? 'Evidence upload failed' : 'Resolution could not be submitted');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="w-1.5 h-4 rounded-full bg-teal-500" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-600 dark:text-teal-400">
              Department Operations · Step 7
            </span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Resolution Workbench
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
            Attach after-evidence proving the fix, add a resolution note, and close the loop — the citizen
            is then asked to confirm the report is actually resolved.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/department/command-center">
            <ArrowLeft className="w-4 h-4 mr-1" /> Command Center
          </Link>
        </Button>
      </div>

      {error && (
        <ErrorState
          message="This report may no longer be assigned to your department."
          onRetry={() => mutate()}
        />
      )}

      {isLoading && !detail && <LoadingBlock rows={5} />}

      {detail && (
        <>
          {/* Status banner */}
          {isResolved && (
            <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/15 px-4 py-3 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  This report is already resolved
                </p>
                <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70">
                  The citizen can now verify the fix on their side. View the audited trail below.
                </p>
              </div>
            </div>
          )}
          {!isResolved && !isInProgress && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/15 px-4 py-3 flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Resolution can only be submitted while a report is <span className="font-semibold">IN PROGRESS</span>.
                Move it forward from the Command Center or the Workbench drawer first.
              </p>
            </div>
          )}

          {/* Report context */}
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">{detail.publicId}</span>
                <Badge variant="status" status={detail.displayStatus} size="sm" />
                <Badge variant="default" size="sm">{detail.categoryLabel}</Badge>
                {detail.severityLabel && <Badge variant="outline" size="sm">{detail.severityLabel}</Badge>}
              </div>
              <h2 className="font-display text-2xl font-bold text-neutral-900 dark:text-white mt-2">{detail.title}</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 mt-4 text-sm">
                <div>
                  <p className="text-xs text-neutral-500">Location</p>
                  <p className="font-medium text-neutral-800 dark:text-neutral-200 mt-0.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400" /> {detail.location || 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Authority</p>
                  <p className="font-medium text-neutral-800 dark:text-neutral-200 mt-0.5">{detail.authority ?? 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Reporter</p>
                  <p className="font-medium text-neutral-800 dark:text-neutral-200 mt-0.5">{detail.reporterName ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Reported</p>
                  <p className="font-medium text-neutral-800 dark:text-neutral-200 mt-0.5">{detail.timeLabel}</p>
                </div>
              </div>
              {detail.description && (
                <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap">{detail.description}</p>
              )}
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* ── LEFT (2 cols): evidence + resolution actions ─── */}
            <div className="lg:col-span-2 space-y-6">
              {/* Before evidence */}
              <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                <CardHeader>
                  <CardTitle as="h2" className="text-sm flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-neutral-400" /> Before · the reporter&apos;s evidence
                    {detail.evidence.length > 0 && <span className="text-neutral-400 font-normal">({detail.evidence.length})</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {detail.evidence.length === 0 ? (
                    <p className="text-sm text-neutral-500 py-4 text-center">No evidence was attached to this report.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {detail.evidence.map((ev) => (
                        <div key={ev.id} className="rounded-xl overflow-hidden border border-neutral-200 dark:border-dark-border bg-neutral-50 dark:bg-dark-bg">
                          {ev.mimeType?.startsWith('image/') ? (
                            <div className="aspect-square bg-neutral-100 dark:bg-dark-border">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={ev.url} alt={ev.fileName ?? 'Evidence'} className="w-full h-full object-cover" width={320} height={320} />
                            </div>
                          ) : (
                            <div className="aspect-square flex items-center justify-center bg-neutral-100 dark:bg-dark-border">
                              <FileText className="w-8 h-8 text-neutral-400" />
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-2 px-3 py-2">
                            <span className="text-[11px] text-neutral-500 truncate">{ev.fileName ?? 'Evidence'}</span>
                            <Badge
                              variant="status"
                              status={ev.verification?.status === 'VERIFIED' ? 'resolved' : ev.verification?.status === 'REJECTED' ? 'rejected' : 'verificationPending'}
                              size="sm"
                            >
                              {ev.verification ? ev.verification.status.toLowerCase() : 'pending'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* After evidence + resolution actions */}
              {isInProgress && (
                <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                  <CardHeader>
                    <CardTitle as="h2" className="text-sm flex items-center gap-2">
                      <Camera className="w-4 h-4 text-teal-600 dark:text-teal-400" /> After · resolution evidence
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Upload zone */}
                    <div
                      className="rounded-xl border-2 border-dashed border-neutral-300 dark:border-dark-border px-4 py-6 text-center bg-neutral-50/60 dark:bg-dark-bg"
                      role="button"
                      tabIndex={0}
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        className="sr-only"
                        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
                        aria-label="Upload after-evidence files"
                      />
                      <Upload className="w-6 h-6 text-neutral-400 mx-auto" />
                      <p className="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        Upload photo proof the problem is fixed
                      </p>
                      <p className="mt-0.5 text-[11px] text-neutral-400">
                        Images or short videos · stored privately · sanitized & verified
                      </p>
                      {afterFiles.length > 0 && (
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 text-left">
                          {afterFiles.map((f) => (
                            <div key={`${f.name}:${f.size}`} className="rounded-lg border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card px-3 py-2 flex items-center gap-2">
                              <ImageIcon className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                              <span className="text-[11px] text-neutral-600 dark:text-neutral-300 truncate flex-1">{f.name}</span>
                              <button
                                type="button"
                                onClick={() => removeFile(f.name, f.size)}
                                className="text-neutral-400 hover:text-red-500 text-sm px-1"
                                aria-label={`Remove ${f.name}`}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Resolution note */}
                    <div className="flex items-start gap-3">
                      <MessageSquare className="w-4 h-4 text-neutral-400 mt-2 flex-shrink-0" />
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        placeholder="Resolution note — what was done to fix this (e.g. field team cleared the blockage at Avenue 12 on 4 Sept)."
                        className="flex-1 rounded-lg border border-neutral-300 dark:border-dark-border bg-white dark:bg-dark-bg-card px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        aria-label="Resolution note"
                      />
                    </div>

                    {/* Submit */}
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <p className="text-[11px] text-neutral-400">
                        Submitting writes <span className="font-mono">RESOLUTION_ADDED</span> to the issue&apos;s audit ledger and asks the citizen to confirm.
                      </p>
                      <Button loading={submitting} onClick={submit} disabled={afterFiles.length === 0 && !note.trim()}>
                        {submitting ? null : <Award className="w-4 h-4 mr-1" />}
                        Submit resolution
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* ── RIGHT (1 col): score + ledger ─────────────────── */}
            <div className="space-y-6">
              {detail.civicImpact && (
                <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                  <CardHeader>
                    <CardTitle as="h2" className="text-sm flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-brand-500" /> Predicted Civic Impact
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CivicImpactScore impact={detail.civicImpact} />
                  </CardContent>
                </Card>
              )}

              <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                <CardHeader>
                  <CardTitle as="h2" className="text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-neutral-400" /> Tamper-Evident Audit Ledger
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TamperEvidentLedger chain={detail.auditChain ?? []} />
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {float && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-teal-900 text-white dark:bg-dark-bg-card dark:text-neutral-100 border border-teal-200 dark:border-dark-border text-sm shadow-lg z-50 whitespace-nowrap">
          {float}
        </div>
      )}
    </div>
  );
}