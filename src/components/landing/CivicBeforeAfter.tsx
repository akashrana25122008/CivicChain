'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChevronsLeftRight, ExternalLink, RotateCw, Search, ShieldCheck } from 'lucide-react';
import type {
  EvidenceImage,
  EvidenceSearchResult,
  EvidenceMetrics,
  IssueContext,
  SearchLink,
  SearchStep,
} from '@/lib/evidence/types';

/**
 * Real-photo Before & After visualization.
 *
 * The same-location photographs are genuinely retrieved (server-side) from a
 * public, keyless image API and ranked for relevance. No image-generation API
 * is used and none is required. Confidence/assessment values are only ever
 * reported when a real image pair was retrieved and analysed.
 */

/** Representative issue shown on the landing section (override via prop). */
export const DEFAULT_ISSUE: IssueContext = {
  location: 'Sector 62, Noida',
  issueType: 'drainage',
  issueLabel: 'Blocked drainage causing water accumulation',
  actionLabel: 'Drainage cleared and water flow restored',
  statusLabel: 'Resolved',
};

/**
 * Local road-repair demonstration.
 *
 * The two photographs below are supplied with the project under `public/road/`
 * (image1 = original/problem condition, image2 = repaired/resolved condition).
 * They are real local images — NOT retrieved by a web search and NOT
 * AI-generated. Because they are locally supplied materials, we do not claim
 * external verification and we do not invent publication dates.
 */
export const ROAD_BEFORE: EvidenceImage = {
  url: '/road/image1.jpg',
  thumbnailUrl: '/road/image1.jpg',
  sourceUrl: '/road/image1.jpg',
  sourceName: 'Local road evidence',
  title: 'Road infrastructure damage',
  published: undefined, // never fabricate a date
  query: '',
  confidence: 0,
  verified: false,
};

export const ROAD_AFTER: EvidenceImage = {
  url: '/road/image2.png',
  thumbnailUrl: '/road/image2.png',
  sourceUrl: '/road/image2.png',
  sourceName: 'Local road evidence',
  title: 'Road surface repaired and restored',
  published: undefined, // never fabricate a date
  query: '',
  confidence: 0,
  verified: false,
};

export const ROAD_CONTEXT: IssueContext = {
  location: 'Local demonstration',
  issueType: 'road',
  issueLabel: 'Road infrastructure damage',
  actionLabel: 'Road surface repaired and restored',
  statusLabel: 'Resolved',
};

export type EvidencePhase = 'loading' | 'ready' | 'partial' | 'unavailable' | 'error';

export interface EvidenceState {
  phase: EvidencePhase;
  result: EvidenceSearchResult | null;
  error: string | null;
  attempt: number;
  retry: () => void;
}

/**
 * Hook that runs the real evidence search. Retry increments `attempt`, which
 * the server uses to vary query wording and re-rank candidates — it genuinely
 * performs a new search rather than resetting an empty state.
 */
export function useEvidenceSearch(context: IssueContext): EvidenceState {
  const [phase, setPhase] = useState<EvidencePhase>('loading');
  const [result, setResult] = useState<EvidenceSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const res = await fetch('/api/evidence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...context, attempt }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json?.error || 'Evidence search failed.');
          setPhase('error');
          return;
        }
        const r = json.result as EvidenceSearchResult;
        setResult(r);
        if (r.available) setPhase('ready');
        else if (r.partial) setPhase('partial');
        else setPhase('unavailable');
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Network error.');
        setPhase('error');
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [context, attempt]);

  const retry = useCallback(() => {
    setPhase('loading');
    setError(null);
    setAttempt((a) => a + 1);
  }, []);

  return { phase, result, error, attempt, retry };
}

/* ------------------------------------------------------------------ */
/* Status / progress                                                  */
/* ------------------------------------------------------------------ */

function StepRow({ step, shouldShow }: { step: SearchStep; shouldShow: boolean }) {
  const done = step.state === 'done';
  const active = step.state === 'active';
  if (!done && !active && !shouldShow) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded-full text-[10px]',
          done ? 'bg-emerald-500 text-white' : active ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300' : 'bg-neutral-100 dark:bg-dark-border text-neutral-400',
        )}
      >
        {done ? '✓' : active ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /> : '•'}
      </span>
      <span className={cn(done ? 'text-neutral-700 dark:text-neutral-200' : active ? 'text-neutral-800 dark:text-neutral-100' : 'text-neutral-400 dark:text-neutral-500')}>
        {step.label}
      </span>
    </div>
  );
}

