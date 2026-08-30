import type { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  const Icon = icon;
  return (
    <div className="text-center py-12 px-4">
      {Icon && (
        <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-dark-border mx-auto mb-3 flex items-center justify-center">
          <Icon className="w-6 h-6 text-neutral-400 dark:text-neutral-500" aria-hidden="true" />
        </div>
      )}
      <p className="font-medium text-neutral-700 dark:text-neutral-300">{title}</p>
      {description && <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 max-w-md mx-auto">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}