import { CalendarDays, ChevronRight, ClipboardCheck, Coins, Cpu, GitBranch, GitCommitHorizontal, ListChecks, Pin, Scale, Sparkles } from 'lucide-react';
import { modelFamily, modelLabel, money } from '#/shared/report.ts';
import { Badge } from './ui/badge';
import { cn } from './ui/cn';
import type { JudgeKind } from '#/shared/report.ts';
import type { CaseChange, CaseStatus, RunSummary } from '#/shared/report.types.ts';

const isClaude = (model?: string) => !model || /claude|sonnet|haiku|opus/i.test(model);

// The tinted circle behind a model's mark: Anthropic's colour for Claude, neutral for any other model.
export const modelTint = (model?: string) => (isClaude(model) ? 'bg-[#d97757]/14 text-[#c96442] dark:text-[#e08a6c]' : 'bg-muted text-muted-foreground');

// Claude models get the Anthropic mark; any other model a plain chip icon in neutral colours.
export function ModelMark({ className, model }: { className?: string; model?: string }) {
  if (!isClaude(model)) {
    return <Cpu aria-label={model} className={cn('size-3.5', className, 'text-muted-foreground dark:text-muted-foreground')} />;
  }

  return (
    <svg aria-label="Anthropic" className={cn('size-3.5', className)} fill="currentColor" role="img" viewBox="0 0 24 24">
      <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
    </svg>
  );
}

export function ModelChip({ model, className }: { model: string; className?: string }) {
  const id = model.split('@')[0] ?? model;
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full border bg-card pr-2.5 pl-1 text-xs whitespace-nowrap', className)} title={model}>
      <span className={cn('grid size-4 place-items-center rounded-full', modelTint(id))}><ModelMark className="size-2.5" model={id} /></span>
      {modelLabel(id)}
    </span>
  );
}

export function ModelChips({ models }: { models: string[] }) {
  return <span className="flex flex-wrap gap-1">{models.map((model) => <ModelChip key={model} model={model} />)}</span>;
}

export function familyName(family: string) {
  return family.charAt(0).toUpperCase() + family.slice(1);
}

const DOT: Record<CaseStatus, { className: string; label: string }> = {
  passed: { className: 'bg-success', label: 'Passed' },
  failed: { className: 'bg-destructive', label: 'Failed' },
  running: { className: 'animate-pulse bg-info', label: 'Running' },
  queued: { className: 'border-[1.5px] border-dashed border-muted-foreground/60', label: 'Waiting' },
  skipped: { className: 'bg-muted-foreground/20', label: 'Not run' },
};

export function Dot({ status, className }: { status?: CaseStatus; className?: string }) {
  const dot = DOT[status ?? 'skipped'];
  return <span className={cn('inline-block size-2 shrink-0 rounded-full transition-colors duration-300', dot.className, className)} title={dot.label} />;
}

export function StatusMark({ status, className }: { status?: CaseStatus; className?: string }) {
  return <span className={cn('grid size-5 place-items-center', className)}><Dot status={status} /></span>;
}

const CHANGE: Record<CaseChange, { label: string; variant: 'danger' | 'success' | 'neutral' | 'info' } | undefined> = {
  worse: { label: 'Worse', variant: 'danger' },
  fixed: { label: 'Fixed', variant: 'success' },
  new: { label: 'New', variant: 'info' },
  'same-fail': { label: 'Still failing', variant: 'neutral' },
  'same-pass': undefined,
  pending: undefined,
};

export function ChangeBadge({ change }: { change: CaseChange }) {
  const meta = CHANGE[change];
  return meta ? <Badge variant={meta.variant}>{meta.label}</Badge> : null;
}

export function rate(passed: number, total: number) {
  return total ? (passed / total) * 100 : 0;
}

export function Delta({ value, className }: { value: number; className?: string }) {
  const rounded = Math.round(value);

  if (!rounded) {
    return <Badge className={className}>Same</Badge>;
  }

  return (
    <Badge className={className} variant={rounded > 0 ? 'success' : 'danger'} title="Change in the share of cases that passed">
      {rounded > 0 ? '+' : '−'}{Math.abs(rounded)}%
    </Badge>
  );
}

export function PassBar({ passed, failed, className }: { passed: number; failed: number; className?: string }) {
  const total = passed + failed;
  return (
    <span className={cn('flex h-1.5 w-20 overflow-hidden rounded-full bg-muted', className)}>
      <span className="h-full bg-success/80 transition-[width] duration-500" style={{ width: `${total ? (passed / total) * 100 : 0}%` }} />
      <span className="h-full bg-destructive/80 transition-[width] duration-500" style={{ width: `${total ? (failed / total) * 100 : 0}%` }} />
    </span>
  );
}

