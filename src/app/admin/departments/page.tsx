'use client';

import useSWR from 'swr';
import { Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { TableFrame } from '@/components/dashboard/TableFrame';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface AuthorityRow {
  id: string;
  name: string;
  department: string;
  jurisdiction: string;
  email: string;
  operator: string | null;
  assigned: number;
  active: number;
  resolved: number;
  rejected: number;
  escalationsOpen: number;
  promisesActive: number;
  promisesBroken: number;
  avgResolutionMinutes: number | null;
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function AdminDepartments() {
  const { data, error, isLoading, mutate } = useSWR<{ authorities: AuthorityRow[] }>(
    '/api/admin/departments',
    fetcher,
    { refreshInterval: 30000 },
  );

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        kicker="Admin workspace"
        title="Departments"
        description="Authorities across the platform with live workload: assigned, active, resolved, escalations and resolution time."
      />

      <div className="rounded-xl border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card overflow-hidden">
        <TableFrame
          columns={[
            { key: 'dept', label: 'Department' },
            { key: 'operator', label: 'Operator' },
            { key: 'assigned', label: 'Assigned' },
            { key: 'active', label: 'Active' },
            { key: 'resolved', label: 'Resolved' },
            { key: 'esc', label: 'Escalations' },
            { key: 'promises', label: 'Promises' },
            { key: 'avg', label: 'Avg Resolution' },
          ]}
          isLoading={isLoading}
          error={Boolean(error)}
          onRetry={mutate}
          empty={Boolean(!isLoading && !error && (data?.authorities.length ?? 0) === 0)}
          emptyTitle="No departments configured"
          emptyDescription="Create an authority record and assign an operator to stand up a department."
        >
          {(data?.authorities ?? []).map((d) => (
            <tr key={d.id} className="hover:bg-neutral-50 dark:hover:bg-dark-bg/60 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">{d.department}</p>
                    <p className="text-xs text-neutral-500">{d.name} · {d.jurisdiction}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <p className="text-sm text-neutral-700 dark:text-neutral-300">{d.operator ?? '—'}</p>
                <p className="text-xs text-neutral-500">{d.email}</p>
              </td>
              <td className="px-4 py-3"><span className="font-mono text-sm">{d.assigned}</span></td>
              <td className="px-4 py-3"><Badge variant="status" status="active" size="sm">{d.active} active</Badge></td>
              <td className="px-4 py-3"><span className="font-mono text-sm text-emerald-600 dark:text-emerald-400">{d.resolved}</span></td>
              <td className="px-4 py-3">
                {d.escalationsOpen > 0 ? (
                  <Badge variant="status" status="brokenPromise" size="sm">{d.escalationsOpen}</Badge>
                ) : (
                  <span className="text-sm text-neutral-400">0</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span className="font-mono text-sm">{d.promisesActive}</span>
                {d.promisesBroken > 0 && (
                  <Badge variant="status" status="brokenPromise" size="sm" className="ml-1.5">{d.promisesBroken} broken</Badge>
                )}
              </td>
              <td className="px-4 py-3"><span className="font-mono text-sm text-neutral-800 dark:text-neutral-200">{formatMinutes(d.avgResolutionMinutes)}</span></td>
            </tr>
          ))}
        </TableFrame>
      </div>
    </div>
  );
}