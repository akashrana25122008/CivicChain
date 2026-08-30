'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  MapPin,
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  Brain,
  Shield,
  ArrowLeft,
  TrendingUp,
  FileText,
  Eye,
} from 'lucide-react';
import Link from 'next/link';

const ISSUE = {
  id: 'CC-1092',
  category: 'Road Infrastructure',
  type: 'Road Pothole',
  location: 'Sector 12, Navapur',
  priority: 92,
  status: 'atRisk',
  affectedCitizens: 63,
  reports: 47,
  promise: '28 August 2026',
  authority: 'Municipal Roads Department',
  created: '24 August 2026',
  aiConfidence: 94,
};

const TIMELINE = [
  { date: '24 Aug 2026', label: 'Issue reported', status: 'completed' },
  { date: '24 Aug 2026', label: 'AI analysis completed', status: 'completed' },
  { date: '25 Aug 2026', label: 'Duplicate reports merged (47 → 1)', status: 'completed' },
  { date: '25 Aug 2026', label: 'Assigned to Roads Department', status: 'completed' },
  { date: '26 Aug 2026', label: 'Authority promise recorded', status: 'completed' },
  { date: '27 Aug 2026', label: 'Work started', status: 'completed' },
  { date: '28 Aug 2026', label: 'Resolution evidence submitted', status: 'current' },
  { date: '28 Aug 2026', label: 'AI verification completed', status: 'pending' },
];

const AI_VERIFICATION = {
  locationMatch: 98,
  issueMatch: 96,
  visualImprovement: 84,
  repairQuality: 71,
  overallConfidence: 81,
  result: 'PARTIALLY RESOLVED',
};