export function LiveDot({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-info">
      <span className="relative flex size-1.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-info opacity-60" /><span className="relative inline-flex size-1.5 rounded-full bg-info" /></span>
      {label}
    </span>
  );
}

export function RunState({ run }: { run: RunSummary }) {
  if (run.state === 'running') {
    return <LiveDot label={`Running · ${run.total} done`} />;
  }

  if (run.state === 'failed') {
    return <Badge variant="danger">Did not finish</Badge>;
  }

  return null;
}

export function when(iso: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

const JUDGE: Record<JudgeKind, { icon: typeof Scale; label: string; hint: string; className: string }> = {
  factuality: {
    icon: Scale,
    label: 'Factuality',
    hint: 'A judge model checks the answer against an expected answer',
    className: 'bg-[color-mix(in_oklab,var(--series-2)_14%,transparent)] text-(--series-2)',
  },
  rubric: { icon: ClipboardCheck, label: 'Rubric', hint: 'A judge model scores the answer against a written rubric', className: 'bg-warning/12 text-warning' },
  judge: { icon: Sparkles, label: 'Judge', hint: 'A judge model scores the answer', className: 'bg-info/12 text-info' },
  rules: { icon: ListChecks, label: 'Rules', hint: 'Checked by code, with no judge model', className: 'bg-muted text-muted-foreground' },
};

export function JudgeIcon({ kind, withLabel, className }: { kind: JudgeKind; withLabel?: boolean; className?: string }) {
  const meta = JUDGE[kind];
  const Icon = meta.icon;
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5', className)} title={`${meta.label}: ${meta.hint}`}>
      <span className={cn('grid size-5 place-items-center rounded-md', meta.className)}><Icon className="size-3" /></span>
      {withLabel ? <span className="text-xs text-muted-foreground">{meta.label}</span> : null}
    </span>
  );
}

export function Spent({ cost }: { cost?: number }) {
  if (cost === undefined) {
    return null;
  }
  return (
    <span
      className="inline-flex h-6 items-center gap-1.5 rounded-full bg-warning/12 pr-2.5 pl-1.5 text-xs font-medium text-[color-mix(in_oklab,var(--warning)_80%,var(--foreground))] tabular-nums"
      title="Estimated model cost of this run, from models.dev list prices"
    >
      <span className="grid size-4 place-items-center rounded-full bg-warning/20"><Coins className="size-2.5" /></span>
      {money(cost)} spent
    </span>
  );
}

export function BaselineBadge() {
  return <Badge className="h-6 px-2.5 text-xs" variant="info"><Pin /> Baseline</Badge>;
}

// When and from which checkout a run came. Runs from before this was recorded show only the date.
export function RunOrigin({ run, className }: { run: Pick<RunSummary, 'createdAt' | 'git'>; className?: string }) {
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground', className)}>
      <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />{when(run.createdAt)}</span>
      {run.git ? (
        <>
          <span className="inline-flex min-w-0 items-center gap-1.5" title="Branch"><GitBranch className="size-3.5 shrink-0" /><span className="max-w-[16rem] truncate text-foreground/80">{run.git.branch}</span></span>
          <span className="inline-flex items-center gap-1.5" title="Commit"><GitCommitHorizontal className="size-3.5" />{run.git.commit}</span>
          {run.git.dirty
            ? <Badge title="The checkout had changes that were not committed, so this commit alone does not reproduce the run." variant="warning">Uncommitted changes</Badge>
            : null}
        </>
      ) : null}
    </span>
  );
}

// One pill per model of a run, showing which baseline model it replaces: model-a-1 › model-a-2.
export function ModelShifts({ models, from = [], className }: { models: string[]; from?: string[]; className?: string }) {
  const id = (model: string) => model.split('@')[0] ?? model;
  return (
    <span className={cn('flex flex-wrap gap-1', className)}>
      {models.map((model) => {
        const before = from.find((item) => modelFamily(id(item)) === modelFamily(id(model)));
        const changed = before && id(before) !== id(model);
        return (
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full border bg-card pr-2.5 pl-1 text-xs whitespace-nowrap" key={model} title={changed
            ? `${id(before)} replaced by ${id(model)}`
            : id(model)}>
            <span className={cn('grid size-4 place-items-center rounded-full', modelTint(id(model)))}><ModelMark className="size-2.5" model={id(model)} /></span>
            {changed ? (
              <>
                <span className="text-muted-foreground">{modelLabel(id(before))}</span>
                <ChevronRight className="size-3 text-muted-foreground/70" />
              </>
            ) : null}
            <span className={changed ? 'font-medium text-foreground' : undefined}>{modelLabel(id(model))}</span>
          </span>
        );
      })}
    </span>
  );
}
