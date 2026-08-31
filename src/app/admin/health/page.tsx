'use client';

import useSWR from 'swr';
import { RefreshCw, Database, MapPin, KeyRound, Mail, FolderArchive, Activity, Bell } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { ErrorState } from '@/components/dashboard/ErrorState';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Check = {
  ok: boolean;
  okNonZero?: boolean;
  status?: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'CRITICAL' | 'NOT_CONFIGURED' | 'UNKNOWN';
  error?: string;
  version?: string;
  note?: string;
  writable?: boolean;
  total?: number;
  failed?: number;
  nonInApp?: number;
};

interface HealthData {
  checks: {
    database: Check;
    postgis: Check;
    auth: Check;
    email: Check;
    storage: Check;
    ai: Check;
    notifications: Check;
    redis: Check;
    queue: Check;
    websocket: Check;
  };
  overall: Check;
  totals: {
    users: number;
    issues: number;
    auditLogs: number;
    notificationsUnread: number;
    escalationsOpen: number;
    pendingEvidence: number;
    verifications: number;
  };
}

const CHECK_META: Array<{ key: keyof HealthData['checks']; icon: typeof Database; title: string }> = [
  { key: 'database', icon: Database, title: 'Database connection' },
  { key: 'postgis', icon: MapPin, title: 'PostGIS extension' },
  { key: 'auth', icon: KeyRound, title: 'Auth secret' },
  { key: 'email', icon: Mail, title: 'Email transport' },
  { key: 'storage', icon: FolderArchive, title: 'Evidence storage' },
  { key: 'ai', icon: Activity, title: 'AI classification' },
  { key: 'notifications', icon: Bell, title: 'Notifications' },
  { key: 'redis', icon: Database, title: 'Redis' },
  { key: 'queue', icon: Activity, title: 'Job queue' },
  { key: 'websocket', icon: Activity, title: 'WebSocket' },
];

function checkStatusDark(c: Check): 'resolved' | 'brokenPromise' {
  if (c.status === 'NOT_CONFIGURED') return 'brokenPromise';
  return c.ok ? 'resolved' : 'brokenPromise';
}

export default function AdminHealth() {
  const { data, error, isLoading, mutate } = useSWR<HealthData>(
    '/api/admin/health',
    fetcher,
    { refreshInterval: 60000 },
  );

  const allOk = data?.overall?.ok ?? false;
  const overallStatus = data?.overall?.status ?? 'UNKNOWN';

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        kicker="Admin workspace"
        title="System Health"
        description="Independent probes on each subsystem so a single failure never hides another."
      >
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          <RefreshCw className="w-4 h-4" /> Re-run checks
        </Button>
      </PageHeader>

      {error && <ErrorState onRetry={() => mutate()} />}
      {isLoading && !data && <LoadingBlock rows={4} />}

      {data && (
        <div className="mb-8 flex items-center gap-2">
          <Badge variant="status" status={allOk ? 'resolved' : 'brokenPromise'} size="md">
            {allOk ? 'All checks passing' : overallStatus === 'CRITICAL' ? 'Critical system down' : 'Some checks need attention'}
          </Badge>
          {data?.overall?.note && <span className="text-sm text-neutral-500">{data.overall.note}</span>}
          <span className="text-sm text-neutral-500">probed on demand</span>
        </div>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {CHECK_META.map(({ key, icon: Icon, title }) => {
          const check = data?.checks[key];
          return (
            <Card key={key} variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle as="h2" className="text-base flex items-center gap-2">
                  <Icon className="w-4 h-4 text-neutral-400" /> {title}
                </CardTitle>
                {check && (
                  <Badge variant="status" status={checkStatusDark(check)} size="sm">
                    {check.status === 'NOT_CONFIGURED' ? 'N/A' : check.ok ? 'OK' : 'FAIL'}
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                {!check ? (
                  <div className="h-4 rounded bg-neutral-100 dark:bg-dark-border animate-pulse" />
                ) : check.ok ? (
                  <div className="space-y-1">
                    {key === 'postgis' && check.version && (
                      <p className="text-xs text-neutral-500 font-mono">{check.version}</p>
                    )}
                    {key === 'auth' && check.note && <p className="text-xs text-neutral-500">{check.note}</p>}
                    {key === 'email' && check.note && <p className="text-xs text-neutral-500">{check.note}</p>}
                    {key === 'storage' && check.writable && (
                      <p className="text-xs text-neutral-500">Directory present and writable.</p>
                    )}
                    {!check.note && <p className="text-xs text-neutral-500">Available.</p>}
                  </div>
                ) : (
                  <p className="text-sm text-red-600 dark:text-red-400">{check.error ?? 'Check failed.'}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {data && (
        <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border mt-6">
          <CardHeader>
            <CardTitle as="h2" className="text-lg flex items-center gap-2"><Activity className="w-4 h-4 text-neutral-400" /> Live Totals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Total label="Users" value={data.totals.users} />
              <Total label="Issues" value={data.totals.issues} />
              <Total label="Audit logs" value={data.totals.auditLogs} />
              <Total label="Verifications" value={data.totals.verifications} />
              <Total label="Unread notifications" value={data.totals.notificationsUnread} />
              <Total label="Open escalations" value={data.totals.escalationsOpen} />
              <Total label="Pending evidence" value={data.totals.pendingEvidence} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
      <p className="text-2xl font-display font-bold text-neutral-900 dark:text-white">{value}</p>
      <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
    </div>
  );
}