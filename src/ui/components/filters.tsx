import { ChevronDown, X } from 'lucide-react';
import { cn } from './ui/cn';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import type { ReactNode } from 'react';

interface FilterOption<Value extends string> {
  value: Value;
  label: string;
  icon?: ReactNode;
  hint?: ReactNode;
}

interface FilterProps<Value extends string> {
  label: string;
  value: Value | null;
  options: FilterOption<Value>[];
  onValueChange: (value: Value | null) => void;
}

// A dashed pill that turns solid with "Label: value" once something is picked.
export function FilterPill<Value extends string>({ label, value, options, onValueChange }: FilterProps<Value>) {
  const current = options.find((option) => option.value === value);
  const tone = current ? 'border-solid bg-card text-foreground' : 'border-dashed border-input text-foreground/75 hover:text-foreground';
  return (
    <span className={cn('inline-flex h-8 shrink-0 items-center rounded-full border text-[13px] transition-colors', tone)}>
      <DropdownMenu>
        <DropdownMenuTrigger className={cn('inline-flex h-full items-center gap-1.5 pl-3 font-medium outline-none', current ? 'pr-1' : 'pr-2.5')}>
          {current?.icon}
          {current ? <span><span className="font-normal text-muted-foreground">{label}:</span> {current.label}</span> : label}
          {current ? null : <ChevronDown className="size-3.5 opacity-70" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 min-w-52 overflow-y-auto">
          <DropdownMenuRadioGroup onValueChange={(next) => onValueChange(options.find((option) => option.value === next)?.value ?? null)} value={value ?? ''}>
            <DropdownMenuRadioItem value="">Any</DropdownMenuRadioItem>
            {options.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.icon}
                {option.label}
                {option.hint === undefined ? null : <span className="ml-auto pl-4 text-xs text-muted-foreground tabular-nums">{option.hint}</span>}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {current ? (
        <button aria-label={`Clear ${label}`} className="mr-1 grid size-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onClick={() => onValueChange(
          null,
        )} type="button">
          <X className="size-3.5" />
        </button>
      ) : null}
    </span>
  );
}
