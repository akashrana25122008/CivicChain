'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Input';
import { NotificationPreferencesPanel } from '@/components/notifications/NotificationPreferencesPanel';
import { User, Bell, Shield, Palette } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white">Settings</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">
          Manage your account and preferences.
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
          <CardHeader>
            <CardTitle as="h2" className="text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-brand-500" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input label="Full Name" placeholder="John Doe" defaultValue="John Doe" />
            <Input label="Email" placeholder="john@example.com" defaultValue="john@example.com" type="email" />
            <Input label="Phone" placeholder="+91 98765 43210" defaultValue="+91 98765 43210" />
            <Select
              label="Role"
              options={[
                { value: 'citizen', label: 'Citizen Reporter' },
                { value: 'authority', label: 'Authority' },
                { value: 'admin', label: 'Administrator' },
              ]}
              defaultValue="citizen"
            />
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
          <CardHeader>
            <CardTitle as="h2" className="text-lg flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-500" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <NotificationPreferencesPanel />
            <p className="text-[11px] text-neutral-400">
              Changes are saved immediately and apply to every notification you
              receive, on all channels.
            </p>
          </CardContent>
        </Card>

        <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
          <CardHeader>
            <CardTitle as="h2" className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-500" />
              Privacy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
              <p className="text-sm font-medium text-neutral-900 dark:text-white">Public Profile</p>
              <p className="text-xs text-neutral-500">Your name and reports are visible to the community</p>
            </div>
            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
              <p className="text-sm font-medium text-neutral-900 dark:text-white">Contact Information</p>
              <p className="text-xs text-neutral-500">Only visible to authorities handling your reports</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}