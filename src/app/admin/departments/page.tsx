'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Building2, Plus, X, Loader2 } from 'lucide-react';
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

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', jurisdiction: '', authorityName: '', authorityEmail: '' });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    setFormSuccess(null);
    try {
      const res = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Creation failed.');
      setForm({ name: '', jurisdiction: '', authorityName: '', authorityEmail: '' });
      setFormSuccess(`Department "${body.department.name}" created.`);
      setShowCreate(false);
      mutate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Creation failed.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        kicker="Admin workspace"
        title="Departments"
        description="Authorities across the platform with live workload: assigned, active, resolved, escalations and resolution time."
      />

      <div className="mb-6 flex items-center justify-between gap-4">
        {formSuccess && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">{formSuccess}</span>
        )}
        <button
          onClick={() => { setShowCreate((s) => !s); setFormError(null); }}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showCreate ? 'Cancel' : 'New department'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={submitCreate} className="mb-6 p-6 rounded-2xl border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card">
          <p className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">Create a department</p>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-neutral-500">Department name *</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="e.g. Water & Sanitation Department"
                className="mt-1 w-full rounded-lg border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-500">Jurisdiction</span>
              <input
                value={form.jurisdiction}
                onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })}
                placeholder="e.g. Ward 4, Ward 5"
                className="mt-1 w-full rounded-lg border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-500">Authority name</span>
              <input
                value={form.authorityName}
                onChange={(e) => setForm({ ...form, authorityName: e.target.value })}
                placeholder="e.g. City Water Works"
                className="mt-1 w-full rounded-lg border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-500">Authority email</span>
              <input
                type="email"
                value={form.authorityEmail}
                onChange={(e) => setForm({ ...form, authorityEmail: e.target.value })}
                placeholder="ops@city.gov"
                className="mt-1 w-full rounded-lg border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card px-3 py-2 text-sm"
              />
            </label>
          </div>
          {formError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{formError}</p>}
          <button
            type="submit"
            disabled={creating}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {creating && <Loader2 className="h-4 w-4 animate-spin" />}
            {creating ? 'Creating…' : 'Create department'}
          </button>
        </form>
      )}

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