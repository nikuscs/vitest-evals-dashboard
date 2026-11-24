import { LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { useId, useRef } from 'react';
import { cn } from './cn';
import { MOTION } from './motion.constants';
import type { KeyboardEvent, ReactNode } from 'react';

interface SegmentedControlOption<Value extends string> {
  value: Value;
  label: ReactNode;
  disabled?: boolean;
}

interface SegmentedControlProps<Value extends string> {
  options: SegmentedControlOption<Value>[];
  value: Value;
  onValueChange: (value: Value) => void;
  label: string;
  className?: string;
}

export function SegmentedControl<Value extends string>({ options, value, onValueChange, label, className }: SegmentedControlProps<Value>) {
  const id = useId();
  const reduced = useReducedMotion();
  const track = useRef<HTMLDivElement>(null);
  const enabled = options.filter((option) => !option.disabled);
  const selectedIndex = Math.max(0, enabled.findIndex((option) => option.value === value));

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = enabled.length - 1;
    const next = selectedIndex === last ? 0 : selectedIndex + 1;
    const previous = selectedIndex === 0 ? last : selectedIndex - 1;
    const targets = new Map([['ArrowRight', next], ['ArrowDown', next], ['ArrowLeft', previous], ['ArrowUp', previous], ['Home', 0], ['End', last]]);
    const target = targets.get(event.key);
    const option = target === undefined ? undefined : enabled[target];

    if (!option) {
      return;
    }

    event.preventDefault();
    onValueChange(option.value);
    track.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(option.value)}"]`)?.focus({ preventScroll: true });
  };

  return (
    <fieldset aria-label={label} className={cn('inline-flex max-w-full min-w-0 shrink rounded-(--radius-control) border bg-muted', className)}>
      <LayoutGroup id={id}>
        <div className="isolate flex min-w-0 [scrollbar-width:none] gap-0.5 overflow-x-auto rounded-[inherit] p-[3px]" ref={track}>
          {options.map((option) => {
            const selected = option.value === value;

            return (
              <button
                aria-pressed={selected}
                className="relative h-[calc(var(--control-height-sm)-8px)] shrink-0 cursor-pointer rounded-[calc(var(--radius-control)-4px)] px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-muted-foreground aria-pressed:text-foreground"
                data-value={option.value}
                disabled={option.disabled}
                key={option.value}
                onClick={() => onValueChange(option.value)}
                onKeyDown={onKeyDown}
                tabIndex={selected ? 0 : -1}
                type="button"
              >
                {selected
                  ? (<motion.span
                    aria-hidden="true"
                    className="absolute inset-0 -z-10 rounded-[inherit] border bg-card shadow-[0_1px_2px_oklch(0%_0_0/0.035)]"
                    layoutDependency={value}
                    layoutId="selection"
                    transition={reduced ? { duration: 0 } : MOTION.spring.morph}
                  />
                  ) : null}
                <span className="relative z-10 inline-flex items-center gap-1.5">{option.label}</span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>
    </fieldset>
  );
}
