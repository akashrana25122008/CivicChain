'use client';

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { Search, ShieldCheck, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { TableFrame, Pagination } from '@/components/dashboard/TableFrame';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  roleLabel: string;
  requestedRole: string | null;
  roleStatus: string;
  active: boolean;
  authority: { id: string; name: string; department: string } | null;
  karmaScore: number;
  createdAt: string;
  timeLabel: string;
  reportsCount: number;
  notificationsUnread: number;
}

interface Department {
  id: string;
  name: string;
  department: string;
}

const ROLE_LABEL: Record<string, string> = {
  CITIZEN: 'Citizen',
  AUTHORITY: 'Municipal Department',
  ADMIN: 'Administrator',
};

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
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const query = new URLSearchParams({ q, role, page: String(page) });
  const { data, error, isLoading, mutate } = useSWR<{ users: AdminUser[]; total: number; pageCount: number }>(
    `/api/admin/users?${query}`,
    fetcher,
    { keepPreviousData: true },
  );

  const { data: pendingData, mutate: mutatePending } = useSWR<{ users: AdminUser[]; departments: Department[] }>(
    '/api/admin/users?pending=true&pageSize=100',
    fetcher,
  );
  const pending = pendingData?.users ?? [];
  const departments = pendingData?.departments ?? [];

  const onQ = (value: string) => {
    setQ(value);
    setPage(1);
  };
  const onRole = (value: string) => {
    setRole(value);
    setPage(1);
  };
  const onPage = useCallback((next: number) => setPage(next), []);

  const review = async (
    id: string,
    action: 'approve' | 'reject' | 'deactivate' | 'activate',
    extra?: { authorityId?: string; departmentName?: string },
  ) => {
    setBusyUserId(id);
    setActionError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, ...extra }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(body?.error?.message ?? 'Action failed.');
        return;
      }
      mutate();
      mutatePending();
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        kicker="Admin workspace"
        title="Users"
        description="Every account on the platform, with live report and notification counts."
      />

      {pending.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-900/10 overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-2 border-b border-amber-200/70 dark:border-amber-900/40">
            <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
              Pending role approvals ({pending.length})
            </h2>
            <span className="text-xs text-neutral-500">Department and Admin requests awaiting review.</span>
          </div>
          <div className="divide-y divide-amber-200/40 dark:divide-amber-900/30">
            {pending.map((user) => (
              <PendingRequest
                key={user.id}
                user={user}
                departments={departments}
                onApprove={review}
              />
            ))}
          </div>
        </div>
      )}

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
        {actionError && (
          <div className="px-4 py-3 border-b border-neutral-200 dark:border-dark-border text-sm text-red-600 dark:text-red-400">
            {actionError}
          </div>
        )}
        <TableFrame
          columns={[
            { key: 'name', label: 'User' },
            { key: 'role', label: 'Role' },
            { key: 'status', label: 'Status' },
            { key: 'reports', label: 'Reports' },
            { key: 'unread', label: 'Unread' },
            { key: 'karma', label: 'Karma' },
            { key: 'joined', label: 'Joined' },
            { key: 'actions', label: 'Actions' },
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
                {user.active ? (
                  <Badge variant="status" status="active" size="sm">Active</Badge>
                ) : (
                  <Badge variant="status" status="brokenPromise" size="sm">Deactivated</Badge>
                )}
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
              <td className="px-4 py-3">
                <Button
                  size="sm"
                  variant={user.active ? 'ghost' : 'secondary'}
                  disabled={busyUserId === user.id}
                  onClick={() => review(user.id, user.active ? 'deactivate' : 'activate')}
                  className={user.active ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}
                >
                  {busyUserId === user.id ? (
                    <Check className="w-3.5 h-3.5 mr-1" style={{ opacity: 0.4 }} />
                  ) : user.active ? (
                    <X className="w-3.5 h-3.5 mr-1" />
                  ) : (
                    <Check className="w-3.5 h-3.5 mr-1" />
                  )}
                  {user.active ? 'Deactivate' : 'Reactivate'}
                </Button>
              </td>
            </tr>
          ))}
        </TableFrame>
      </div>
    </div>
  );
}

function PendingRequest({
  user,
  departments,
  onApprove,
}: {
  user: AdminUser;
  departments: Department[];
  onApprove: (id: string, action: 'approve' | 'reject', extra?: { authorityId?: string; departmentName?: string }) => void;
}) {
  const [authorityId, setAuthorityId] = useState('');
  const [newDept, setNewDept] = useState(false);
  const [deptName, setDeptName] = useState('');

  const isAuthority = user.requestedRole === 'AUTHORITY';

  const approveExtra =
    isAuthority && !newDept
      ? { authorityId: authorityId || departments[0]?.id }
      : isAuthority && newDept
        ? { departmentName: deptName }
        : undefined;

  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-3 px-5 py-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-900 dark:text-white">
          {user.name ?? user.email}
          <span className="ml-2 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            wants {ROLE_LABEL[user.requestedRole ?? ''] ?? user.requestedRole}
          </span>
        </p>
        <p className="text-xs text-neutral-500 mt-0.5">{user.email}</p>

        {isAuthority && (
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
            {!newDept ? (
              <select
                value={authorityId}
                onChange={(e) => setAuthorityId(e.target.value)}
                className="rounded-lg border border-neutral-300 dark:border-dark-border bg-white dark:bg-dark-bg-card px-3 py-1.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                aria-label="Link department"
              >
                {departments.length === 0 && <option value="">No departments yet</option>}
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            ) : (
              <input
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder="New department name"
                className="rounded-lg border border-neutral-300 dark:border-dark-border bg-white dark:bg-dark-bg-card px-3 py-1.5 text-xs text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                aria-label="New department name"
              />
            )}
            <button
              type="button"
              onClick={() => { setNewDept((v) => !v); setDeptName(''); }}
              className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
            >
              {newDept ? 'Link an existing department' : 'Create a new department'}
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 lg:shrink-0">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onApprove(user.id, 'approve', approveExtra)}
        >
          <Check className="w-3.5 h-3.5 mr-1" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onApprove(user.id, 'reject')}
          className="text-red-600 dark:text-red-400"
        >
          <X className="w-3.5 h-3.5 mr-1" />
          Reject
        </Button>
      </div>
    </div>
  );
}