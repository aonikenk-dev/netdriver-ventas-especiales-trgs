import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-md px-2 py-0.5 font-medium', {
  variants: {
    variant: {
      default: 'bg-slate text-ink border border-border',
      pendiente: 'status-badge status-badge--pendiente',
      enviando: 'status-badge status-badge--enviando',
      ok: 'status-badge status-badge--ok',
      error: 'status-badge status-badge--error',
      impreso: 'status-badge status-badge--impreso',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
