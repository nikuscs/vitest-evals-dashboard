import * as React from 'react';
import { cn } from './cn';

type InputProps = Omit<React.ComponentProps<'input'>, 'prefix'> & {
  prefix?: React.ReactNode;
};

function Input({ className, type, prefix, ...props }: InputProps) {
  if (prefix === undefined) {
    return (
      <input
        type={type}
        data-slot="input"
        className={cn(
          'h-(--control-height-sm) w-full min-w-0 rounded-(--radius-control) border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
          className,
        )}
        {...props}
      />
    );
  }

  return (
    <span
      data-slot="input-group"
      className={cn(
        'flex h-(--control-height-sm) w-full min-w-0 items-stretch overflow-hidden rounded-(--radius-control) border border-input bg-transparent shadow-xs transition-[color,box-shadow] dark:bg-input/30',
        'has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50',
        'has-[input[aria-invalid=true]]:border-destructive has-[input[aria-invalid=true]]:ring-destructive/20 dark:has-[input[aria-invalid=true]]:ring-destructive/40',
        'has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50',
        className,
      )}
    >
      <span className="flex max-w-1/2 shrink-0 items-center border-r border-input px-3 text-sm text-muted-foreground select-none">
        <span className="truncate">{prefix}</span>
      </span>
      <input
        type={type}
        data-slot="input"
        className="min-w-0 flex-1 bg-transparent px-3 py-1 text-base outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none md:text-sm"
        {...props}
      />
    </span>
  );
}

export { Input };
