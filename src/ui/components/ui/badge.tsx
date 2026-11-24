import { cva } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import * as React from 'react';
import { cn } from './cn';
import type { VariantProps } from 'class-variance-authority';

// Tinted badge: the tone tints the surface (10% light, 12% dark), the text is the tone deepened toward the foreground (the pastel itself in dark), and the icon sits closer to the pure tone.
const badgeVariants = cva(
  'inline-flex min-h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-clip rounded-[5px] border border-transparent bg-[color-mix(in_oklab,var(--badge-tone)_var(--badge-tint),var(--surface))] px-2 align-middle text-[11px] leading-none font-medium tracking-[-0.005em] whitespace-nowrap text-[color-mix(in_oklab,var(--badge-tone)_var(--badge-ink),var(--foreground))] tabular-nums transition-[color,background-color,box-shadow] duration-(--duration-standard) ease-(--ease-standard) outline-none [--badge-ink:84%] [--badge-tint:10%] focus-visible:ring-[3px] focus-visible:ring-ring/50 has-[>svg:first-child]:ps-1.5 motion-reduce:duration-(--duration-instant) dark:[--badge-ink:94%] dark:[--badge-tint:12%] [&>svg]:pointer-events-none [&>svg]:size-3 [&>svg]:shrink-0 [&>svg]:text-[color-mix(in_oklab,var(--badge-tone)_88%,var(--foreground))]',
  {
    variants: {
      variant: {
        neutral: '[--badge-tone:var(--text-secondary)]',
        info: '[--badge-tone:var(--info)]',
        success: '[--badge-tone:var(--success)]',
        warning: '[--badge-ink:76%] [--badge-tone:var(--warning)]',
        danger: '[--badge-tone:var(--danger)]',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

function Badge(
  {
    className,
    variant = 'neutral',
    asChild = false,
    ...props
  }: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean },
) {
  const Comp = asChild ? Slot.Root : 'span';

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
