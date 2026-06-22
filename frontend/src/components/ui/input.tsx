import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md border border-border bg-slate px-3 py-1 text-sm text-ink placeholder:text-ink/35 outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ice disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
