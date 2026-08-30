import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '@/components/auth/LoginForm';
import { Navigation } from '@/components/layout/Navigation';

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create your CivicChain citizen account with a magic link.',
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg">
      <Navigation />
      <div className="pt-24 pb-16 min-h-screen flex items-start justify-center px-4 md:px-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white mb-2">
              Create your CivicChain account
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              Passwordless. Enter your email — the first sign-in creates your
              CITIZEN account automatically.
            </p>
          </div>
          <LoginForm mode="register" />
          <p className="mt-6 text-center text-sm text-neutral-500">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-brand-600 dark:text-brand-400 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}