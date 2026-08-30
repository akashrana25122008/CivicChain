'use client';

import { useState } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import {
  Upload,
  MapPin,
  Brain,
  CheckCircle2,
  ArrowRight,
  FileText,
  Loader2,
} from 'lucide-react';

const CATEGORIES = [
  { value: 'pothole', label: 'Road Pothole' },
  { value: 'drainage', label: 'Drain Blockage' },
  { value: 'streetlight', label: 'Streetlight Failure' },
  { value: 'garbage', label: 'Garbage Accumulation' },
  { value: 'infrastructure', label: 'Infrastructure Damage' },
  { value: 'water', label: 'Water Supply Issue' },
  { value: 'other', label: 'Other Civic Issue' },
];

type Step = 'form' | 'analyzing' | 'result';

interface AIResult {
  category: string;
  confidence: number;
  severity: string;
  department: string;
  priority: number;
}

export default function ReportPage() {
  const [step, setStep] = useState<Step>('form');
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    location: '',
    description: '',
    contact: '',
  });
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [issueId, setIssueId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep('analyzing');

    // Simulate AI analysis
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const mockResult: AIResult = {
      category: 'Road Pothole',
      confidence: 94,
      severity: 'High',
      department: 'Roads & Infrastructure',
      priority: 92,
    };

    setAiResult(mockResult);
    setIssueId('CC-1128');
    setStep('result');
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
              Help document a problem in your area. CivicChain will organize the evidence and route the issue through the accountability workflow.
            </p>
          </div>

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
                    options={CATEGORIES}
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
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                      Upload Evidence
                    </label>
                    <div className="border-2 border-dashed border-neutral-300 dark:border-dark-border rounded-xl p-8 text-center hover:border-brand-400 dark:hover:border-brand-600 transition-colors cursor-pointer">
                      <Upload className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                        Drag and drop photos or videos
                      </p>
                      <p className="text-xs text-neutral-500">
                        or click to browse • JPG, PNG, MP4 up to 10MB
                      </p>
                    </div>
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

          {step === 'analyzing' && (
            <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-6" />
                <h3 className="font-display text-xl font-semibold text-neutral-900 dark:text-white mb-2">
                  Processing Report...
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                  AI is analyzing your civic issue report
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-neutral-500">
                  <Brain className="w-4 h-4" />
                  <span>Classifying issue • Detecting duplicates • Calculating priority</span>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'result' && aiResult && (
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
                      Your civic issue has been recorded.
                    </p>
                    <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800">
                      <span className="text-xs text-neutral-500">Issue ID:</span>
                      <span className="font-mono text-sm font-bold text-brand-600 dark:text-brand-400">{issueId}</span>
                    </div>
                  </div>

                  <div className="p-6 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
                    <h4 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                      <Brain className="w-4 h-4 text-brand-500" />
                      AI Classification Complete
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                        <p className="text-xs text-neutral-500 mb-1">Detected Issue</p>
                        <p className="font-medium text-neutral-900 dark:text-white">{aiResult.category}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                        <p className="text-xs text-neutral-500 mb-1">Confidence</p>
                        <p className="font-mono font-medium text-brand-600 dark:text-brand-400">{aiResult.confidence}%</p>
                      </div>
                      <div className="p-3 rounded-lg bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                        <p className="text-xs text-neutral-500 mb-1">Severity</p>
                        <p className="font-medium text-amber-600 dark:text-amber-400">{aiResult.severity}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                        <p className="text-xs text-neutral-500 mb-1">Priority Score</p>
                        <p className="font-mono font-bold text-neutral-900 dark:text-white">{aiResult.priority}/100</p>
                      </div>
                    </div>

                    <div className="mt-4 p-3 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800">
                      <p className="text-xs text-neutral-500 mb-1">Suggested Department</p>
                      <p className="font-medium text-brand-700 dark:text-brand-300">{aiResult.department}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button variant="secondary" size="lg" className="flex-1" asChild>
                  <a href={`/dashboard/issues/${issueId}`}>View Issue Details</a>
                </Button>
                <Button size="lg" className="flex-1" asChild>
                  <a href="/report" onClick={() => { setStep('form'); setFormData({ title: '', category: '', location: '', description: '', contact: '' }); }}>Report Another Issue</a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}