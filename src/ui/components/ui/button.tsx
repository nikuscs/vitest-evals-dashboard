import { cva } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { Slot } from 'radix-ui';
import * as React from 'react';
import { cn } from './cn';
import type { VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40',
        outline: 'border-border bg-card hover:bg-accent',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'text-foreground/80 hover:bg-accent hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-8 px-3',
        xs: "h-6 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-7 gap-1.5 px-2.5',
        lg: 'h-(--control-height-sm) px-4',
        icon: 'size-8',
        'icon-xs': "size-6 [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-7',
        'icon-lg': 'size-(--control-height-sm)',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

function Button(
  {
    className,
    variant = 'default',
    size = 'default',
    asChild = false,
    pending = false,
    disabled,
    children,
    ...props
  }: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    pending?: boolean
  },
) {
  const Comp = asChild ? Slot.Root : 'button';
  const busy = pending && !asChild;

  return (
    <Comp
      aria-busy={busy || undefined}
      data-pending={busy || undefined}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      disabled={busy || disabled}
      className={cn(buttonVariants({ variant, size, className: cn(busy && 'disabled:opacity-70 [&>svg:not([data-spinner])]:hidden', className) }))}
      {...props}
    >
      {busy ? (
        <>
          <LoaderCircle aria-hidden="true" className="animate-spin" data-spinner />
          {children}
        </>
      ) : children}
    </Comp>
  );
}

export { Button, buttonVariants };
