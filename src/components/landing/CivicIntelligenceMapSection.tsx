'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { type IssueMarker, MOCK_ISSUES } from '@/components/3d/CivicGlobe';
import { mapEmbedUrl } from '@/components/landing/CivicMapEmbed';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { cn } from '@/lib/utils';
import { X, MapPin, Users, Calendar, Activity } from 'lucide-react';
import { DUR, EASE } from '@/lib/motion';

const LEGEND = [
  { color: 'bg-red-500', label: 'Broken Promise' },
  { color: 'bg-amber-500', label: 'Active Issue' },
  { color: 'bg-emerald-500', label: 'Resolved' },
  { color: 'bg-violet-500', label: 'Predicted Risk' },
  { color: 'bg-brand-500', label: 'Under Verification' },
];

const STATS = [
  { label: 'ACTIVE ISSUES', value: 2481, color: 'text-amber-400' },
  { label: 'BROKEN PROMISES', value: 214, color: 'text-red-400' },
  { label: 'RESOLVED', value: 1294, color: 'text-emerald-400' },
  { label: 'PREDICTED RISKS', value: 89, color: 'text-violet-400' },
];

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  onTrack: { label: 'ON TRACK', cls: 'text-emerald-400 bg-emerald-900/30 border-emerald-800' },
  atRisk: { label: 'AT RISK', cls: 'text-amber-400 bg-amber-900/30 border-amber-800' },
  brokenPromise: { label: 'BROKEN', cls: 'text-red-400 bg-red-900/30 border-red-800' },
  assigned: { label: 'ASSIGNED', cls: 'text-violet-400 bg-violet-900/30 border-violet-800' },
  verificationPending: { label: 'VERIFYING', cls: 'text-violet-400 bg-violet-900/30 border-violet-800' },
  resolved: { label: 'RESOLVED', cls: 'text-emerald-400 bg-emerald-900/30 border-emerald-800' },
};

const STATUS_COLOR: Record<string, string> = {
  onTrack: 'bg-emerald-400',
  atRisk: 'bg-amber-400',
  brokenPromise: 'bg-red-500',
  assigned: 'bg-violet-400',
  verificationPending: 'bg-violet-400',
  resolved: 'bg-emerald-500',
};

const TYPE_NAME: Record<string, string> = {
  pothole: 'Pothole',
  drainage: 'Drain Blockage',
  streetlight: 'Streetlight Failure',
  garbage: 'Garbage Accumulation',
  infrastructure: 'Infrastructure',
};

const CITY_CENTER = { lat: 19.076, lng: 72.8777 };

