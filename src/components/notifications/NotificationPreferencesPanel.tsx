'use client';

import useSWR from 'swr';
import { useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Inbox, Mail, Smartphone } from 'lucide-react';

/**
 * Real, persisted notification channel preferences (Phase 13).
 *
 * Three channels: In-App (the in-platform feed), Email (delivery when SMTP is
 * configured), Push (honestly flagged as requiring a provider). Every toggle is
 * authenticated and persisted via `PUT /api/notifications/preferences`, keyed
 * off the session user — never the browser.
 */

type PreferenceMap = Record<'IN_APP' | 'EMAIL' | 'PUSH', boolean>;

interface PreferencesResponse {
  preferences: PreferenceMap;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const CHANNEL_DEFS: Array<{
  key: keyof PreferenceMap;
  label: string;
  description: string;
  icon: typeof Inbox;
  note?: string;
}> = [
  {
    key: 'IN_APP',
    label: 'In-app notifications',
    description: 'Updates shown in your CivicChain notification feed.',
    icon: Inbox,
  },
  {
    key: 'EMAIL',
    label: 'Email notifications',
    description: 'Mirror key updates to your email address.',
    icon: Mail,
    note: 'Delivered only when SMTP (EMAIL_SERVER) is configured.',
  },
  {
    key: 'PUSH',
    label: 'Push notifications',
    description: 'Real-time push delivery to your device.',
    icon: Smartphone,
    note: 'Requires a push provider — not yet configured.',
  },
];

export function NotificationPreferencesPanel() {
  const { data, mutate, isLoading } = useSWR<PreferencesResponse>(
    '/api/notifications/preferences',
    fetcher,
  );
  const preferences = data?.preferences;

  const setChannel = useCallback(
    async (channel: keyof PreferenceMap, enabled: boolean) => {
      if (!preferences) return;
      const optimistic = {
        preferences: { ...preferences, [channel]: enabled },
      };
      await mutate(optimistic, false);
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: { [channel]: enabled } }),
      });
      if (!res.ok) {
        await mutate();
      }
    },
    [preferences, mutate],
  );

  const summary = useMemo(() => {
    if (!preferences) return 'Loading…';
    const enabled = CHANNEL_DEFS.filter((d) => preferences[d.key]).length;
    return `${enabled} of ${CHANNEL_DEFS.length} channels enabled`;
  }, [preferences]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">{summary}</p>
      {isLoading && !data ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-neutral-100 dark:bg-dark-border animate-pulse" />
          ))}
        </div>
      ) : (
        CHANNEL_DEFS.map((def) => {
          const Icon = def.icon;
          const enabled = !preferences || preferences[def.key] === true;
          return (
            <div
              key={def.key}
              className="flex items-center justify-between gap-4 p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border"
            >
              <div className="min-w-0 flex items-start gap-3">
                <span
                  className={cn(
                    'shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center',
                    enabled
                      ? 'bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300'
                      : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800',
                  )}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-white">
                    {def.label}
                  </p>
                  <p className="text-xs text-neutral-500">{def.description}</p>
                  {def.note && (
                    <p className="text-[11px] text-neutral-400 mt-0.5">{def.note}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={`Toggle ${def.label}`}
                onClick={() => setChannel(def.key, !enabled)}
                className={cn(
                  'relative w-11 h-6 rounded-full transition-colors shrink-0',
                  enabled ? 'bg-brand-500' : 'bg-neutral-300 dark:bg-neutral-700',
                )}
              >
                <span
                  className={cn(
                    'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform',
                    enabled ? 'left-6' : 'left-1',
                  )}
                />
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
