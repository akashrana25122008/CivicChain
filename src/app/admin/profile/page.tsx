'use client';

import { useSession, signOut } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { LogOut, Shield, Mail, User as UserIcon } from 'lucide-react';

function initialsOf(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return 'AD';
}

export default function AdminProfilePage() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Admin workspace"
        title="Profile & Settings"
        description="Manage your administrator account and preferences."
      />

      <div className="grid md:grid-cols-2 gap-6">
        {/* Profile Card */}
        <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
          <CardHeader>
            <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
              <UserIcon className="w-4 h-4" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <Avatar size="lg" fallback={initialsOf(user?.name, user?.email)} />
              <div>
                <p className="text-lg font-display font-bold text-neutral-900 dark:text-white">
                  {user?.name || 'Administrator'}
                </p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">{user?.email}</p>
                <Badge variant="status" status="resolved" size="sm" className="mt-1.5">
                  Administrator
                </Badge>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-neutral-100 dark:border-dark-border">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-neutral-400" />
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Email</p>
                  <p className="text-sm font-medium text-neutral-900 dark:text-white">{user?.email || 'Not set'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-neutral-400" />
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Role</p>
                  <p className="text-sm font-medium text-neutral-900 dark:text-white">Administrator</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions Card */}
        <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
          <CardHeader>
            <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => signOut({ callbackUrl: '/' })}
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