export function CivicIntelligenceMapSection() {
  const reduce = useReducedMotion();
  const [selected, setSelected] = useState<IssueMarker | null>(null);
  const [view, setView] = useState(CITY_CENTER);
  const [zoom, setZoom] = useState(12);

  const focusIssue = (issue: IssueMarker) => {
    setSelected(issue);
    setView({ lat: issue.lat, lng: issue.lng });
    setZoom(15);
  };

  return (
    <section className="py-20 md:py-32 bg-dark-bg" id="civic-map">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          className="max-w-3xl mx-auto text-center mb-16"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: DUR.section, ease: EASE.out }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-50/10 border border-brand-500/20 text-brand-400 text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-brand-400" />
            Civic Intelligence Map
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 text-balance">
            See the City as a Living Civic System.
          </h2>
          <p className="text-lg text-white/60 text-pretty">
            Live Google Map of civic issues, promises, and accountability across the city. Pick a live issue to focus the map.
          </p>
        </motion.div>

        <div className="max-w-6xl mx-auto relative">
          <div className="relative rounded-2xl overflow-hidden border border-dark-border bg-dark-bg-card">
            <div className="aspect-[16/9] md:aspect-[21/9]">
              <iframe
                key={`${view.lat},${view.lng},${zoom}`}
                title="Live Google Map of civic issues"
                src={mapEmbedUrl({ lat: view.lat, lng: view.lng }, zoom)}
                className="h-full w-full border-0"
                loading="eager"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            {/* Live issues list — focus the map on a real location */}
            <div className="absolute top-14 right-4 md:top-16 md:right-6 w-[230px] md:w-[250px] hidden md:block">
              <div className="rounded-xl bg-dark-bg/90 backdrop-blur-md border border-dark-border overflow-hidden shadow-xl">
                <div className="flex items-center justify-between px-3 py-2 border-b border-dark-border">
                  <span className="text-[10px] font-mono font-bold text-white/70">LIVE ISSUES</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="max-h-[300px] overflow-y-auto divide-y divide-white/5">
                  {MOCK_ISSUES.map((issue) => {
                    const active = selected?.id === issue.id;
                    return (
                      <button
                        key={issue.id}
                        onClick={() => focusIssue(issue)}
                        className={cn(
                          'w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors',
                          active ? 'bg-brand-500/10' : 'hover:bg-white/5'
                        )}
                      >
                        <span
                          className={cn(
                            'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                            STATUS_COLOR[issue.status] || 'bg-white/40',
                            active && 'ring-2 ring-brand-400/50'
                          )}
                        />
                        <span className="min-w-0">
                          <span className={cn('block text-xs font-semibold', active ? 'text-brand-300' : 'text-white')}>
                            {issue.id} · {TYPE_NAME[issue.type]}
                          </span>
                          <span className="block text-[10px] font-mono text-white/50">
                            P{issue.priority} · {issue.reports} reports
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Contextual panel — appears on issue selection */}
            <AnimatePresence>
              {selected && (
                <motion.div
                  key={selected.id}
                  className="absolute top-4 left-4 md:top-6 md:left-6 w-[280px] rounded-xl bg-dark-bg/90 backdrop-blur-md border border-dark-border shadow-xl"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: -16, scale: 0.97 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: -16, scale: 0.97 }}
                  transition={{ duration: DUR.standard, ease: EASE.out }}
                  style={{ transformOrigin: '0% 0%' }}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-mono font-bold text-white">
                        {TYPE_NAME[selected.type]} · {selected.id}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelected(null)}
                      aria-label="Close issue panel"
                      className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-white/50">
                        <Activity className="w-3.5 h-3.5" /> Priority
                      </span>
                      <span className="font-mono font-bold text-amber-400">{selected.priority}/100</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-white/50">
                        <Users className="w-3.5 h-3.5" /> Reports
                      </span>
                      <span className="font-mono font-bold text-white">{selected.reports}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-white/50">
                        <Calendar className="w-3.5 h-3.5" /> Promise
                      </span>
                      <span className="font-mono text-white/80">28 Aug</span>
                    </div>
                    <div className="pt-2 border-t border-dark-border">
                      <span className={cn(
                        'inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold font-mono border',
                        STATUS_LABEL[selected.status]?.cls || STATUS_LABEL.onTrack.cls
                      )}>
                        {STATUS_LABEL[selected.status]?.label || 'ACTIVE'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute bottom-4 left-4 right-4 md:bottom-6 md:left-6">
              <div className="p-4 rounded-xl bg-dark-bg/80 backdrop-blur-sm border border-dark-border">
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  {LEGEND.map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className={cn('w-2.5 h-2.5 rounded-full', item.color)} />
                      <span className="text-xs text-white/60">{item.label}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {STATS.map((stat) => (
                    <div key={stat.label} className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-[10px] text-white/40 font-mono mb-1">{stat.label}</p>
                      <p className={cn('text-lg font-display font-bold', stat.color)}>
                        <AnimatedNumber value={stat.value} delay={0.3} />
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="absolute top-4 right-4 md:top-6 md:right-6 p-3 rounded-xl bg-dark-bg/80 backdrop-blur-sm border border-dark-border">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-white/60 font-mono">LIVE INTELLIGENCE</span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-white/30 mt-4 font-mono">PROTOTYPE DATA — NOT REAL-TIME MONITORING</p>
      </div>
    </section>
  );
}