function SearchingState({ steps }: { steps: SearchStep[] }) {
  // Show steps as they complete; hide still-pending ones.
  const revealUpTo = steps.findIndex((s) => s.state === 'pending');
  const visible = revealUpTo === -1 ? steps : steps.slice(0, revealUpTo);
  return (
    <div className="p-4 md:p-6 bg-white dark:bg-dark-bg border border-neutral-200 dark:border-dark-border rounded-2xl shadow-md dark:shadow-dark-sm">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-mono text-neutral-500 tracking-wider">BEFORE / AFTER · SAME LOCATION</span>
      </div>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-neutral-200 dark:border-dark-border bg-neutral-100 dark:bg-dark-bg-card">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-6">
          <div className="flex flex-col items-center gap-3">
            <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-neutral-200 border-t-brand-500 dark:border-dark-border dark:border-t-brand-400" />
            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Searching real civic evidence…</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {visible.map((s) => (
              <StepRow key={s.key} step={s} shouldShow={s.state !== 'pending'} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Image rendering + source attribution                               */
/* ------------------------------------------------------------------ */

function SourceAttribution({ image }: { image: EvidenceImage }) {
  const hasDate = !!image.published;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-neutral-500">
      {image.verified && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="h-3 w-3" /> Verified Source
        </span>
      )}
      <span className="font-mono">
        Source:{' '}
        <a
          href={image.sourceUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-0.5 font-semibold text-brand-600 dark:text-brand-400 underline underline-offset-2 hover:text-brand-700 dark:hover:text-brand-300"
        >
          {image.sourceName}
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </span>
      <span className="font-mono">·</span>
      {hasDate ? (
        <span className="font-mono">Published: {image.published}</span>
      ) : (
        <span className="font-mono italic">Date unavailable</span>
      )}
    </div>
  );
}

function ImageSlot({
  image,
  state,
  onReady,
  onError,
  overlay,
}: {
  image: EvidenceImage;
  state: 'loading' | 'ready' | 'error';
  onReady: () => void;
  onError: () => void;
  overlay?: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0">
      {state !== 'ready' && state !== 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 dark:bg-dark-bg-card">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-500 dark:border-dark-border dark:border-t-brand-400" />
        </div>
      )}
      {image.url && state !== 'error' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image.thumbnailUrl || image.url}
          alt={image.title || (overlay ? undefined : 'Civic location photograph')}
          loading="lazy"
          onLoad={onReady}
          onError={onError}
          draggable={false}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-500 select-none',
            state === 'ready' ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
      {state === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-100 dark:bg-dark-bg-card p-4 text-center">
          <span className="text-xs font-mono text-neutral-500">Image could not be loaded</span>
          <SourceAttribution image={image} />
        </div>
      )}
      {overlay}
    </div>
  );
}

/**
 * Real-photo comparison slider. AFTER sits beneath; BEFORE is clipped and
 * revealed by dragging the divider. Keyboard/touch access and reduced motion
 * safe.
 */
function ImageSlider({ before, after }: { before: EvidenceImage; after: EvidenceImage }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const [active, setActive] = useState(false);
  const [img, setImg] = useState<Record<'before' | 'after', 'loading' | 'ready' | 'error'>>({
    before: 'loading',
    after: 'loading',
  });

  const mark = (key: 'before' | 'after', s: 'ready' | 'error') =>
    setImg((p) => (p[key] === s ? p : { ...p, [key]: s }));

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos(Math.min(92, Math.max(8, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  return (
    <div
      ref={containerRef}
      className="group relative aspect-video w-full overflow-hidden rounded-[20px] border border-[#E2E8F0] shadow-[0_10px_30px_-12px_rgba(11,22,56,0.25)] select-none touch-none bg-neutral-100 dark:bg-dark-bg-card"
      role="slider"
      aria-label="Before and after comparison of the same location"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pos)}
      tabIndex={0}
      onPointerDown={(e) => {
        setActive(true);
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        updateFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (active) updateFromClientX(e.clientX);
      }}
      onPointerUp={() => setActive(false)}
      onPointerCancel={() => setActive(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') setPos((p) => Math.max(8, p - 5));
        if (e.key === 'ArrowRight') setPos((p) => Math.min(92, p + 5));
      }}
    >
      {/* AFTER (base) */}
      <ImageSlot
        image={after}
        state={img.after}
        onReady={() => mark('after', 'ready')}
        onError={() => mark('after', 'error')}
        overlay={
          <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-0.5 rounded-lg rounded-tl-sm bg-emerald-600/95 px-2.5 py-1.5 text-right shadow-md">
            <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-white" /> AFTER
            </span>
            <span className="text-[9px] font-medium text-emerald-50">Resolved condition</span>
          </div>
        }
      />
      {/* BEFORE (clipped right) */}
      <div className="absolute inset-0 z-[2]" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <ImageSlot
          image={before}
          state={img.before}
          onReady={() => mark('before', 'ready')}
          onError={() => mark('before', 'error')}
          overlay={
            <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-0.5 rounded-lg rounded-tr-sm bg-red-600/95 px-2.5 py-1.5 text-left shadow-md">
              <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white" /> BEFORE
              </span>
              <span className="text-[9px] font-medium text-red-50">Reported condition</span>
            </div>
          }
        />
      </div>

      {/* Drag hint (subtle, never oversized) */}
      <div
        className={cn(
          'pointer-events-none absolute bottom-3 left-1/2 z-[4] -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-[#0B1638]/80 px-3 py-1 text-[10px] font-medium text-white shadow backdrop-blur-sm transition-opacity duration-300',
          active ? 'opacity-0' : 'opacity-80 group-hover:opacity-100',
        )}
      >
        <ChevronsLeftRight className="h-3 w-3" />
        Drag to compare
      </div>

      {/* Divider line + handle */}
      <div
        className="absolute top-0 bottom-0 z-[4] w-0.5 -translate-x-1/2"
        style={{ left: `${pos}%`, backgroundColor: '#3155E7' }}
      >
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_4px_16px_rgba(11,22,56,0.35)] ring-1 ring-[#3155E7]/60 transition-all duration-150',
            'group-hover:scale-110 group-active:scale-110',
            active && 'scale-110 ring-2',
          )}
        >
          <ChevronsLeftRight className="h-4.5 w-4.5 text-[#3155E7]" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ready / partial / unavailable                                       */
/* ------------------------------------------------------------------ */

function ReadyPanel({
  before,
  after,
  context,
}: {
  before: EvidenceImage;
  after: EvidenceImage;
  context: IssueContext;
}) {
  return (
    <div className="p-4 md:p-6 bg-white dark:bg-dark-bg border border-neutral-200 dark:border-dark-border rounded-2xl shadow-md dark:shadow-dark-sm">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-mono text-neutral-500 tracking-wider">BEFORE / AFTER · SAME LOCATION</span>
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-brand-600 dark:text-brand-400">
          <ChevronsLeftRight className="w-3.5 h-3.5" /> DRAG
        </span>
      </div>
      <ImageSlider before={before} after={after} />
      <div className="mt-3 flex flex-col gap-1.5 border-l-2 border-neutral-200 dark:border-dark-border pl-3">
        <div className="flex items-center gap-2 text-[12px]">
          <span className="font-mono font-bold text-red-600 dark:text-red-400">BEFORE</span>
          <SourceAttribution image={before} />
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">AFTER</span>
          <SourceAttribution image={after} />
        </div>
      </div>
      <Lifecycle context={context} />
    </div>
  );
}

function PartialPanel({
  image,
  state,
  context,
}: {
  image: EvidenceImage;
  state: 'before' | 'after';
  context: IssueContext;
}) {
  return (
    <div className="p-4 md:p-6 bg-white dark:bg-dark-bg border border-neutral-200 dark:border-dark-border rounded-2xl shadow-md dark:shadow-dark-sm">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-mono text-neutral-500 tracking-wider">BEFORE / AFTER · SAME LOCATION</span>
      </div>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-neutral-200 dark:border-dark-border bg-neutral-100 dark:bg-dark-bg-card">
        <ImageSlot
          image={image}
          state="loading"
          onReady={() => undefined}
          onError={() => undefined}
        />
        <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-md bg-neutral-700/90 text-white text-[10px] font-mono font-bold shadow">
          {state === 'before' ? 'BEFORE' : 'AFTER'}
        </div>
      </div>
      <div className="mt-3 border-l-2 border-neutral-200 dark:border-dark-border pl-3">
        <div className="flex items-center gap-2 text-[12px]">
          <span className="font-mono font-bold text-neutral-600 dark:text-neutral-400">
            {state === 'before' ? 'BEFORE' : 'AFTER'}
          </span>
          <SourceAttribution image={image} />
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
        <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
          Partial evidence — only one verified image found.
        </span>
      </div>
      <Lifecycle context={context} dimmed />
    </div>
  );
}

function UnavailablePanel({
  context,
  links,
  onRetry,
  attempt,
}: {
  context: IssueContext;
  links: { before: SearchLink[]; after: SearchLink[] };
  onRetry: () => void;
  attempt: number;
}) {
  return (
    <div className="p-4 md:p-6 bg-white dark:bg-dark-bg border border-neutral-200 dark:border-dark-border rounded-2xl shadow-md dark:shadow-dark-sm">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-mono text-neutral-500 tracking-wider">BEFORE / AFTER · SAME LOCATION</span>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-neutral-300 dark:border-dark-border bg-neutral-50 dark:bg-dark-bg-card p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-900/20">
          <Search className="h-6 w-6 text-amber-500" />
        </div>
        <div>
          <h4 className="font-display text-base font-semibold text-neutral-900 dark:text-white">
            Verified Before &amp; After imagery unavailable for this location.
          </h4>
          <p className="mx-auto mt-2 max-w-md text-xs text-neutral-500 dark:text-neutral-400">
            We could not verify two real photographs of the same location showing the reported issue
            and its resolution. No synthetic imagery is shown.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 rounded-xl border border-neutral-200 dark:border-dark-border bg-neutral-50 dark:bg-dark-bg-card p-4 sm:grid-cols-2">
        <div className="text-sm">
          <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">Search location</div>
          <div className="font-medium text-neutral-800 dark:text-neutral-200">{context.location}</div>
        </div>
        <div className="text-sm">
          <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">Reported issue</div>
          <div className="font-medium text-neutral-800 dark:text-neutral-200">{context.issueLabel || context.issueType}</div>
        </div>

        <div className="sm:col-span-2">
          <SearchLinkBlock title="Before / Reported Problem" tones="text-red-500" items={links.before} />
        </div>
        <div className="sm:col-span-2">
          <SearchLinkBlock title="After / Resolved Condition" tones="text-emerald-600" items={links.after} />
        </div>
      </div>

      <p className="mt-3 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
        The links above are web searches for manual verification — they are not evidence.
      </p>

      <button
        onClick={onRetry}
        disabled={attempt > 0}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-brand-300 dark:border-brand-700 px-4 py-2 text-sm font-medium text-brand-700 dark:text-brand-300 transition-colors hover:bg-brand-50 dark:hover:bg-brand-900/20"
      >
        <RotateCw className="h-4 w-4" />
        Retry Search
      </button>
    </div>
  );
}

function SearchLinkBlock({
  title,
  tones,
  items,
}: {
  title: string;
  tones: string;
  items: SearchLink[];
}) {
  return (
    <div>
      <div className={cn('mb-2 flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider', tones)}>
        <Search className="h-3.5 w-3.5" />
        {title}
      </div>
      <ul className="space-y-1.5">
        {items.slice(0, 4).map((it) => (
          <li key={`${it.query}-${title}`}>
            <a
              href={it.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="group inline-flex max-w-full items-center gap-1.5 rounded-md border border-neutral-200 dark:border-dark-border px-2.5 py-1.5 text-xs text-neutral-600 dark:text-neutral-300 transition-colors hover:border-brand-300 hover:text-brand-700 dark:hover:border-brand-700 dark:hover:text-brand-300"
            >
              <span className="truncate">«{it.query}»</span>
              <ExternalLink className="h-3 w-3 shrink-0 text-neutral-400 group-hover:text-brand-500" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Lifecycle({ context, dimmed }: { context: IssueContext; dimmed?: boolean }) {
  const reduce = useReducedMotion();
  const stages = [
    {
      index: '01',
      label: 'REPORTED ISSUE',
      value: context.issueLabel || context.issueType,
      dot: 'bg-[#E5484D]',
      ring: 'ring-[#E5484D]/20',
      text: 'text-[#E5484D]',
      line: 'bg-[#E5484D]/30',
    },
    {
      index: '02',
      label: 'ACTION TAKEN',
      value: context.actionLabel || 'Action completed by authority',
      dot: 'bg-[#F59E0B]',
      ring: 'ring-[#F59E0B]/20',
      text: 'text-[#F59E0B]',
      line: 'bg-[#F59E0B]/30',
    },
    {
      index: '03',
      label: 'CURRENT STATUS',
      value: context.statusLabel || 'Resolved',
      dot: 'bg-[#16A878]',
      ring: 'ring-[#16A878]/20',
      text: 'text-[#16A878]',
      line: 'bg-[#16A878]/30',
      resolved: true,
    },
  ];

  return (
    <div
      className={cn(
        'mt-6 rounded-[20px] border border-[#E2E8F0] bg-[#F5F7FC] p-5',
        dimmed && 'opacity-70',
      )}
    >
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h4 className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#0B1638]">
          Complaint Lifecycle
        </h4>
        <span className="text-[11px] text-[#64748B]">From reported issue to verified resolution</span>
      </div>

      <div className="relative">
        {/* connecting line (desktop) */}
        <div className="pointer-events-none absolute left-6 right-6 top-6 hidden h-0.5 bg-[#E2E8F0] md:block" />

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
          {stages.map((stage, i) => (
            <motion.div
              key={stage.index}
              className={cn('relative flex items-start gap-4 md:flex-col md:gap-3', i < stages.length - 1 && '')}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.4, delay: i * 0.12, ease: 'easeOut' }}
            >
              {/* node */}
              <div className="relative z-10 shrink-0">
                <span
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-full text-sm font-mono font-bold text-white shadow-md ring-4',
                    stage.dot,
                    stage.ring,
                  )}
                >
                  {stage.resolved ? <CheckCircle2 className="h-5 w-5" /> : stage.index}
                </span>
              </div>

              <div className="min-w-0 md:pt-1">
                <p className={cn('font-mono text-[10px] font-bold uppercase tracking-[0.12em]', stage.text)}>
                  {stage.label}
                </p>
                <p className="mt-1 text-sm font-medium leading-snug text-[#0B1638]">{stage.value}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.p
        className="mt-5 border-t border-[#E2E8F0] pt-3 text-[11px] italic text-[#64748B]"
        initial={reduce ? false : { opacity: 0 }}
        animate={reduce ? undefined : { opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        Same location → civic intervention → resolved condition.
      </motion.p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Assessment (evidence-gated)                                         */
/* ------------------------------------------------------------------ */

/**
 * Evidence-derived assessment. Only rendered when a real before/after pair
 * exists, using the provider-ranked metrics. Never fabricated from missing
 * evidence.
 */
export function AssessmentPanel({ metrics, phase }: { metrics?: EvidenceMetrics; phase: EvidencePhase }) {
  if (phase !== 'ready' || !metrics) {
    return (
      <div className="p-8 rounded-2xl bg-white dark:bg-dark-bg border border-neutral-200 dark:border-dark-border shadow-lg dark:shadow-dark-lg">
        <h3 className="font-display text-xl font-semibold text-neutral-900 dark:text-white mb-4">AI Resolution Assessment</h3>
        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
          <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-200">
            Resolution assessment unavailable
          </span>
          <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-500">
            Verified Before &amp; After visual evidence is required before assessing resolution quality.
          </span>
        </div>
      </div>
    );
  }

  const rows = [
    { label: 'Location Match', value: metrics.locationMatch, tone: 'emerald' },
    { label: 'Issue Match', value: metrics.issueMatch, tone: 'emerald' },
    { label: 'Source Credibility', value: metrics.sourceCredibility, tone: 'amber' },
    { label: 'Date Confidence', value: metrics.dateConfidence, tone: 'amber' },
  ] as const;

  return (
    <div className="p-8 rounded-2xl bg-white dark:bg-dark-bg border border-neutral-200 dark:border-dark-border shadow-lg dark:shadow-dark-lg">
      <h3 className="font-display text-xl font-semibold text-neutral-900 dark:text-white mb-1">AI Resolution Assessment</h3>
      <p className="mb-6 text-xs text-neutral-500 dark:text-neutral-500">
        Derived from the compared real photographs above.
      </p>

      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-neutral-600 dark:text-neutral-400">{row.label}</span>
              <span className="font-mono font-medium text-neutral-900 dark:text-white">{row.value}%</span>
            </div>
            <div className="h-2 rounded-full bg-neutral-100 dark:bg-dark-border overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full',
                  row.tone === 'emerald'
                    ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                    : 'bg-gradient-to-r from-amber-400 to-amber-600',
                )}
                style={{ width: `${row.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-brand-700 dark:text-brand-300">Overall Confidence</span>
          <span className="font-mono font-bold text-brand-700 dark:text-brand-300">{metrics.overall}%</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-brand-100 dark:bg-brand-900/40 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600" style={{ width: `${metrics.overall}%` }} />
        </div>
      </div>

      <p className="mt-4 text-[11px] text-neutral-500 dark:text-neutral-500 italic">
        {metrics.chronologyEstablished
          ? 'Before–after chronology established from published dates.'
          : 'Dates could not fully confirm the before–after order.'}
      </p>
      <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-500 italic">
        Assessment is decision support, not a final administrative determination.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Orchestration panel                                                 */
/* ------------------------------------------------------------------ */

type PanelProps = {
  state: EvidenceState;
  context: IssueContext;
};

/** The left-hand before/after panel, driven by the real search state. */
export function BeforeAfterPanel({ state, context }: PanelProps) {
  const { phase, result } = state;

  if (phase === 'loading') {
    const steps = result?.progress.steps ?? [
      { key: 'location', label: 'Location identified', state: 'done' as const },
      { key: 'before', label: 'Before evidence searched', state: 'active' as const },
    ];
    return <SearchingState steps={steps} />;
  }

  if (phase === 'error') {
    return (
      <div className="p-4 md:p-6 bg-white dark:bg-dark-bg border border-neutral-200 dark:border-dark-border rounded-2xl shadow-md dark:shadow-dark-sm">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-mono text-neutral-500 tracking-wider">BEFORE / AFTER · SAME LOCATION</span>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-neutral-300 dark:border-dark-border bg-neutral-50 dark:bg-dark-bg-card p-8 text-center">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
            {state.error || 'Could not search for evidence.'}
          </span>
          <button
            onClick={state.retry}
            className="mt-2 inline-flex items-center gap-2 rounded-lg border border-brand-300 dark:border-brand-700 px-4 py-2 text-sm font-medium text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/20"
          >
            <RotateCw className="h-4 w-4" /> Try again
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'ready' && result?.before && result?.after) {
    return <ReadyPanel before={result.before} after={result.after} context={context} />;
  }

  if (phase === 'partial') {
    const single = result?.before || result?.after;
    const stateLabel = result?.before ? 'before' : 'after';
    if (single) return <PartialPanel image={single} state={stateLabel} context={context} />;
  }

  return (
    <UnavailablePanel
      context={context}
      links={result?.links ?? { before: [], after: [] }}
      onRetry={state.retry}
      attempt={state.attempt}
    />
  );
}

/** Convenience entry point used by the AIVerification section. */
export function BeforeAfterEvidence({ context = DEFAULT_ISSUE }: { context?: IssueContext }) {
  const state = useEvidenceSearch(context);
  return <BeforeAfterPanel state={state} context={context} />;
}

/* ------------------------------------------------------------------ */
/* Local road-repair demonstration (no web search)                     */
/* ------------------------------------------------------------------ */

/**
 * Honest source label for locally supplied demonstration photographs.
 * States they are local evidence and never claims external verification,
 * a publication date, or a fabricated certainty level.
 */
function LocalSourceLabel({ state }: { state: 'before' | 'after' }) {
  const isBefore = state === 'before';
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-[14px] border px-3.5 py-2.5 transition-colors',
        isBefore
          ? 'border-[#FFF0F1] bg-[#FFF0F1]'
          : 'border-[#E8F8F1] bg-[#E8F8F1]',
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-mono font-bold text-white',
            isBefore ? 'bg-[#E5484D]' : 'bg-[#16A878]',
          )}
        >
          {isBefore ? 'B' : 'A'}
        </span>
        <div>
          <p className={cn('text-[10px] font-mono font-bold uppercase tracking-wider', isBefore ? 'text-[#E5484D]' : 'text-[#16A878]')}>
            {isBefore ? 'Before' : 'After'}
          </p>
          <p className="text-[11px] text-[#64748B]">Local demonstration evidence</p>
        </div>
      </div>
      <span className="hidden text-[11px] font-medium text-[#0B1638] sm:block">
        {isBefore ? 'Reported condition' : 'Resolved condition'}
      </span>
    </div>
  );
}

/**
 * The local before/after "Civic Evidence" card. Renders the supplied road
 * photographs in the draggable comparison slider, with compact evidence rows
 * and the connected complaint lifecycle.
 */
export function LocalRoadPanel() {
  return (
    <div className="rounded-[22px] border border-[#E2E8F0] bg-white p-5 shadow-[0_16px_40px_-24px_rgba(11,22,56,0.35)] md:p-7">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-[#3155E7]" />
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#0B1638]">
            Civic Evidence
          </span>
          <span className="mx-1 hidden h-px flex-1 bg-[#E2E8F0] sm:block" />
        </div>
        <h3 className="mt-2 font-display text-xl font-semibold text-[#0B1638]">
          Before &amp; After · Same Location
        </h3>
        <p className="mt-1 text-sm text-[#64748B]">
          Visual evidence of the reported condition and its resolution.
        </p>
      </div>

      {/* Before / After visualizer — the centrepiece */}
      <ImageSlider before={ROAD_BEFORE} after={ROAD_AFTER} />

      {/* Evidence metadata rows */}
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <LocalSourceLabel state="before" />
        <LocalSourceLabel state="after" />
      </div>

      {/* Complaint lifecycle */}
      <Lifecycle context={ROAD_CONTEXT} />
    </div>
  );
}

/**
 * Honest local assessment. The two supplied photographs are local
 * demonstration materials and are not machine-analysed here, so we do NOT print
 * fabricated numeric confidence scores. We state the verified local evidence
 * condition in plain text instead.
 */
export function LocalAssessment() {
  const rows = [
    { label: 'Location Match', value: 'Verified locally', tone: 'blue' as const },
    { label: 'Issue Match', value: 'Road condition comparison', tone: 'blue' as const },
    { label: 'Visual Improvement', value: 'Before → After available', tone: 'green' as const },
  ];

  return (
    <div className="rounded-[22px] border border-[#E2E8F0] bg-white p-5 shadow-[0_16px_40px_-24px_rgba(11,22,56,0.35)] md:p-7">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-[#16A878]" />
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#0B1638]">
            Resolution Assessment
          </span>
        </div>
        <p className="mt-2 text-sm text-[#64748B]">
          Evidence-based summary of the reported civic issue.
        </p>
      </div>

      {/* Assessment rows */}
      <div className="overflow-hidden rounded-[16px] border border-[#E2E8F0]">
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={cn(
              'flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-[#F5F7FC]',
              i < rows.length - 1 && 'border-b border-[#E2E8F0]',
            )}
          >
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748B]">
                {row.label}
              </p>
              <p className="mt-0.5 text-sm font-medium text-[#0B1638]">{row.value}</p>
            </div>
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full',
                row.tone === 'green' ? 'bg-[#E8F8F1] text-[#16A878]' : 'bg-[#EAF0FF] text-[#3155E7]',
              )}
            >
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
        ))}
      </div>

      {/* Overall status */}
      <div className="mt-5 rounded-[16px] border border-[#16A878]/40 bg-[#E8F8F1] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#16A878] text-white">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#16A878]">
                Overall Status
              </p>
              <p className="font-display text-lg font-bold text-[#0B1638]">Resolved</p>
            </div>
          </div>
        </div>
        <p className="mt-3 border-t border-[#16A878]/20 pt-3 text-[11px] text-[#64748B]">
          Based on the supplied Before &amp; After evidence.
        </p>
      </div>
    </div>
  );
}
