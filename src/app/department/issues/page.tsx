'use client';

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { TableFrame, Pagination } from '@/components/dashboard/TableFrame';
import { IssueDrawer } from '@/components/dashboard/IssueDrawer';
import { cn } from '@/lib/utils';
import type { IssueListItem } from '@/lib/issues/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'REJECTED', label: 'Rejected' },
];

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'updated', label: 'Recently updated' },
];

export default function DepartmentIssues() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  const query = new URLSearchParams({ q, status, sort, page: String(page) });
  const { data, error, isLoading, mutate } = useSWR<{ issues: IssueListItem[]; total: number; pageCount: number }>(
    `/api/department/issues?${query}`,
    fetcher,
    { keepPreviousData: true },
  );

  const onQ = (value: string) => {
    setQ(value);
    setPage(1);
  };
  const onStatus = (value: string) => {
    setStatus(value);
    setPage(1);
  };
  const onSort = (value: string) => {
    setSort(value);
    setPage(1);
  };
  const onPage = useCallback((next: number) => setPage(next), []);

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        kicker="Department workspace"
        title="Issues Workbench"
        description="Every report routed to your department, with full evidence review and escalation tools."
      />

      <div className="mb-5 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => onQ(e.target.value)}
            placeholder="Search title, ID, location…"
            className="w-full rounded-lg border border-neutral-300 dark:border-dark-border bg-white dark:bg-dark-bg-card pl-9 pr-3 py-2 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label="Search reports"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-neutral-400 hidden sm:block" aria-hidden="true" />
          <select
            value={status}
            onChange={(e) => onStatus(e.target.value)}
            className="rounded-lg border border-neutral-300 dark:border-dark-border bg-white dark:bg-dark-bg-card px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label="Filter by status"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value)}
            className="rounded-lg border border-neutral-300 dark:border-dark-border bg-white dark:bg-dark-bg-card px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label="Sort order"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <CardFrame>
        <TableFrame
          columns={[
            { key: 'id', label: 'Report' },
            { key: 'title', label: 'Issue', className: 'max-w-[280px]' },
            { key: 'category', label: 'Category' },
            { key: 'status', label: 'Status' },
            { key: 'severity', label: 'Severity' },
            { key: 'reporter', label: 'Reporter' },
            { key: 'time', label: 'Reported' },
          ]}
          isLoading={isLoading}
          error={Boolean(error)}
          onRetry={mutate}
          empty={Boolean(!isLoading && !error && (data?.issues.length ?? 0) === 0)}
          emptyTitle="No reports match this view"
          emptyDescription="Adjust the filters, or wait for citizens to route new reports to your department."
          footer={
            data && (
              <Pagination
                page={page}
                pageCount={data.pageCount}
                total={data.total}
                onChange={onPage}
              />
            )
          }
        >
          {(data?.issues ?? []).map((issue) => (
            <tr key={issue.id} onClick={() => setSelected(issue.id)} className="cursor-pointer hover:bg-neutral-50 dark:hover:bg-dark-bg/60 transition-colors">
              <td className="px-4 py-3">
                <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">{issue.publicId}</span>
              </td>
              <td className="px-4 py-3 max-w-[280px]">
                <p className="text-sm text-neutral-800 dark:text-neutral-200 truncate">{issue.title}</p>
                <p className="text-xs text-neutral-500 truncate">{issue.location || 'Location not provided'}</p>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">{issue.categoryLabel}</span>
              </td>
              <td className="px-4 py-3">
                <Badge variant="status" status={issue.displayStatus} size="sm" />
              </td>
              <td className="px-4 py-3">
                {issue.severityLabel ? (
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">{issue.severityLabel}</span>
                ) : (
                  <span className="text-sm text-neutral-400">Pending AI</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">{issue.reporterName ?? '—'}</span>
              </td>
              <td className={cn('px-4 py-3 whitespace-nowrap')}>
                <span className="text-xs text-neutral-500">{issue.timeLabel}</span>
              </td>
            </tr>
          ))}
        </TableFrame>
      </CardFrame>

      <IssueDrawer
        key={selected ?? 'closed'}
        issueId={selected}
        endpoint={selected ? `/api/department/issues/${selected}` : null}
        onClose={() => setSelected(null)}
        onChanged={mutate}
        canUpdateStatus
        canVerify
        canEscalate
      />
    </div>
  );
}

function CardFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card overflow-hidden">
      {children}
    </div>
  );
}