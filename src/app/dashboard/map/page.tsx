'use client';

import { useState } from 'react';
import { type IssueMarker, MOCK_ISSUES } from '@/components/3d/CivicGlobe';
import { mapEmbedUrl } from '@/components/landing/CivicMapEmbed';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';
import { MapPin } from 'lucide-react';

const LEGEND = [
  { color: 'bg-red-500', label: 'Broken Promise' },
  { color: 'bg-amber-500', label: 'Active Issue' },
  { color: 'bg-emerald-500', label: 'Resolved' },
  { color: 'bg-violet-500', label: 'Predicted Risk' },
  { color: 'bg-brand-500', label: 'Under Verification' },
];

const TYPE_NAME: Record<string, string> = {
  pothole: 'Road Pothole',
  drainage: 'Drain Blockage',
  streetlight: 'Streetlight Failure',
  garbage: 'Garbage Accumulation',
  infrastructure: 'Infrastructure',
};

const CITY_CENTER = { lat: 19.076, lng: 72.8777 };

export default function MapPage() {
  const [focused, setFocused] = useState<IssueMarker | null>(null);
  const [view, setView] = useState(CITY_CENTER);
  const [zoom, setZoom] = useState(12);

  const focusIssue = (issue: IssueMarker) => {
    setFocused(issue);
    setView({ lat: issue.lat, lng: issue.lng });
    setZoom(15);
  };

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white">Civic Intelligence Map</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">
          Live Google Map of civic issues across the city. Pick an issue to focus the map.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border overflow-hidden">
            <div className="aspect-[16/10] bg-dark-bg relative">
              <iframe
                key={`${view.lat},${view.lng},${zoom}`}
                title="Live Google Map of civic issues"
                src={mapEmbedUrl({ lat: view.lat, lng: view.lng }, zoom)}
                className="h-full w-full border-0"
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />

              <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-dark-bg/80 backdrop-blur-sm border border-dark-border">
                <div className="flex flex-wrap items-center gap-4">
                  {LEGEND.map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className={cn('w-2.5 h-2.5 rounded-full', item.color)} />
                      <span className="text-xs text-white/60">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-bg/80 backdrop-blur-sm border border-dark-border">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-white/60 font-mono">LIVE INTELLIGENCE</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader>
              <CardTitle as="h2" className="text-lg">Nearby Issues</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {MOCK_ISSUES.map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/dashboard/issues/${issue.id}`}
                    onClick={() => focusIssue(issue)}
                    className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center',
                        focused?.id === issue.id ? 'bg-brand-100 dark:bg-brand-900/40' : 'bg-brand-50 dark:bg-brand-900/30'
                      )}>
                        <MapPin className={cn(
                          'w-4 h-4',
                          focused?.id === issue.id ? 'text-brand-700 dark:text-brand-300' : 'text-brand-600 dark:text-brand-400'
                        )} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">{issue.id}</p>
                        <p className="text-xs text-neutral-500">{TYPE_NAME[issue.type]}</p>
                      </div>
                    </div>
                    <Badge variant="status" status={issue.status} size="sm" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader>
              <CardTitle as="h2" className="text-lg">Map Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { label: 'Total Issues', value: '2,481', color: 'text-brand-600' },
                  { label: 'Active Issues', value: '1,847', color: 'text-amber-600' },
                  { label: 'Resolved', value: '412', color: 'text-emerald-600' },
                  { label: 'Broken Promises', value: '214', color: 'text-red-600' },
                ].map((stat) => (
                  <div key={stat.label} className="flex justify-between items-center">
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">{stat.label}</span>
                    <span className={cn('font-mono font-bold', stat.color)}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}