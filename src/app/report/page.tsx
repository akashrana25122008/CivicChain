'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { Navigation } from '@/components/layout/Navigation';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { CATEGORY_SELECT_OPTIONS } from '@/lib/issues/mapping';
import type { IssueDetail } from '@/lib/issues/types';
import {
  Upload,
  MapPin,
  CheckCircle2,
  ArrowRight,
  FileText,
  Loader2,
  X,
  Link2,
  LocateFixed,
  Crosshair,
  Brain,
} from 'lucide-react';

type Step = 'form' | 'submitting' | 'result';

type GpsState = { phase: 'idle' | 'locating' | 'done' | 'error'; error?: string };

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
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [gps, setGps] = useState<GpsState>({ phase: 'idle' });
  // Synchronous double-submit guard: the windowed server check is the source
  // of truth, but we must never issue two identical requests from one click.
  const submittingRef = useRef(false);

  const resetForm = () => {
    setFormData({ title: '', category: '', location: '', latitude: '', longitude: '', accuracy: '', description: '', contact: '', evidenceUrl: '' });
    setFiles([]);
    setError(null);
    setIssue(null);
    setGps({ phase: 'idle' });
  };

  const handleUseMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setGps({ phase: 'error', error: 'Geolocation is not available in this browser.' });
      return;
    }
    setGps({ phase: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
          accuracy: String(Math.round(position.coords.accuracy)),
        }));
        setGps({ phase: 'done' });
      },
      (err) => {
        setGps({
          phase: 'error',
          error:
            err.code === err.PERMISSION_DENIED
              ? 'Location permission was denied — you can still enter coordinates or an address manually.'
              : 'Could not read your location. Please enter coordinates manually.',
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
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
    if (formData.location.trim()) body.set('location', formData.location.trim());
    if (formData.latitude.trim()) body.set('latitude', formData.latitude.trim());
    if (formData.longitude.trim()) body.set('longitude', formData.longitude.trim());
    if (formData.accuracy.trim()) body.set('accuracy', formData.accuracy.trim());
    if (formData.description.trim()) body.set('description', formData.description.trim());
    if (formData.contact.trim()) body.set('contact', formData.contact.trim());
    if (formData.evidenceUrl.trim()) body.append('evidenceUrl', formData.evidenceUrl.trim());
    files.forEach((file) => body.append('file', file));

    try {
      const res = await fetch('/api/reports', { method: 'POST', body });
      const data = (await res.json()) as
        | { issue: { id: string; publicId: string } }
        | { error?: { message: string } };

      if (!res.ok) {
        const message = 'error' in data && data.error ? data.error.message : 'The report could not be submitted.';
        throw new Error(message);
      }

      // Persistence check: re-fetch the created report from the database.
      const detailRes = await fetch(`/api/reports/${(data as { issue: { id: string } }).issue.id}`);
      if (detailRes.ok) {
        const detail = (await detailRes.json()) as { issue: IssueDetail };
        setIssue(detail.issue);
      } else {
        setIssue(null);
      }

      setStep('result');
    } catch (err) {
      submittingRef.current = false;
      setError(err instanceof Error ? err.message : 'Something went wrong while submitting your report.');
      setStep('form');
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg">
      <Navigation />

      <div className="pt-20 md:pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4 md:px-6 lg:px-8">
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

                  <Input
                    label="Location"
                    placeholder="Address, landmark, or GPS coordinates"
                    leftIcon={<MapPin className="w-4 h-4" />}
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        Location Coordinates
                      </label>
                      <button
                        type="button"
                        onClick={handleUseMyLocation}
                        disabled={gps.phase === 'locating'}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 disabled:opacity-60"
                      >
                        {gps.phase === 'locating' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <LocateFixed className="w-3.5 h-3.5" />
                        )}
                        {gps.phase === 'locating' ? 'Reading your location…' : 'Use My Location'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Latitude (optional)"
                        type="number"
                        step="any"
                        placeholder="e.g. 21.1702"
                        value={formData.latitude}
                        onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                      />
                      <Input
                        label="Longitude (optional)"
                        type="number"
                        step="any"
                        placeholder="e.g. 72.8311"
                        value={formData.longitude}
                        onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                      />
                    </div>
                    {gps.phase === 'done' && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                        <Crosshair className="w-3.5 h-3.5" />
                        Location captured by GPS
                        {formData.accuracy ? ` ±${formData.accuracy} m` : ''}
                      </p>
                    )}
                    {gps.phase === 'error' && (
                      <p className="mt-2 text-xs text-neutral-500">{gps.error}</p>
                    )}
                    <p className="mt-1 text-xs text-neutral-500">
                      For report accuracy the device&apos;s GPS fix (lat, lng, and ± meters error) is stored with the report when captured.
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

                  <div className="p-6 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
                    <h4 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-brand-500" />
                      Classification
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                        <p className="text-xs text-neutral-500 mb-1">Category</p>
                        <p className="font-medium text-neutral-900 dark:text-white">{issue.categoryLabel}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                        <p className="text-xs text-neutral-500 mb-1">Status</p>
                        <p className="font-medium text-emerald-600 dark:text-emerald-400">{issue.statusLabel}</p>
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
                  </div>

                  <div className="mt-4 p-4 rounded-xl border border-neutral-200 bg-white dark:bg-dark-bg-card dark:border-dark-border flex items-start gap-3">
                    <Brain className="w-5 h-5 text-neutral-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      Report creation, evidence validation and the accountability workflow are live. Server-side AI analysis — severity, cross-report duplicate detection and verification — is planned for a later phase and was deliberately not simulated.
                    </p>
                  </div>
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
      </div>
    </div>
  );
}