'use client';

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { ShieldCheck, Anchor, CheckCircle2, AlertTriangle, Fingerprint, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { TableFrame } from '@/components/dashboard/TableFrame';
import { EmptyState } from '@/components/dashboard/EmptyState';
import type { AuditEventItem } from '@/lib/issues/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface AuditResponse {
  logs: AuditEventItem[];
  total: number;
  actions: string[];
  nextSeq: number | null;
}

interface LedgerVerify {
  valid: boolean;
  depth: number;
  tipAt: string | null;
  summary: {
    count: number;
    genesisOk: boolean;
    tampered: number;
    brokenLinks: number;
    gaps: number;
    firstInvalidSeq: number | null;
  };
}

function hashTrunc(h: string | null | undefined) {
  if (!h) return '—';
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

export default function AdminAudit() {
  const [action, setAction] = useState('ALL');
  const [cursor, setCursor] = useState<number | null>(null);
  const [history, setHistory] = useState<Array<number | null>>([]);

  const query = new URLSearchParams({ action, limit: '50' });
  if (cursor != null) query.set('cursor', String(cursor));
  const url = `/api/admin/audit?${query.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<AuditResponse>(
    url,
    fetcher,
    { refreshInterval: 30000 },
  );

  const [verify, setVerify] = useState<LedgerVerify | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const changeAction = (value: string) => {
    setHistory([]);
    setCursor(null);
    setAction(value);
  };

  const goNext = () => {
    if (data?.nextSeq == null) return;
    setHistory((h) => [...h, cursor]);
    setCursor(data.nextSeq);
  };

  const goPrev = () => {
    const prev = history[history.length - 1];
    if (prev === undefined) return;
    setHistory((h) => h.slice(0, -1));
    setCursor(prev);
  };

  const runVerify = useCallback(async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const res = await fetch('/api/admin/ledger/verify');
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Verification failed');
      setVerify(body);
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  }, []);

  const ledger = verify?.valid ? true : verify ? false : null;
  const hasPrev = history.length > 0;

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        kicker="Admin workspace"
        title="Audit Trail"
        description="Immutable, SHA-256 hash-chained record of every audited business action — status changes, verifications, escalations and more. Newest first."
      />

      <div className="grid gap-4 mb-6 md:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-3">
            <Anchor className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            <span className="font-semibold">Trust ledger</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div>
              <div className="text-2xl font-bold tabular-nums">{verify ? verify.depth : '—'}</div>
              <div className="text-xs text-neutral-500">chain links</div>
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{verify ? verify.depth : '—'}</div>
              <div className="text-xs text-neutral-500">sealed hashes</div>
            </div>
          </div>
        </div>

        <div className={`rounded-xl border p-5 ${ledger === true ? 'border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10' : ledger === false ? 'border-red-500/40 bg-red-50 dark:bg-red-500/10' : 'border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card'}`}>
          <div className="flex items-center gap-2 text-sm mb-3">
            {ledger === true ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : ledger === false ? <AlertTriangle className="h-4 w-4 text-red-600" /> : <Fingerprint className="h-4 w-4 text-brand-600 dark:text-brand-400" />}
            <span className="font-semibold text-neutral-700 dark:text-neutral-200">Chain integrity</span>
          </div>
          {verify === null ? (
            <p className="text-sm text-neutral-500">Run a full-chain verification to recompute every hash and detect tampering.</p>
          ) : verify.valid ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              All {verify.summary.count} records verified. Genesis link valid, zero tampered rows, zero broken links.
            </p>
          ) : (
            <ul className="text-sm text-red-700 dark:text-red-300 space-y-0.5">
              <li>First invalid seq: {verify.summary.firstInvalidSeq ?? '—'}</li>
              <li>{verify.summary.tampered} tampered row(s)</li>
              <li>{verify.summary.brokenLinks} broken link(s)</li>
              <li>{verify.summary.gaps} gap(s)</li>
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card p-5 flex flex-col">
          <div className="text-sm text-neutral-500 mb-3"><span className="font-semibold">Verify</span></div>
          <button
            onClick={runVerify}
            disabled={verifying}
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            <Fingerprint className="h-4 w-4" />
            {verifying ? 'Verifying…' : 'Verify ledger integrity'}
          </button>
          {verifyError && <p className="mt-2 text-xs text-red-600">{verifyError}</p>}
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-neutral-200 dark:border-dark-border">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-neutral-400" />
            <select
              value={action}
              onChange={(e) => changeAction(e.target.value)}
              aria-label="Filter audit records by action"
              className="rounded-lg border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card px-3 py-1.5 text-sm text-neutral-700 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {(['ALL', ...(data?.actions ?? [])] as string[]).map((a) => (
                <option key={a} value={a}>
                  {a === 'ALL' ? 'All actions' : a.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-500">
              {data ? `${data.total.toLocaleString()} record(s)` : '…'}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={goPrev}
                disabled={!hasPrev || isLoading}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 dark:border-dark-border text-neutral-500 hover:bg-neutral-50 dark:hover:bg-dark-bg disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={goNext}
                disabled={data?.nextSeq == null || isLoading}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 dark:border-dark-border text-neutral-500 hover:bg-neutral-50 dark:hover:bg-dark-bg disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <TableFrame
          columns={[
            { key: 'seq', label: '#' },
            { key: 'time', label: 'Time' },
            { key: 'issue', label: 'Report' },
            { key: 'action', label: 'Action' },
            { key: 'entity', label: 'Entity' },
            { key: 'actor', label: 'Actor' },
            { key: 'hash', label: 'Hash' },
          ]}
          isLoading={isLoading}
          error={Boolean(error)}
          onRetry={mutate}
          empty={Boolean(!isLoading && !error && (data?.logs.length ?? 0) === 0)}
        >
          {(data?.logs ?? []).map((log) => (
            <tr key={log.id} className="hover:bg-neutral-50 dark:hover:bg-dark-bg/60 transition-colors">
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="font-mono text-xs text-neutral-500">#{log.seq}</span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="text-xs text-neutral-500">{new Date(log.createdAt).toLocaleString()}</span>
              </td>
              <td className="px-4 py-3">
                <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">{log.issuePublicId ?? '—'}</span>
              </td>
              <td className="px-4 py-3">
                <span className="font-mono text-xs text-neutral-800 dark:text-neutral-200">{log.action}</span>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {log.entityType}{log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ''}
                </span>
              </td>
              <td className="px-4 py-3"><span className="text-sm text-neutral-600 dark:text-neutral-400">{log.actor ?? 'system'}</span></td>
              <td className="px-4 py-3">
                <span className="font-mono text-[10px] text-neutral-500" title={log.hash ?? ''}>{hashTrunc(log.hash)}</span>
              </td>
            </tr>
          ))}
        </TableFrame>
        {data && (data.logs.length ?? 0) > 0 && (
          <div className="px-4 py-3 border-t border-neutral-200 dark:border-dark-border text-xs text-neutral-500">
            Showing the most recent {data.logs.length} of {data.total.toLocaleString()} matching record(s). Each row is chained to its predecessor; the full trail accrues without pruning.
          </div>
        )}
        {!isLoading && !error && (data?.logs.length ?? 0) === 0 && (
          <EmptyState icon={ShieldCheck} title="No audit records yet" description="Every audited action on the platform will appear here." />
        )}
      </div>
    </div>
  );
}