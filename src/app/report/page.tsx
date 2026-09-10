'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { CATEGORY_SELECT_OPTIONS, PRIORITY_LEVEL_LABELS } from '@/lib/issues/mapping';
import { cn } from '@/lib/utils';
import type { IssueDetail, DuplicateVerdictItem } from '@/lib/issues/types';
import { Upload, MapPin, CheckCircle2, ArrowRight, FileText, Loader2, X, Link2, Brain, GitMerge, ShieldAlert, AlertTriangle, Gauge, Users } from 'lucide-react';
import { LocationPicker, type PickedLocation } from '@/components/report/LocationPicker';
import { CivicImpactScore } from '@/components/dashboard/CivicImpactScore';

type Step = 'form' | 'submitting' | 'result';

const EMPTY_PICKED: PickedLocation = {
  location: '',
  latitude: null,
  longitude: null,
  ward: null,
  hasPin: false,
  geocoderAvailable: false,
};

export default function ReportPage() {
  const [step, setStep] = useState<Step>('form');
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    location: '',
    latitude: '',
    longitude: '',
    accuracy: '',
    description: '',
    contact: '',
    evidenceUrl: '',
  });
  const [picked, setPicked] = useState<PickedLocation>(EMPTY_PICKED);
  const [files, setFiles] = useState<File[]>([]);
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateVerdictItem>(null);
  const [error, setError] = useState<string | null>(null);
  // Synchronous double-submit guard: the windowed server check is the source
  // of truth, but we must never issue two identical requests from one click.
  const submittingRef = useRef(false);

  const resetForm = () => {
    setFormData({ title: '', category: '', location: '', latitude: '', longitude: '', accuracy: '', description: '', contact: '', evidenceUrl: '' });
    setPicked(EMPTY_PICKED);
    setFiles([]);
    setError(null);
    setIssue(null);
    setDuplicate(null);
    setStep('form');
  };

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const next = Array.from(list).slice(0, 10 - files.length);
    setFiles((prev) => [...prev, ...next]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setStep('submitting');

    const body = new FormData();
    body.set('title', formData.title.trim());
    body.set('category', formData.category);
    if (picked.location.trim()) body.set('location', picked.location.trim());
    if (picked.latitude != null) body.set('latitude', String(picked.latitude));
    if (picked.longitude != null) body.set('longitude', String(picked.longitude));
    if (formData.accuracy.trim()) body.set('accuracy', formData.accuracy.trim());
    if (formData.description.trim()) body.set('description', formData.description.trim());
    if (formData.contact.trim()) body.set('contact', formData.contact.trim());
    if (formData.evidenceUrl.trim()) body.append('evidenceUrl', formData.evidenceUrl.trim());
    files.forEach((file) => body.append('file', file));

    try {
      const res = await fetch('/api/issues', { method: 'POST', body });
      const data = (await res.json()) as
        | { issue: { id: string; publicId: string }; duplicate: DuplicateVerdictItem; analysisStatus: string | null }
        | { error?: { message: string } };

      if (!res.ok) {
        const message = 'error' in data && data.error ? data.error.message : 'The report could not be submitted.';
        throw new Error(message);
      }

      const created = data as { issue: { id: string; publicId: string }; duplicate: DuplicateVerdictItem; analysisStatus: string | null };
      setDuplicate(created.duplicate ?? null);

      // Persistence check: re-fetch the created report from the database.
      const detailRes = await fetch(`/api/issues/${created.issue.id}`);
      if (detailRes.ok) {
        const detail = (await detailRes.json()) as { issue: IssueDetail };
        setIssue(detail.issue);
      } else {
        setIssue(null);
      }

      pollsRef.current = 0;
      setStep('result');
    } catch (err) {
      submittingRef.current = false;
      setError(err instanceof Error ? err.message : 'Something went wrong while submitting your report.');
      setStep('form');
    }
  };

  // While the server-side AI pipeline is still running (PENDING/PROCESSING),
  // poll the persisted report so the result view converges on the real outcome.
  // Each read also self-heals the run via ensureReportIntelligence.
  const pollsRef = useRef(0);
  useEffect(() => {
    if (step !== 'result' || !issue?.id) return;
    const st = issue.aiAnalysis?.status ?? issue.analysisStatus;
    if (st === 'COMPLETED' || st === 'FAILED') return;
    let active = true;
    if (pollsRef.current >= 15) return;
    const timer = setInterval(async () => {
      pollsRef.current += 1;
      if (pollsRef.current > 15 || !active) {
        clearInterval(timer);
        return;
      }
      try {
        const res = await fetch(`/api/issues/${issue.id}`);
        if (!res.ok) return;
        const detail = (await res.json()) as { issue: IssueDetail };
        if (!active) return;
        setIssue(detail.issue);
      } catch {
        clearInterval(timer);
      }
    }, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [step, issue]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-12">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-neutral-900 dark:text-white mb-4">
              Report a Civic Issue
            </h1>
            <p className="text-lg text-neutral-600 dark:text-neutral-400 text-pretty">
              Help document a problem in your area. CivicChain records your report and evidence, routes it to the right department, and tracks it through the accountability workflow.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {step === 'form' && (
            <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardContent className="p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <Input
                    label="What happened?"
                    placeholder="Brief description of the issue"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />

                  <Select
                    label="Issue Category"
                    options={CATEGORY_SELECT_OPTIONS}
                    placeholder="Select category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                      Location
                    </label>
                    <LocationPicker
                      value={picked}
                      onChange={(next) => {
                        setPicked(next);
                      }}
                    />
                    <p className="mt-1 text-xs text-neutral-500">
                      Search for an address, click the map, or use your device&apos;s location. When available, the address is resolved and the ward detected server-side.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                      Upload Evidence
                    </label>
                    <label
                      htmlFor="report-evidence-input"
                      className="block border-2 border-dashed border-neutral-300 dark:border-dark-border rounded-xl p-8 text-center hover:border-brand-400 dark:hover:border-brand-600 transition-colors cursor-pointer"
                    >
                      <Upload className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                        Drag and drop photos or videos
                      </p>
                      <p className="text-xs text-neutral-500">
                        or click to browse • JPG, PNG, MP4 up to 10MB each • up to 10 files
                      </p>
                      <input
                        id="report-evidence-input"
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm"
                        className="hidden"
                        onChange={(e) => handleFiles(e.target.files)}
                      />
                    </label>
                    {files.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {files.map((file, index) => (
                          <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border text-sm">
                            <span className="truncate text-neutral-700 dark:text-neutral-300">
                              <FileText className="w-4 h-4 inline mr-2 text-brand-500" />
                              {file.name}
                              <span className="text-neutral-400 text-xs ml-1">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                            </span>
                            <button
                              type="button"
                              className="text-neutral-400 hover:text-red-500"
                              onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                              aria-label={`Remove ${file.name}`}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                      External Evidence URL (optional)
                    </label>
                    <Input
                      type="url"
                      placeholder="https://… (public photo or video link)"
                      leftIcon={<Link2 className="w-4 h-4" />}
                      value={formData.evidenceUrl}
                      onChange={(e) => setFormData({ ...formData, evidenceUrl: e.target.value })}
                    />
                  </div>

                  <Textarea
                    label="Describe the Issue"
                    placeholder="Provide details about the civic issue, when it started, how it affects the community..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                  />

                  <Input
                    label="Contact Information (Optional)"
                    placeholder="Email or phone for follow-up"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    helperText="Your contact info is kept confidential and only used for issue updates."
                  />

                  <Button type="submit" size="lg" fullWidth className="group">
                    <FileText className="w-5 h-5 mr-2" />
                    Submit Civic Report
                    <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {step === 'submitting' && (
            <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-6" />
                <h3 className="font-display text-xl font-semibold text-neutral-900 dark:text-white mb-2">
                  Recording your report…
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                  Saving your report and evidence to CivicChain
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-neutral-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Storing report • Evidence • Audit trail</span>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'result' && issue && (
            <div className="space-y-6">
              <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                <CardContent className="p-8">
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="font-display text-2xl font-bold text-neutral-900 dark:text-white mb-2">
                      Report Received
                    </h3>
                    <p className="text-neutral-600 dark:text-neutral-400">
                      Your civic issue has been recorded in the CivicChain database and is pending review.
                    </p>
                    <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800">
                      <span className="text-xs text-neutral-500">Issue ID:</span>
                      <span className="font-mono text-sm font-bold text-brand-600 dark:text-brand-400">{issue.publicId}</span>
                    </div>
                  </div>

                  {issue.civicImpact && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Gauge className="w-4 h-4 text-brand-500" />
                        <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
                          AI Civic Intelligence
                        </h4>
                      </div>
                      <CivicImpactScore impact={issue.civicImpact} />
                    </div>
                  )}

                  {duplicate && duplicate.band !== 'probably_new' && (
                    <div className={cn(
                      'mb-4 p-4 rounded-xl border flex items-start gap-3',
                      duplicate.band === 'strong'
                        ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
                        : 'border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-900/20'
                    )}>
                      <GitMerge className={cn('w-5 h-5 mt-0.5 flex-shrink-0', duplicate.band === 'strong' ? 'text-amber-500' : 'text-sky-500')} />
                      <div className="text-sm text-neutral-700 dark:text-neutral-300">
                        <p className="font-medium text-neutral-900 dark:text-white mb-1">
                          {duplicate.band === 'strong' ? 'A very similar report already exists' : 'A possibly similar report exists'}
                        </p>
                        <p>
                          <span className="font-mono font-semibold">#{duplicate.candidatePublicId}</span> was detected with{' '}
                          <span className="font-semibold">{Math.round(duplicate.confidence * 100)}%</span> match confidence
                          {duplicate.distanceMeters != null ? <> and is located ~{Math.round(duplicate.distanceMeters)} m away</> : null}.
                        </p>
                        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                          {duplicate.band === 'strong'
                            ? 'Your report has been grouped with the existing report so authorities see the full picture. You can still review it below — nothing is hidden or lost.'
                            : 'This is not a block. Review the existing report, or keep your submission as-is.'}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/dashboard/issues/${duplicate.candidateIssueId}`}>
                              View existing report
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={resetForm}>
                            My report is different
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-6 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
                    <h4 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-brand-500" />
                      Classification
                    </h4>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 rounded-lg bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                        <p className="text-xs text-neutral-500 mb-1">Category</p>
                        <p className="font-medium text-neutral-900 dark:text-white">{issue.categoryLabel}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                        <p className="text-xs text-neutral-500 mb-1">Priority</p>
                        <p className="font-medium text-neutral-900 dark:text-white">
                          {issue.priorityLevel
                            ? `${PRIORITY_LEVEL_LABELS[issue.priorityLevel as keyof typeof PRIORITY_LEVEL_LABELS] ?? issue.priorityLevel}`
                            : 'Pending (after analysis)'}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                        <p className="text-xs text-neutral-500 mb-1">Department</p>
                        <p className="font-medium text-neutral-900 dark:text-white">{issue.authority ?? 'To be assigned'}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                        <p className="text-xs text-neutral-500 mb-1">Evidence</p>
                        <p className="font-medium text-neutral-900 dark:text-white">
                          {issue.evidence.length > 0 ? `${issue.evidence.length} item(s) attached` : 'None attached'}
                        </p>
                      </div>
                    </div>

                    {issue.incident && (
                      <div className="mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                        <GitMerge className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        <p className="text-xs text-neutral-700 dark:text-neutral-300">
                          This report is part of incident{' '}
                          <span className="font-mono font-semibold">{issue.incident.publicId}</span> with{' '}
                          {issue.incident.memberCount} report(s) covering the same issue.
                        </p>
                      </div>
                    )}
                  </div>

                  {(() => {
                    const ai = issue.aiAnalysis;
                    if (ai?.status === 'COMPLETED') {
                      return (
                        <div className="mt-4 p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10 dark:border-emerald-800">
                          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4" /> AI Analysis Complete
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <p className="text-xs text-neutral-500 mb-0.5">Severity</p>
                              <p className="text-sm font-medium text-neutral-900 dark:text-white">{ai.severityLabel ?? '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-neutral-500 mb-0.5">Confidence</p>
                              <p className="text-sm font-medium text-neutral-900 dark:text-white">{ai.confidence != null ? `${Math.round(ai.confidence * 100)}%` : '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-neutral-500 mb-0.5">Safety risk</p>
                              <p className="text-sm font-medium text-neutral-900 dark:text-white">{ai.safetyRiskLabel ?? '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-neutral-500 mb-0.5">Infrastructure</p>
                              <p className="text-sm font-medium text-neutral-900 dark:text-white">{ai.infrastructureTypeLabel ?? '—'}</p>
                            </div>
                          </div>
                          {ai.reasoningSummary && (
                            <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap">{ai.reasoningSummary}</p>
                          )}
                        </div>
                      );
                    }
                    if (ai?.status === 'FAILED') {
                      return (
                        <div className="mt-4 p-4 rounded-xl border border-neutral-200 bg-white dark:bg-dark-bg-card dark:border-dark-border flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                          <div className="text-sm text-neutral-600 dark:text-neutral-400">
                            <p className="font-medium text-neutral-900 dark:text-white mb-1">AI analysis is currently unavailable for this report</p>
                            <p>
                              {ai.errorMessage || 'The analysis service did not respond.'} Your report stays visible and will be reviewed manually — no simulated scores are shown.
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="mt-4 p-4 rounded-xl border border-brand-200 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-800 flex items-start gap-3">
                        <Brain className="w-5 h-5 text-brand-500 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-neutral-600 dark:text-neutral-400">
                          <p className="font-medium text-neutral-900 dark:text-white mb-1 flex items-center gap-2">
                            Server-side AI analysis in progress
                            <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
                          </p>
                          <p>
                            Severity, safety risk and infrastructure classification are being computed. Your report is already recorded and safe — refresh or revisit the report to see the result.
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                  {issue.hasLocation && (
                    <div className="mt-4 p-4 rounded-xl border border-neutral-200 bg-white dark:bg-dark-bg-card dark:border-dark-border flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-brand-500 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-neutral-600 dark:text-neutral-400">
                        <p className="text-neutral-900 dark:text-white font-medium mb-1">Location recorded with GPS</p>
                        <p className="font-mono text-xs">{Number(issue.latitude).toFixed(6)}, {Number(issue.longitude).toFixed(6)}</p>
                        <p className="text-xs mt-1">
                          Accuracy{' '}
                          {issue.accuracy != null
                            ? `± ${Math.round(issue.accuracy)} meters`
                            : 'not provided'}
                          {issue.location ? ` • ${issue.location}` : ''}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button variant="secondary" size="lg" className="flex-1" asChild>
                  <Link href={`/dashboard/issues/${issue.id}`}>View Issue Details</Link>
                </Button>
                <Button size="lg" className="flex-1" asChild>
                  <Link href="/my-reports">Track My Reports</Link>
                </Button>
                <Button variant="ghost" size="lg" className="flex-1" onClick={resetForm}>
                  Report Another Issue
                </Button>
              </div>
            </div>
          )}
    </div>
  );
}