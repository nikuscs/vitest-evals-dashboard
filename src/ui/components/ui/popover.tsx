import { Popover as PopoverPrimitive } from 'radix-ui';
import { Fragment } from 'react';
import { cn } from './cn';
import type { ComponentProps } from 'react';

function Popover(props: ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger(props: ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

// `inline` keeps the content in place instead of portalling it, so it scrolls inside a sheet or dialog.
function PopoverContent(
  { className, align = 'center', sideOffset = 6, inline = false, ...props }: ComponentProps<typeof PopoverPrimitive.Content> & { inline?: boolean },
) {
  const Wrap = inline ? Fragment : PopoverPrimitive.Portal;
  return (
    <Wrap>
      <PopoverPrimitive.Content
        align={align}
        className={cn(
          'z-50 w-80 max-w-[calc(100vw-20px)] origin-(--radix-popover-content-transform-origin) rounded-(--radius-panel) border bg-(--surface-raised) p-4 text-popover-foreground shadow-(--shadow-floating) outline-hidden data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-98 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-97',
          className,
        )}
        data-slot="popover-content"
        sideOffset={sideOffset}
        {...props}
      />
    </Wrap>
  );
}

export { Popover, PopoverContent, PopoverTrigger };
