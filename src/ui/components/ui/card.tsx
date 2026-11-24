import { cva } from 'class-variance-authority';
import * as React from 'react';
import { cn } from './cn';
import type { VariantProps } from 'class-variance-authority';

const cardVariants = cva('flex flex-col rounded-(--radius-panel) border bg-card text-card-foreground', {
  variants: {
    variant: { default: 'gap-4 pt-4 pb-5', flush: 'overflow-hidden' },
  },
  defaultVariants: { variant: 'default' },
});

function Card({ className, variant, ...props }: React.ComponentProps<'div'> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  );
}

export {
  Card,
};
