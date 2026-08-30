'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ArrowRight, LogIn, UserPlus } from 'lucide-react';
import { homeFor } from '@/components/layout/workspaceNav';
import { cn } from '@/lib/utils';

/**
 * Authentication-aware CTA for landing page.
 * Unauthenticated: primary Sign Up, secondary Sign In.
 * Authenticated: Open Dashboard (role-home) + Report Issue.
 */
export function AuthActions({ className }: { className?: string }) {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';
  const isAuthenticated = !!session?.user;
  const role = session?.user?.role;

  if (isLoading) {
    return (
      <div className={cn('flex flex-col sm:flex-row items-center justify-center gap-4', className)}>
        <Button size="lg" disabled className="opacity-50">
          <span className="w-5 h-5 mr-2 animate-spin border-2 border-current border-t-transparent rounded-full" />
          Loading…
        </Button>
        <Button variant="secondary" size="lg" disabled className="opacity-50">
          Loading…
        </Button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={cn('flex flex-col sm:flex-row items-center justify-center gap-4', className)}>
        <Button size="lg" asChild>
          <Link href="/register" className="group">
            <UserPlus className="w-5 h-5 mr-2" />
            Sign Up
            <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </Button>
        <Button variant="secondary" size="lg" asChild>
          <Link href="/login" className="group">
            <LogIn className="w-5 h-5 mr-2" />
            Sign In
            <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col sm:flex-row items-center justify-center gap-4', className)}>
      <Button size="lg" asChild>
        <Link href={homeFor(role)} className="group">
          Open Dashboard
          <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
      </Button>
      <Button variant="secondary" size="lg" asChild>
        <Link href="/report" className="group">
          Report an Issue
          <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
      </Button>
    </div>
  );
}