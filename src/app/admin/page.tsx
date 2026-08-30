'use client';

import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ShieldCheck, Users, MapPin, Database, ScrollText, Bell } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

interface Stats {
  users: number;
  authorities: number;
  issues: number;
  resolved: number;
  auditLogs: number;
  notifications: number;
}

interface AuditResponse {
  logs: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    actor: string | null;
    issueId: string | null;
    issuePublicId: string | null;
    metadata: unknown;
    createdAt: string;
  }>;
  total: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AdminPage() {
  const { data: stats } = useSWR<{ stats: Stats }>('/api/admin/stats', fetcher);
  const { data: audit } = useSWR<AuditResponse>('/api/admin/audit', fetcher, { refreshInterval: 15000 });

  const cards = stats
    ? [
        { label: 'Users', value: stats.stats.users, icon: Users, color: 'text-brand-500', bg: 'bg-brand-50 dark:bg-brand-900/20' },
        { label: 'Issues', value: stats.stats.issues, icon: MapPin, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/20' },
        { label: 'Resolved', value: stats.stats.resolved, icon: Database, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
        { label: 'Authorities', value: stats.stats.authorities, icon: ShieldCheck, color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
        { label: 'Audit Events', value: stats.stats.auditLogs, icon: ScrollText, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
        { label: 'Notifications', value: stats.stats.notifications, icon: Bell, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
      ]
    : [];

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white">Admin Panel</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">
          Platform statistics and the global audit trail. Read-only in Phase 1.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {cards.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} variant="elevated" className="p-4 bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardContent>
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', item.bg)}>
                  <Icon className={cn('w-4 h-4', item.color)} />
                </div>
                <p className="text-2xl font-display font-bold text-neutral-900 dark:text-white">{item.value}</p>
                <p className="text-xs text-neutral-500 mt-1">{item.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Audit Trail{audit ? ` · ${audit.total} events` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!audit ? (
            <div className="px-6 py-10 text-center text-sm text-neutral-500">Loading audit trail…</div>
          ) : audit.logs.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-neutral-500">No audit events recorded.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-dark-border text-left text-xs uppercase text-neutral-500">
                    <th className="px-6 py-3 font-medium">When</th>
                    <th className="px-6 py-3 font-medium">Action</th>
                    <th className="px-6 py-3 font-medium">Entity</th>
                    <th className="px-6 py-3 font-medium">Actor</th>
                    <th className="px-6 py-3 font-medium">Issue</th>
                    <th className="px-6 py-3 font-medium">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-dark-border">
                  {audit.logs.map((log) => (
                    <tr key={log.id} className="hover:bg-neutral-50 dark:hover:bg-dark-bg">
                      <td className="px-6 py-3 text-neutral-500 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                      <td className="px-6 py-3 font-mono text-xs text-brand-600 dark:text-brand-400">{log.action}</td>
                      <td className="px-6 py-3 text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                        {log.entityType}{log.entityId ? `: ${log.entityId.slice(0, 8)}…` : ''}
                      </td>
                      <td className="px-6 py-3 text-neutral-700 dark:text-neutral-300">{log.actor ?? '—'}</td>
                      <td className="px-6 py-3 font-mono text-xs text-neutral-700 dark:text-neutral-300">
                        {log.issuePublicId ?? '—'}
                      </td>
                      <td className="px-6 py-3">
                        <code className="text-[11px] text-neutral-500 font-mono">
                          {log.metadata ? JSON.stringify(log.metadata).slice(0, 60) : '—'}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}