'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Mail, CheckCircle2, ShieldCheck, User, Building2, Landmark } from 'lucide-react';

const ROLE_OPTIONS = [
  {
    value: 'CITIZEN',
    label: 'Citizen',
    description: 'Report civic issues and track progress in your ward.',
    icon: User,
    privileged: false,
  },
  {
    value: 'AUTHORITY',
    label: 'Municipal Department',
    description: 'Operate a department and resolve assigned reports.',
    icon: Building2,
    privileged: true,
  },
  {
    value: 'ADMIN',
    label: 'Administrator',
    description: 'Manage the platform, departments, and users.',
    icon: Landmark,
    privileged: true,
  },
] as const;

export function LoginForm({ mode = 'login' }: { mode?: 'login' | 'register' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('CITIZEN');
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDevLink(null);

    const normalized = email.trim().toLowerCase();

    try {
      // Self-service signup: record an ADMIN-gated role request BEFORE the
      // magic-link sign-in so the account is created with roleStatus=PENDING.
      if (mode === 'register' && role !== 'CITIZEN') {
        const reg = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalized, requestedRole: role }),
        });
        if (!reg.ok) {
          const body = await reg.json().catch(() => ({}));
          setError(body?.error?.message ?? 'Could not submit the role request.');
          setLoading(false);
          return;
        }
      }

      const result = await signIn('email', {
        email: normalized,
        redirect: false,
        callbackUrl,
      });
      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setSent(true);
      setLoading(false);

      // Development convenience: surface the magic link when SMTP is absent.
      if (process.env.NODE_ENV !== 'production') {
        const res = await fetch(`/api/auth/dev/magic-link?email=${encodeURIComponent(normalized)}`);
        if (res.ok) {
          const body = (await res.json()) as { url: string };
          setDevLink(body.url);
        }
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="font-display text-xl font-semibold text-neutral-900 dark:text-white mb-2">
            Check your inbox
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
            A {mode === 'register' ? 'verification' : 'sign-in'} link was sent to{' '}
            <span className="font-medium text-neutral-900 dark:text-white">{email}</span>.
          </p>
          <p className="text-xs text-neutral-500">
            The link expires shortly. {mode === 'register' ? 'First sign-in creates your account automatically.' : 'No account? One is created automatically on first sign-in.'}
          </p>

          {mode === 'register' && role !== 'CITIZEN' && (
            <div className="mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/40 text-left">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Role request submitted for approval
              </p>
              <p className="text-xs text-neutral-600 dark:text-neutral-300">
                You can sign in as a citizen now. Your requested "
                {ROLE_OPTIONS.find((o) => o.value === role)?.label}" role is
                pending review by an administrator.
              </p>
            </div>
          )}

          {devLink && (
            <div className="mt-6 p-4 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 text-left">
              <p className="text-xs font-semibold text-brand-700 dark:text-brand-300 mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Development preview (no SMTP configured)
              </p>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">
                Open the real one-time token link directly:
              </p>
              <a
                href={devLink}
                className="text-xs font-mono text-brand-600 dark:text-brand-400 break-all underline"
              >
                {devLink}
              </a>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => router.push('/')}>
              Back to Home
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setSent(false);
                setEmail('');
              }}
            >
              Send Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
      <CardContent className="p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            id="login-email"
            label="Email address"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            leftIcon={<Mail className="w-4 h-4" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error ?? undefined}
          />
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          {mode === 'register' && (
            <fieldset>
              <legend className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-2">
                Account type
              </legend>
              <div className="space-y-2">
                {ROLE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = role === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRole(opt.value)}
                      aria-pressed={active}
                      className={`w-full flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                        active
                          ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20'
                          : 'border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card hover:border-neutral-300'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          active
                            ? 'bg-brand-600 text-white'
                            : 'bg-neutral-100 dark:bg-dark-bg text-neutral-500 dark:text-neutral-400'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900 dark:text-white">
                          {opt.label}
                          {opt.privileged && (
                            <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                              approval required
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">
                          {opt.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                Department and Admin accounts are activated only after an
                administrator approves your request.
              </p>
            </fieldset>
          )}
          <Button type="submit" size="lg" fullWidth loading={loading}>
            {loading
              ? 'Sending link…'
              : mode === 'register'
                ? 'Create my account — send magic link'
                : 'Send Magic Link'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}