'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { cn, getStatusColor, getPriorityColor, getPriorityLabel } from '@/lib/utils';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'status' | 'priority' | 'outline' | 'dot';
  status?: string;
  priority?: number;
  size?: 'sm' | 'md' | 'lg';
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', status, priority, size = 'md', children, ...props }, ref) => {
    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-sm',
      lg: 'px-3 py-1.5 text-base',
    };

    const baseStyles = 'inline-flex items-center gap-1.5 font-medium rounded-full';

    let variantStyles = '';
    let content = children;

    if (variant === 'status' && status) {
      variantStyles = getStatusColor(status);
      content = status.charAt(0).toUpperCase() + status.slice(1).replace(/([A-Z])/g, ' $1');
    } else if (variant === 'priority' && priority !== undefined) {
      variantStyles = getPriorityColor(priority);
      content = getPriorityLabel(priority);
    } else if (variant === 'outline') {
      variantStyles = 'border border-neutral-300 text-neutral-700 dark:border-dark-border-hover dark:text-neutral-300';
    } else if (variant === 'dot') {
      variantStyles = 'px-2 py-1';
    } else {
      variantStyles = 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300';
    }

    return (
      <span
        ref={ref}
        className={cn(baseStyles, sizes[size], variantStyles, className)}
        {...props}
      >
        {variant === 'dot' && (
          <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
        )}
        {content}
      </span>
    );
  }
);
Badge.displayName = 'Badge';

export { Badge };