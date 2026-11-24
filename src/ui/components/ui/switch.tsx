import { motion, useReducedMotion } from 'motion/react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { useState } from 'react';
import { cn } from './cn';
import { MOTION } from './motion.constants';
import type { ComponentProps } from 'react';

function Switch({ className, checked, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const stretch = pressed && !reduced && !props.disabled ? 5 : 0;

  return (
    <SwitchPrimitive.Root
      checked={checked}
      className={cn('group inline-flex shrink-0 cursor-pointer items-center outline-none disabled:cursor-not-allowed disabled:opacity-50', className)}
      data-slot="switch"
      onBlur={() => setPressed(false)}
      onPointerDown={() => setPressed(true)}
      onPointerLeave={() => setPressed(false)}
      onPointerUp={() => setPressed(false)}
      {...props}
    >
      <span className="relative isolate flex h-6 w-10.5 items-center rounded-full bg-[oklch(33%_0_0)] p-0.75 transition-colors duration-150 group-hover:bg-[oklch(37%_0_0)] group-focus-visible:ring-2 group-focus-visible:ring-ring/60 group-data-[state=checked]:bg-[oklch(93%_0_0)]">
        <motion.span
          animate={{ x: checked ? 18 - stretch : 0, width: 18 + stretch }}
          className="block h-4.5 rounded-full bg-[oklch(97%_0_0)] shadow-[0_0_0_0.5px_oklch(0%_0_0/0.3),0_1px_2px_oklch(0%_0_0/0.35)] transition-colors duration-200 group-data-[state=checked]:bg-[oklch(19%_0_0)]"
          initial={false}
          transition={reduced
            ? { duration: 0 }
            : {
              x: { type: 'spring', visualDuration: 0.3, bounce: 0 },
              width: MOTION.spring.snappy,
            }}
        />
      </span>
    </SwitchPrimitive.Root>
  );
}

export { Switch };
