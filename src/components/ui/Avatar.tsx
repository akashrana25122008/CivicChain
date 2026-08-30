'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  shape?: 'circle' | 'square';
  status?: 'online' | 'offline' | 'busy' | 'away';
}

const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, size = 'md', shape = 'circle', status, ...props }, ref) => {
    const sizes = {
      xs: 'w-6 h-6 text-xs',
      sm: 'w-8 h-8 text-sm',
      md: 'w-10 h-10 text-base',
      lg: 'w-12 h-12 text-lg',
      xl: 'w-16 h-16 text-xl',
      '2xl': 'w-24 h-24 text-2xl',
    };

    const shapes = {
      circle: 'rounded-full',
      square: 'rounded-lg',
    };

    const statusSizes = {
      xs: 'w-1.5 h-1.5',
      sm: 'w-2 h-2',
      md: 'w-2.5 h-2.5',
      lg: 'w-3 h-3',
      xl: 'w-4 h-4',
      '2xl': 'w-5 h-5',
    };

    const statusColors = {
      online: 'bg-emerald-500',
      offline: 'bg-neutral-400',
      busy: 'bg-red-500',
      away: 'bg-amber-500',
    };

    const getInitials = (name: string) => {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    };

    return (
      <div ref={ref} className={cn('relative inline-flex shrink-0', className)} {...props}>
        <div className={cn(sizes[size], shapes[shape], 'overflow-hidden bg-neutral-200 dark:bg-dark-border-flex items-center justify-center')}>
          {src ? (
            <img src={src} alt={alt || ''} className="w-full h-full object-cover" />
          ) : fallback ? (
            <span className="font-medium text-neutral-600 dark:text-neutral-400">{fallback}</span>
          ) : (
            <span className="font-medium text-neutral-600 dark:text-neutral-400">?</span>
          )}
        </div>
        {status && (
          <span
            className={cn(
              'absolute bottom-0 right-0 border-2 border-white dark:border-dark-bg',
              shapes[shape],
              statusSizes[size],
              statusColors[status]
            )}
            aria-label={`Status: ${status}`}
          />
        )}
      </div>
    );
  }
);
Avatar.displayName = 'Avatar';

interface AvatarGroupProps extends HTMLAttributes<HTMLDivElement> {
  max?: number;
  size?: AvatarProps['size'];
}

const AvatarGroup = forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ className, children, max = 5, size = 'md', ...props }, ref) => {
    const kids = Array.isArray(children) ? children : [children];
    const visible = kids.slice(0, max);
    const remaining = kids.length - max;

    return (
      <div ref={ref} className={cn('flex -space-x-2', className)} {...props}>
        {visible.map((child, index) => (
          <div key={index} className="relative z-[auto]">
            {child}
          </div>
        ))}
        {remaining > 0 && (
          <div className={cn('relative z-0 flex items-center justify-center bg-neutral-100 dark:bg-dark-border text-neutral-600 dark:text-neutral-400 font-medium border-2 border-white dark:border-dark-bg')}>
            +{remaining}
          </div>
        )}
      </div>
    );
  }
);
AvatarGroup.displayName = 'AvatarGroup';

export { Avatar, AvatarGroup };