'use client';

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { TableFrame, Pagination } from '@/components/dashboard/TableFrame';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  roleLabel: string;
  karmaScore: number;
  createdAt: string;
  timeLabel: string;
  reportsCount: number;
  notificationsUnread: number;
}

const ROLE_FILTERS = [
  { value: '', label: 'All roles' },
  { value: 'CITIZEN', label: 'Citizens' },
  { value: 'AUTHORITY', label: 'Authorities' },
  { value: 'ADMIN', label: 'Admins' },
];

const ROLE_BADGE: Record<string, string> = {
  CITIZEN: 'active',
  AUTHORITY: 'verificationPending',
  ADMIN: 'brokenPromise',
};

export default function AdminUsers() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);

  const query = new URLSearchParams({ q, role, page: String(page) });
  const { data, error, isLoading, mutate } = useSWR<{ users: AdminUser[]; total: number; pageCount: number }>(
    `/api/admin/users?${query}`,
    fetcher,
    { keepPreviousData: true },
  );

  const onQ = (value: string) => {
    setQ(value);
    setPage(1);
  };
  const onRole = (value: string) => {
    setRole(value);
    setPage(1);
  };
  const onPage = useCallback((next: number) => setPage(next), []);

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        kicker="Admin workspace"
        title="Users"
        description="Every account on the platform, with live report and notification counts."
      />

      <div className="mb-5 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => onQ(e.target.value)}
            placeholder="Search name or email…"
            className="w-full rounded-lg border border-neutral-300 dark:border-dark-border bg-white dark:bg-dark-bg-card pl-9 pr-3 py-2 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label="Search users"
          />
        </div>
        <select
          value={role}
          onChange={(e) => onRole(e.target.value)}
          className="rounded-lg border border-neutral-300 dark:border-dark-border bg-white dark:bg-dark-bg-card px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          aria-label="Filter by role"
        >
          {ROLE_FILTERS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card overflow-hidden">
        <TableFrame
          columns={[
            { key: 'name', label: 'User' },
            { key: 'role', label: 'Role' },
            { key: 'reports', label: 'Reports' },
            { key: 'unread', label: 'Unread' },
            { key: 'karma', label: 'Karma' },
            { key: 'joined', label: 'Joined' },
          ]}
          isLoading={isLoading}
          error={Boolean(error)}
          onRetry={mutate}
          empty={Boolean(!isLoading && !error && (data?.users.length ?? 0) === 0)}
          emptyTitle="No users match"
          emptyDescription="Adjust the search or role filter."
          footer={
            data && (
              <Pagination page={page} pageCount={data.pageCount} total={data.total} onChange={onPage} />
            )
          }
        >
          {(data?.users ?? []).map((user) => (
            <tr key={user.id} className="hover:bg-neutral-50 dark:hover:bg-dark-bg/60 transition-colors">
              <td className="px-4 py-3">
                <p className="text-sm font-medium text-neutral-900 dark:text-white">{user.name ?? '—'}</p>
                <p className="text-xs text-neutral-500">{user.email}</p>
              </td>
              <td className="px-4 py-3">
                <Badge variant="status" status={ROLE_BADGE[user.role] ?? 'active'} size="sm">{user.roleLabel}</Badge>
              </td>
              <td className="px-4 py-3">
                <span className="font-mono text-sm text-neutral-800 dark:text-neutral-200">{user.reportsCount}</span>
              </td>
              <td className="px-4 py-3">
                <span className="font-mono text-sm text-neutral-800 dark:text-neutral-200">{user.notificationsUnread}</span>
              </td>
              <td className="px-4 py-3">
                <span className="font-mono text-sm text-neutral-800 dark:text-neutral-200">{user.karmaScore}</span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="text-xs text-neutral-500">{user.timeLabel}</span>
              </td>
            </tr>
          ))}
        </TableFrame>
      </div>
    </div>
  );
}