import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from './cn';
import type { ComponentProps } from 'react';

function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root className={cn('flex min-w-0 flex-col gap-3', className)} data-slot="tabs" {...props} />;
}

function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex w-fit max-w-full min-w-0 [scrollbar-width:none] gap-0.5 overflow-x-auto rounded-(--radius-control) border bg-muted p-[3px]',
        className,
      )}
      data-slot="tabs-list"
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'relative inline-flex h-[calc(var(--control-height-sm)-8px)] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[calc(var(--radius-control)-4px)] border border-transparent px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-[color,background-color,border-color,box-shadow] duration-(--duration-fast) ease-(--ease-standard) outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40 data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-(--shadow-resting) motion-reduce:transition-none',
        className,
      )}
      data-slot="tabs-trigger"
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('min-w-0 outline-none', className)} data-slot="tabs-content" {...props} />;
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
