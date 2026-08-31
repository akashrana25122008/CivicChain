'use client';

import useSWR from 'swr';
import { useCallback, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface Profile {
  name: string;
  email: string;
  role: string;
}

interface ProfileResponse {
  profile: Profile;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const ROLE_LABELS: Record<string, string> = {
  CITIZEN: 'Citizen Reporter',
  AUTHORITY: 'Authority',
  ADMIN: 'Administrator',
};

export function ProfilePanel() {
  const { data, mutate, isLoading } = useSWR<ProfileResponse>(
    '/api/me/profile',
    fetcher,
  );
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const profile = data?.profile;
  const displayName = name ?? profile?.name ?? '';

  const onNameChange = useCallback((value: string) => {
    setName(value);
    setStatus('idle');
  }, []);

  const save = useCallback(async () => {
    if (name === null || name === profile?.name) return;
    setSaving(true);
    setStatus('idle');
    try {
      const res = await fetch('/api/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      const result = (await res.json()) as ProfileResponse;
      await mutate(result, false);
      setStatus('saved');
      setName(result.profile.name);
    } catch {
      setStatus('error');
    } finally {
      setSaving(false);
    }
  }, [name, profile, mutate]);

  const dirty = name !== null && name !== profile?.name;

  return (
    <div className="space-y-4">
      <Input label="Full Name" value={displayName} onChange={(e) => onNameChange(e.target.value)} />
      <Input label="Email" value={profile?.email ?? '…'} type="email" disabled />
      <div>
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Role</p>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          {profile ? (ROLE_LABELS[profile.role] ?? profile.role) : '…'}
        </span>
        <p className="text-xs text-neutral-500 mt-1.5">
          Assigned to your account. Contact an administrator to change it.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={save} loading={saving} disabled={!dirty}>
          Save Changes
        </Button>
        {isLoading && !profile ? (
          <span className="text-sm text-neutral-500">Loading…</span>
        ) : status === 'saved' ? (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved ✓</span>
        ) : status === 'error' ? (
          <span className="text-sm text-red-600 dark:text-red-400">Could not save. Try again.</span>
        ) : null}
      </div>
    </div>
  );
}
