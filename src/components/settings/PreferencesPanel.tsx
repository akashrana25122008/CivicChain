'use client';

import useSWR from 'swr';
import { useCallback, useState, type ComponentType } from 'react';
import { Select } from '@/components/ui/Input';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, type ThemeValue } from '@/components/providers/ThemeProvider';

interface Preferences {
  theme: ThemeValue;
  language: string;
  weeklyDigest: boolean;
  reportUpdates: boolean;
}

interface PreferencesResponse {
  preferences: Preferences;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी (Hindi)' },
  { value: 'mr', label: 'मराठी (Marathi)' },
  { value: 'gu', label: 'ગુજરાતી (Gujarati)' },
  { value: 'ta', label: 'தமிழ் (Tamil)' },
  { value: 'te', label: 'తెలుగు (Telugu)' },
];

async function persist(patch: Record<string, unknown>) {
  const res = await fetch('/api/me/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to save preference');
  return res.json() as Promise<PreferencesResponse>;
}

interface ThemeOption {
  value: ThemeValue;
  label: string;
  Icon: ComponentType<{ className?: string }>;
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'LIGHT', label: 'Light', Icon: Sun },
  { value: 'DARK', label: 'Dark', Icon: Moon },
  { value: 'SYSTEM', label: 'System', Icon: Monitor },
];

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-900 dark:text-white">{label}</p>
        <p className="text-xs text-neutral-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`Toggle ${label}`}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
          checked ? 'bg-brand-500' : 'bg-neutral-300 dark:bg-neutral-700'
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'left-6' : 'left-1'
          }`}
        />
      </button>
    </div>
  );
}

export function PreferencesPanel() {
  const { theme, setTheme } = useTheme();
  const { data, mutate, isLoading } = useSWR<PreferencesResponse>(
    '/api/me/preferences',
    fetcher,
  );
  const [error, setError] = useState<string | null>(null);

  const prefs = data?.preferences;

  const update = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!prefs) return;
      setError(null);
      const optimistic = {
        preferences: { ...prefs, ...patch },
      };
      await mutate(optimistic, false);
      try {
        const result = await persist(patch);
        await mutate(result, false);
      } catch {
        setError('Could not save that preference. Please try again.');
        await mutate();
      }
    },
    [prefs, mutate],
  );

  const selectTheme = useCallback(
    async (next: ThemeValue) => {
      setTheme(next); // apply immediately via provider
      await update({ theme: next });
    },
    [setTheme, update],
  );

  return (
    <div className="space-y-5">
      {isLoading && !data ? (
        <div className="space-y-3">
          <div className="h-12 rounded-xl bg-neutral-100 dark:bg-dark-border animate-pulse" />
          <div className="h-12 rounded-xl bg-neutral-100 dark:bg-dark-border animate-pulse" />
        </div>
      ) : (
        <>
          <div>
            <p className="text-sm font-medium text-neutral-900 dark:text-white mb-1.5">Theme</p>
            <div className="flex gap-2">
              {THEME_OPTIONS.map((opt) => {
                const Icon = opt.Icon;
                const active = theme === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => selectTheme(opt.value)}
                    aria-pressed={active}
                    className={`flex-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      active
                        ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300 dark:border-brand-400'
                        : 'border-neutral-200 dark:border-dark-border text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 inline-block mr-1.5 -mt-0.5" aria-hidden="true" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-neutral-500 mt-1.5">
              Choose how CivicChain looks to you. &ldquo;System&rdquo; follows your device theme.
            </p>
          </div>

          <div>
            <Select
              label="Language"
              options={LANGUAGE_OPTIONS}
              value={prefs?.language ?? 'en'}
              onChange={(e) => {
                const next = e.target.value;
                void update({ language: next });
              }}
            />
            <p className="text-xs text-neutral-500 mt-1.5">
              Your preferred interface language.
            </p>
          </div>

          <Toggle
            label="Report updates"
            description="Notify me when the status of reports I submitted changes."
            checked={prefs?.reportUpdates ?? true}
            onChange={(v) => update({ reportUpdates: v })}
          />
          <Toggle
            label="Weekly digest"
            description="A periodic summary of what's happening in your area."
            checked={prefs?.weeklyDigest ?? false}
            onChange={(v) => update({ weeklyDigest: v })}
          />
        </>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
