'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { ExternalLink, MapPin, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select, Input } from '@/components/ui/Input';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { ErrorState } from '@/components/dashboard/ErrorState';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { STATUS_COLORS } from '@/components/dashboard/IssuesMapInner';
import { CATEGORY_SELECT_OPTIONS, STATUS_LABELS, PRIORITY_LEVEL_LABELS } from '@/lib/issues/mapping';
import type { IssueListItem } from '@/lib/issues/types';
import type { MapView } from './CivicMapInner';

const CivicMapInner = dynamic(
  () => import('./CivicMapInner').then((m) => m.CivicMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[300px] flex items-center justify-center text-sm text-neutral-400">
        Loading map…
      </div>
    ),
  },
);

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ApiMapResponse {
  scope: 'mine' | 'department' | 'all';
  issues: IssueListItem[];
  total: number;
}

interface ScopeMeta {
  title: string;
  hint: string;
}

const SCOPE_META: Record<string, ScopeMeta> = {
  mine: {
    title: 'Your reports on the map',
    hint: 'Every report you submitted with a location, straight from the database.',
  },
  department: {
    title: 'This department on the map',
    hint: 'Every report assigned to your authority with a location.',
  },
  all: {
    title: 'The whole city on the map',
    hint: 'Every report on CivicChain with a location.',
  },
};

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));
const PRIORITY_OPTIONS = Object.entries(PRIORITY_LEVEL_LABELS).map(([value, label]) => ({ value, label }));

const LEGEND_ORDER = [
  'critical',
  'atRisk',
  'brokenPromise',
  'verificationPending',
  'promised',
  'assigned',
  'active',
  'onTrack',
  'resolved',
  'partiallyResolved',
  'rejected',
].filter((key) => STATUS_COLORS[key]);

function displayStatusToKey(displayStatus: string): string {
  const key = displayStatus.replace(/([a-z])([A-Z])/g, '$1$2');
  return key.charAt(0).toLowerCase() + key.slice(1).replace(/\s/g, '');
}