export default function IssueDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <Link href="/dashboard/issues" className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Issues
        </Link>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white">
                CIVIC ISSUE #{ISSUE.id}
              </h1>
              <Badge variant="status" status={ISSUE.status} />
            </div>
            <p className="text-neutral-600 dark:text-neutral-400">
              {ISSUE.type} • {ISSUE.location}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-2" />
              View on Map
            </Button>
            <Button size="sm">
              <FileText className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card variant="elevated" className="p-4 bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardContent>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                  <span className="text-xs text-neutral-500">Priority</span>
                </div>
                <p className="text-2xl font-display font-bold text-neutral-900 dark:text-white">{ISSUE.priority}<span className="text-sm font-normal text-neutral-500">/100</span></p>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-mono mt-1">HIGH</p>
              </CardContent>
            </Card>
            <Card variant="elevated" className="p-4 bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardContent>
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-brand-500" />
                  <span className="text-xs text-neutral-500">Affected</span>
                </div>
                <p className="text-2xl font-display font-bold text-neutral-900 dark:text-white">{ISSUE.affectedCitizens}</p>
                <p className="text-xs text-neutral-500 mt-1">citizens</p>
              </CardContent>
            </Card>
            <Card variant="elevated" className="p-4 bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardContent>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-violet-500" />
                  <span className="text-xs text-neutral-500">Reports</span>
                </div>
                <p className="text-2xl font-display font-bold text-neutral-900 dark:text-white">{ISSUE.reports}</p>
                <p className="text-xs text-neutral-500 mt-1">merged</p>
              </CardContent>
            </Card>
            <Card variant="elevated" className="p-4 bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardContent>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-neutral-500">Promise</span>
                </div>
                <p className="text-sm font-medium text-neutral-900 dark:text-white">{ISSUE.promise}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-mono mt-1">AT RISK</p>
              </CardContent>
            </Card>
          </div>

          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader>
              <CardTitle as="h2" className="text-lg">Issue Evidence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="aspect-video rounded-xl bg-neutral-100 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border flex items-center justify-center">
                  <div className="text-center">
                    <FileText className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
                    <p className="text-xs text-neutral-500">Photo 1</p>
                  </div>
                </div>
                <div className="aspect-video rounded-xl bg-neutral-100 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border flex items-center justify-center">
                  <div className="text-center">
                    <FileText className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
                    <p className="text-xs text-neutral-500">Photo 2</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader>
              <CardTitle as="h2" className="text-lg flex items-center gap-2">
                <Brain className="w-5 h-5 text-brand-500" />
                AI Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 rounded-lg bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
                  <p className="text-xs text-neutral-500 mb-1">Category</p>
                  <p className="font-medium text-neutral-900 dark:text-white">{ISSUE.category}</p>
                </div>
                <div className="p-3 rounded-lg bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
                  <p className="text-xs text-neutral-500 mb-1">Confidence</p>
                  <p className="font-mono font-medium text-brand-600 dark:text-brand-400">{ISSUE.aiConfidence}%</p>
                </div>
                <div className="p-3 rounded-lg bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
                  <p className="text-xs text-neutral-500 mb-1">Authority</p>
                  <p className="font-medium text-neutral-900 dark:text-white">{ISSUE.authority}</p>
                </div>
                <div className="p-3 rounded-lg bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
                  <p className="text-xs text-neutral-500 mb-1">Created</p>
                  <p className="font-medium text-neutral-900 dark:text-white">{ISSUE.created}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader>
              <CardTitle as="h2" className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-500" />
                AI Verification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-6">
                {[
                  { label: 'Location Match', value: AI_VERIFICATION.locationMatch, color: 'bg-emerald-500' },
                  { label: 'Issue Match', value: AI_VERIFICATION.issueMatch, color: 'bg-emerald-500' },
                  { label: 'Visual Improvement', value: AI_VERIFICATION.visualImprovement, color: 'bg-amber-500' },
                  { label: 'Repair Quality', value: AI_VERIFICATION.repairQuality, color: 'bg-amber-500' },
                  { label: 'Overall Confidence', value: AI_VERIFICATION.overallConfidence, color: 'bg-brand-500' },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-neutral-600 dark:text-neutral-400">{item.label}</span>
                      <span className="font-mono font-medium text-neutral-900 dark:text-white">{item.value}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-neutral-100 dark:bg-dark-border overflow-hidden">
                      <div className={cn('h-full rounded-full', item.color)} style={{ width: `${item.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Overall Assessment</span>
                  <Badge variant="status" status="partiallyResolved" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader>
              <CardTitle as="h2" className="text-lg">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-neutral-200 dark:bg-dark-border" />
                <div className="space-y-4">
                  {TIMELINE.map((item, index) => (
                    <div key={index} className="relative flex items-start gap-4">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center z-10 border-4 border-white dark:border-dark-bg-card',
                        item.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                        item.status === 'current' ? 'bg-amber-100 dark:bg-amber-900/30' :
                        'bg-neutral-100 dark:bg-dark-border'
                      )}>
                        {item.status === 'completed' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        ) : item.status === 'current' ? (
                          <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-neutral-400" />
                        )}
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-xs text-neutral-500 mb-0.5">{item.date}</p>
                        <p className={cn(
                          'text-sm',
                          item.status === 'current' ? 'font-medium text-amber-700 dark:text-amber-300' :
                          item.status === 'completed' ? 'text-neutral-700 dark:text-neutral-300' :
                          'text-neutral-500 dark:text-neutral-500'
                        )}>
                          {item.label}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader>
              <CardTitle as="h2" className="text-lg">Community Verification</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                Does the community agree that it&apos;s fixed?
              </p>
              <div className="space-y-3">
                {[
                  { label: 'Fixed', percent: 71, color: 'bg-emerald-500' },
                  { label: 'Partially Fixed', percent: 19, color: 'bg-amber-500' },
                  { label: 'Not Fixed', percent: 10, color: 'bg-red-500' },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-neutral-600 dark:text-neutral-400">{item.label}</span>
                      <span className="font-mono text-neutral-900 dark:text-white">{item.percent}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-neutral-100 dark:bg-dark-border overflow-hidden">
                      <div className={cn('h-full rounded-full', item.color)} style={{ width: `${item.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-neutral-500 mt-4 italic">
                Community feedback is an additional evidence layer and does not replace formal administrative verification.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}