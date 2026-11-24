import { ChevronDown, GitCompareArrows, Pin } from 'lucide-react';
import { modelLabel } from '#/shared/report.ts';
import { when } from './evals';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import type { RunSummary } from '#/shared/report.types.ts';

const NONE = 'none';

interface CompareMenuProps {
  runId: string;
  runs: RunSummary[];
  value?: RunSummary;
  onChange: (id: string | null) => void;
}

// Picks the run this page compares against: the baseline by default, any other run, or nothing.
export function CompareMenu({ runId, runs, value, onChange }: CompareMenuProps) {
  const options = runs.filter((run) => run.id !== runId && run.state !== 'running');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex h-8 items-center gap-2 rounded-full border bg-card pr-2.5 pl-3 text-sm transition-colors hover:bg-muted/60 data-[state=open]:bg-muted/60"
          type="button"
        >
          <GitCompareArrows className="size-3.5 text-muted-foreground" />
          {value ? (
            <>
              <span className="text-muted-foreground">Compared with</span>
              <span className="max-w-[18rem] truncate font-medium">{value.label}</span>
              {value.baseline ? <Pin className="size-3 text-info" /> : null}
            </>
          ) : <span className="text-muted-foreground">Not compared. Pick a run</span>}
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[min(28rem,var(--radix-dropdown-menu-content-available-height))] w-96 overflow-y-auto">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Compare this run with</DropdownMenuLabel>
        <DropdownMenuRadioGroup onValueChange={(id) => onChange(id === NONE ? null : id)} value={value?.id ?? NONE}>
          {options.map((run) => (
            <DropdownMenuRadioItem className="py-2" key={run.id} value={run.id}>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium">{run.label}</span>
                  {run.baseline
                    ? <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-info"><Pin className="size-3" /> Baseline</span>
                    : null}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {run.models
                    .map((model) => modelLabel(model.split('@')[0] ?? model))
                    .join(' + ')} · {when(run.createdAt)}{run.git ? ` · ${run.git.branch}` : ''}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
          {options.length ? <DropdownMenuSeparator /> : null}
          <DropdownMenuRadioItem value={NONE}>Nothing, show this run alone</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
