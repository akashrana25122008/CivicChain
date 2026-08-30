import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/LoginForm';
import { Navigation } from '@/components/layout/Navigation';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to CivicChain with your email.',
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg">
      <Navigation />
      <div className="pt-24 pb-16 min-h-screen flex items-start justify-center px-4 md:px-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white mb-2">
              Sign in to CivicChain
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              Passwordless access via a secure magic link sent to your email.
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}