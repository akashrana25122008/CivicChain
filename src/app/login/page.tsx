import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '@/components/auth/LoginForm';
import { Navigation } from '@/components/layout/Navigation';
import { ShieldCheck, LockKeyhole } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to CivicChain with your email.',
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[420px] w-[720px] rounded-full bg-brand-400/20 dark:bg-brand-900/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-accent-300/20 dark:bg-accent-900/20 blur-3xl"
      />
      <Navigation />
      <main className="relative min-h-screen pt-24 pb-16 flex items-center justify-center px-4 md:px-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/25 mb-4">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white mb-2">
              Welcome back to CivicChain
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              Passwordless access via a secure magic link sent to your email.
            </p>
          </div>
          <LoginForm />
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-neutral-400 dark:text-neutral-500">
            <LockKeyhole className="w-3.5 h-3.5" />
            <span>New to CivicChain?</span>
            <Link
              href="/register"
              className="font-medium text-brand-600 dark:text-brand-400 hover:underline"
            >
              Create an account
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}