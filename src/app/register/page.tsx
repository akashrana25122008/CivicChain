import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '@/components/auth/LoginForm';
import { Navigation } from '@/components/layout/Navigation';
import { UserPlus, LockKeyhole } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create your CivicChain account. Citizens sign in instantly; Department and Admin requests are reviewed by an administrator.',
};

export default function RegisterPage() {
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
              <UserPlus className="w-7 h-7" />
            </div>
            <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white mb-2">
              Create your CivicChain account
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              Passwordless. Choose an account type — a magic link is sent to
              your email to finish signing up.
            </p>
          </div>
          <LoginForm mode="register" />
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-neutral-400 dark:text-neutral-500">
            <LockKeyhole className="w-3.5 h-3.5" />
            <span>Already have an account?</span>
            <Link
              href="/login"
              className="font-medium text-brand-600 dark:text-brand-400 hover:underline"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}