function toDateParam(value: string, endOfDay: boolean): string {
  if (!value) return '';
  const when = endOfDay ? `${value}T23:59:59` : `${value}T00:00:00`;
  const date = new Date(when);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function detailHref(role: string | undefined, issueId: string): string {
  if (role === 'AUTHORITY') return `/department/issues/${issueId}`;
  if (role === 'ADMIN') return `/dashboard/issues/${issueId}`;
  return `/my-reports/${issueId}`;
}

/**
 * The civic map workspace: filters → server-scoped /api/map → status-colored
 * markers + selection detail panel. Everything rendered reflects rows the
 * server actually authorized for the signed-in role.
 */
export function CivicMap() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [department, setDepartment] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<IssueListItem | null>(null);
  const [view, setView] = useState<MapView>('markers');

  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (status) params.set('status', status);
  if (priority) params.set('priority', priority);
  if (from) params.set('from', toDateParam(from, false));
  if (to) params.set('to', toDateParam(to, true));
  if (department) params.set('department', department);
  const query = params.toString();

  const { data, error, isLoading, mutate } = useSWR<ApiMapResponse>(
    `/api/map?${query}`,
    fetcher,
    { refreshInterval: 60000 },
  );

  const isAdmin = role === 'ADMIN';
  const { data: deptData } = useSWR<{ authorities: Array<{ id: string; name: string }> }>(
    isAdmin ? '/api/admin/departments' : null,
    fetcher,
    { refreshInterval: 60000 },
  );

  const located = data?.issues.filter((i) => i.latitude != null && i.longitude != null) ?? [];
  const selected = useMemo(
    () => data?.issues.find((i) => i.id === selectedId) ?? null,
    [data, selectedId],
  );

  const presentLegend = useMemo(() => {
    const present = new Set((data?.issues ?? []).map((i) => displayStatusToKey(i.displayStatus)));
    return LEGEND_ORDER.filter((key) => present.has(key));
  }, [data]);

  const hasFilters = Boolean(category || status || priority || from || to || department);
  const clearFilters = () => {
    setCategory('');
    setStatus('');
    setPriority('');
    setFrom('');
    setTo('');
    setDepartment('');
    setSelectedId(null);
    setFocus(null);
  };

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} options={CATEGORY_SELECT_OPTIONS}>
              <option value="">All categories</option>
              {CATEGORY_SELECT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={STATUS_OPTIONS}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} options={PRIORITY_OPTIONS}>
              <option value="">All priorities</option>
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Input
              type="date"
              label="Reported from"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full"
            />
            <div className="min-w-0">
              <Input
                type="date"
                label="Reported to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full"
              />
            </div>
            {isAdmin ? (
              <Select label="Department" value={department} onChange={(e) => setDepartment(e.target.value)} options={deptData?.authorities ? deptData.authorities.map((a) => ({ value: a.id, label: a.name })) : []}>
                <option value="">All departments</option>
              </Select>
            ) : (
              <div className="flex items-end">
                {hasFilters ? (
                  <Button variant="outline" size="sm" className="w-full justify-center" onClick={clearFilters}>
                    <X className="w-4 h-4" aria-hidden="true" />
                    Clear
                  </Button>
                ) : (
                  <p className="text-xs text-neutral-400 pb-2">
                    {data?.scope ? SCOPE_META[data.scope].hint : 'Loading scope…'}
                  </p>
                )}
              </div>
            )}
          </div>
          {hasFilters && isAdmin && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {data?.total ?? 0} matching {data?.total === 1 ? 'report' : 'reports'}
              </p>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4" aria-hidden="true" />
                Clear filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {error && <ErrorState onRetry={() => mutate()} />}
      {isLoading && !data && !error && <LoadingBlock rows={3} />}

      {data && !error && (
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Map + legend */}
          <div className="lg:col-span-2 space-y-4 min-w-0">
            <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border overflow-hidden" padding="none">
              <div className="relative h-[400px] md:h-[520px]">
                <CivicMapInner
                  issues={data.issues}
                  selectedId={selectedId}
                  focus={focus}
                  onSelectImage={setSelectedId}
                  view={view}
                />

                {/* View toggle: markers vs. density heatmap */}
                <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 rounded-full bg-white/95 dark:bg-dark-bg/95 border border-neutral-200 dark:border-dark-border p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setView('markers')}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      view === 'markers'
                        ? 'bg-brand-600 text-white'
                        : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    Markers
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('heatmap')}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      view === 'heatmap'
                        ? 'bg-brand-600 text-white'
                        : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    Heatmap
                  </button>
                </div>
              </div>
            </Card>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1">
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {located.length === 0
                  ? 'No located reports'
                  : `${located.length} located report${located.length === 1 ? '' : 's'} of ${data.total}`}
              </span>
              {presentLegend.map((key) => (
                <span key={key} className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <span
                    className="inline-block rounded-full"
                    style={{ width: 10, height: 10, backgroundColor: STATUS_COLORS[key] }}
                    aria-hidden="true"
                  />
                  {key
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, (c) => c.toUpperCase())}
                </span>
              ))}
            </div>
          </div>

          {/* Right: selection detail + report list */}
          <div className="space-y-4 min-w-0">
            {selected ? (
              <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                <CardHeader className="flex flex-row items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle as="h2" className="text-lg flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-brand-600 dark:text-brand-400">
                        {selected.publicId}
                      </span>
                    </CardTitle>
                    <p className="text-sm text-neutral-700 dark:text-neutral-200 mt-1 line-clamp-2">{selected.title}</p>
                  </div>
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-800"
                    onClick={() => {
                      setSelectedId(null);
                      setFocus(null);
                    }}
                    aria-label="Deselect report"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant="status" status={selected.displayStatus} size="sm" />
                    <Badge variant="priority" priority={selected.priority ?? 0} size="sm" />
                  </div>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500 dark:text-neutral-400">Category</dt>
                      <dd className="font-medium text-neutral-900 dark:text-white text-right">{selected.categoryLabel}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500 dark:text-neutral-400">Area</dt>
                      <dd className="font-medium text-neutral-900 dark:text-white text-right">{selected.location ?? 'Not provided'}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500 dark:text-neutral-400">Coordinates</dt>
                      <dd className="font-mono text-xs text-neutral-900 dark:text-white">
                        {selected.latitude != null && selected.longitude != null
                          ? `${Number(selected.latitude).toFixed(4)}, ${Number(selected.longitude).toFixed(4)}`
                          : '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500 dark:text-neutral-400">Reported</dt>
                      <dd className="text-neutral-900 dark:text-white">{selected.timeLabel}</dd>
                    </div>
                    {selected.promiseDeadline && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-neutral-500 dark:text-neutral-400">Promise deadline</dt>
                        <dd className="text-neutral-900 dark:text-white">
                          {new Date(selected.promiseDeadline).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </dd>
                      </div>
                    )}
                  </dl>
                  <Button className="w-full mt-4" asChild>
                    <Link href={detailHref(role, selected.id)}>
                      View Report <ExternalLink className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-white">Select a report</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        Click a marker or a report below to inspect its full detail.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle as="h2" className="text-base">
                  {SCOPE_META[data.scope]?.title ?? 'Reports on the map'}
                </CardTitle>
                <span className="text-xs text-neutral-500">{data.total}</span>
              </CardHeader>
              <CardContent className="p-2">
                {data.issues.length === 0 ? (
                  <EmptyState
                    icon={MapPin}
                    title="Nothing to map"
                    description={hasFilters ? 'No reports match these filters.' : 'No located reports in your scope yet.'}
                  />
                ) : (
                  <ul className="max-h-[420px] overflow-y-auto divide-y divide-neutral-100 dark:divide-dark-border">
                    {data.issues.map((issue) => (
                      <li key={issue.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(issue.id);
                            setFocus(issue);
                          }}
                          className={`w-full text-left flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-dark-bg transition-colors ${selectedId === issue.id ? 'bg-brand-50/70 dark:bg-brand-900/20' : ''}`}
                        >
                          <span
                            className="inline-block rounded-full shrink-0"
                            style={{
                              width: 10,
                              height: 10,
                              backgroundColor:
                                STATUS_COLORS[displayStatusToKey(issue.displayStatus)] ??
                                STATUS_COLORS.active,
                            }}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-mono text-xs font-bold text-neutral-900 dark:text-white">
                              {issue.publicId}
                            </span>
                            <span className="block text-xs text-neutral-500 truncate">{issue.title}</span>
                          </span>
                          <span className="text-[11px] text-neutral-400 shrink-0">{issue.timeLabel}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}