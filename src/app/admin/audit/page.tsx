'use client';

import useSWR from 'swr';
import { ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { TableFrame } from '@/components/dashboard/TableFrame';
import { EmptyState } from '@/components/dashboard/EmptyState';
import type { AuditLogItem } from '@/lib/issues/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AdminAudit() {
  const { data, error, isLoading, mutate } = useSWR<{ logs: AuditLogItem[]; total: number }>(
    '/api/admin/audit',
    fetcher,
    { refreshInterval: 30000 },
  );

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        kicker="Admin workspace"
        title="Audit Trail"
        description="Immutable record of status changes, verifications, escalations and every audited business action. Newest first."
      />

      <div className="rounded-xl border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card overflow-hidden">
        <TableFrame
          columns={[
            { key: 'time', label: 'Time' },
            { key: 'issue', label: 'Report' },
            { key: 'action', label: 'Action' },
            { key: 'entity', label: 'Entity' },
            { key: 'actor', label: 'Actor' },
          ]}
          isLoading={isLoading}
          error={Boolean(error)}
          onRetry={mutate}
          empty={Boolean(!isLoading && !error && (data?.logs.length ?? 0) === 0)}
        >
          {(data?.logs ?? []).map((log) => (
            <tr key={log.id} className="hover:bg-neutral-50 dark:hover:bg-dark-bg/60 transition-colors">
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
            </tr>
          ))}
        </TableFrame>
        {(data?.logs.length ?? 0) > 0 && (
          <div className="px-4 py-3 border-t border-neutral-200 dark:border-dark-border text-xs text-neutral-500">
            Showing the most recent {data?.logs.length} of {data?.total} records. The full trail accrues in the database without pruning.
          </div>
        )}
        {!isLoading && !error && (data?.logs.length ?? 0) === 0 && (
          <EmptyState icon={ShieldCheck} title="No audit records yet" description="Every audited action on the platform will appear here." />
        )}
      </div>
    </div>
  );
}