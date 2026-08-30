'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Mail, CheckCircle2, ShieldCheck } from 'lucide-react';

export function LoginForm({ mode = 'login' }: { mode?: 'login' | 'register' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const [email, setEmail] = useState('');
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
            The link expires shortly. {mode === 'register' ? 'First sign-in creates your CITIZEN account automatically.' : 'No account? One is created automatically on first sign-in.'}
          </p>

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