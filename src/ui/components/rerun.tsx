import { Ellipsis, RotateCw } from 'lucide-react';
import { caseCost, judgeScore, money } from '#/shared/report.ts';
import { toast, useActions, useStore } from '../store';
import { Dot } from './evals';
import { Button } from './ui/button';
import { cn } from './ui/cn';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import type { CaseComparison, CaseResult } from '#/shared/report.types.ts';

export type Side = 'before' | 'after';

export interface RerunTargets {
  before?: string;
  after: string;
  // Runs that live elsewhere (Braintrust) can be read, not run again.
  readOnly?: boolean;
}

const TIMES = [1, 3, 5];

export function useRerun(targets: RerunTargets) {
  const { rerun } = useActions();
  return async (rows: CaseComparison[], sides: Side[], times: number) => {
    // Each side re-runs a case on its own model, which can differ from the other side's.
    const casesOf = (side: Side) => rows.map((row) => ({
      caseId: row.caseId,
      family: (side === 'before' ? row.before?.family : row.after?.family) ?? row.family,
    }));

    const used = sides.flatMap((side) => {
      const target = targets[side];
      return target ? [{ target, cases: casesOf(side) }] : [];
    });

    const queued = await Promise.all(used.map(({ target, cases }) => rerun(target, { cases, times })));

    if (queued.some((result) => !result)) {
      return;
    }

    const count = rows.length * used.length * times;
    toast(`Queued ${count} ${count === 1 ? 'case' : 'cases'}. Results show up as they finish.`);
  };
}

export const isBusy = (attempts: CaseResult[]) => attempts.some((result) => result.status === 'running' || result.status === 'queued');

export function Dots({ attempts, className }: { attempts: CaseResult[]; className?: string }) {
  const passed = attempts.filter((result) => result.status === 'passed').length;
  const done = attempts.filter((result) => result.status === 'passed' || result.status === 'failed').length;

  if (!attempts.length) {
    return <Dot className={className} />;
  }

  return (
    <span className={cn('inline-flex items-center gap-[3px]', className)} title={`${passed} of ${done} passed`}>
      {attempts.map((result) => <Dot key={result.id} status={result.status} />)}
    </span>
  );
}

function estimate(rows: CaseComparison[], sides: Side[], times: number, prices: Parameters<typeof caseCost>[1]) {
  let total = 0;

  for (const row of rows) {
    for (const side of sides) {
      const attempts = side === 'before' ? row.beforeAttempts : row.afterAttempts;

      const costs = attempts.map((result) => caseCost(result, prices))
        .filter((value): value is number => value !== undefined);

      if (costs.length) {
        total += costs.reduce((sum, value) => sum + value, 0) / costs.length;
      }
    }
  }

  return total * times;
}

interface SideCellProps {
  row: CaseComparison;
  side: Side;
  targets: RerunTargets;
}

export function SideCell({ row, side, targets }: SideCellProps) {
  const run = useRerun(targets);
  const attempts = side === 'before' ? row.beforeAttempts : row.afterAttempts;

  if (!targets[side] || !attempts.length) {
    return <span className="flex justify-center"><Dot /></span>;
  }

  const busy = isBusy(attempts);
  const score = judgeScore(attempts);
  const other = judgeScore(side === 'before' ? row.afterAttempts : row.beforeAttempts);
  const better = score === undefined || other === undefined || Math.round(score * 100) === Math.round(other * 100) ? undefined : score > other;

  const scoreText = score === undefined ? null : (
    <span className={cn('ml-1.5 text-xs tabular-nums', better === true ? 'font-medium text-success' : 'text-muted-foreground')} title="Average judge score">
      {Math.round(score * 100)}%
    </span>
  );

  if (targets.readOnly) {
    return <span className="mx-auto flex h-7 items-center justify-center px-1.5"><Dots attempts={attempts} />{scoreText}</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={busy}>
        <button
          className="mx-auto flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 transition-colors enabled:hover:bg-muted disabled:cursor-progress data-[state=open]:bg-muted"
          onClick={(event) => event.stopPropagation()}
          title={busy ? 'Running…' : 'Run this case again'}
          type="button"
        >
          <Dots attempts={attempts} />
          {score === undefined ? null : (
            <span className={cn('ml-1.5 text-xs tabular-nums', better === true
              ? 'font-medium text-success'
              : 'text-muted-foreground')} title="Average judge score">
              {Math.round(score * 100)}%
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Run again · {side === 'before' ? 'baseline' : 'this run'}</DropdownMenuLabel>
        {TIMES.map((times) => (
          <DropdownMenuItem key={times} onSelect={() => void run([row], [side], times)}>
            <RotateCw /> {times === 1 ? 'Once more' : `${times} more times`}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface RerunMenuProps {
  rows: CaseComparison[];
  targets: RerunTargets;
  label?: string;
}

export function RerunMenu({ rows, targets, label }: RerunMenuProps) {
  const run = useRerun(targets);
  const { prices } = useStore();

  if (targets.readOnly) {
    return null;
  }

  const compared = Boolean(targets.before);

  const options: { sides: Side[]; text: string }[] = compared
    ? [{
      sides: ['before', 'after'],
      text: 'Both sides',
    }, {
      sides: ['before'],
      text: 'Baseline only',
    }, {
      sides: ['after'],
      text: 'This run only',
    }]
    : [{
      sides: ['after'],
      text: 'This run',
    }];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {label ? (
          <Button disabled={!rows.length} onClick={(event) => event.stopPropagation()} size="sm" variant="outline"><RotateCw /> {label}</Button>
        ) : (
          <button
            className="grid size-7 place-items-center rounded-full text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100 data-[state=open]:bg-muted data-[state=open]:opacity-100"
            onClick={(event) => event.stopPropagation()}
            title="Run again"
            type="button"
          >
            <Ellipsis className="size-4" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56" onClick={(event) => event.stopPropagation()}>
        {options.map((option, index) => (
          <div key={option.text}>
            {index ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{option.text}</DropdownMenuLabel>
            {TIMES.map((times) => (
              <DropdownMenuItem key={times} onSelect={() => void run(rows, option.sides, times)}>
                <RotateCw /> {times === 1 ? 'Run once more' : `Run ${times} more times`}
                <span className="ml-auto pl-4 text-xs text-muted-foreground tabular-nums">≈ {money(estimate(rows, option.sides, times, prices))}</span>
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
