import { Filter, PanelRightOpen } from 'lucide-react';
import { HoverCard } from 'radix-ui';
import { judgeKind, modelLabel } from '#/shared/report.ts';
import { ModelMark, ChangeBadge, familyName, JudgeIcon } from './evals';
import { OpenIn } from './open-in';
import { RerunMenu, SideCell } from './rerun';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { cn } from './ui/cn';
import type { CaseComparison } from '#/shared/report.types.ts';
import type { RerunTargets } from './rerun';

export type GroupBy = 'case' | 'model';

export const rowKey = (row: CaseComparison) => `${row.suite}::${row.caseId}::${row.family}`;
const caseKey = (row: CaseComparison) => `${row.suite}::${row.caseId}`;
const GRADER = { factuality: 'Factuality judge', rubric: 'Rubric judge', judge: 'Judge', rules: 'Code checks' } as const;

interface CaseTitleProps {
  row: CaseComparison;
  rows: CaseComparison[];
  test: string | null;
  onOpen: () => void;
  onTest: (caseId: string) => void;
}

// Truncated case name; the hover card has the full name, its ID, area and grader.
function CaseTitle({ row, rows, test, onOpen, onTest }: CaseTitleProps) {
  const kind = judgeKind(rows.flatMap((item) => [...item.beforeAttempts, ...item.afterAttempts]));
  const title = row.title.charAt(0).toUpperCase() + row.title.slice(1);

  const fixed = rows.flatMap((item) => [item.after, item.before])
    .find((result) => result?.fixedModel);

  return (
    <HoverCard.Root closeDelay={80} openDelay={350}>
      <span className="flex min-w-0 items-center gap-2.5">
        <JudgeIcon kind={kind} />
        <HoverCard.Trigger asChild>
          <span className="max-w-[22rem] truncate">{title}</span>
        </HoverCard.Trigger>
        {fixed
          ? <Badge className="shrink-0" title="This test reported a model other than the one the run picked." variant="warning">On {modelLabel(
            fixed.model,
          )}</Badge>
          : null}
        {test === row.caseId ? <Badge className="shrink-0">{row.caseId}</Badge> : null}
      </span>
      <HoverCard.Portal>
        <HoverCard.Content
          align="start"
          className="z-50 w-80 origin-(--radix-hover-card-content-transform-origin) rounded-(--radius-panel) border bg-(--surface-raised) p-0 text-popover-foreground shadow-(--shadow-floating) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-97"
          onClick={(event) => event.stopPropagation()}
          sideOffset={6}
        >
          <div className="flex flex-col gap-2 p-4">
            <span className="text-[13px] leading-snug font-medium">{title}</span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">{row.caseId}</span>
              <span>·</span>
              <span className="capitalize">{row.suite.replaceAll('-', ' ')}</span>
            </span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground"><JudgeIcon kind={kind} />{GRADER[kind]}</span>
            {fixed
              ? <span className="text-xs text-warning">Ran on {modelLabel(fixed.model)}, not the model the run picked.</span>
              : null}
          </div>
          <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
            Open the case in
            <OpenIn caseId={row.caseId} />
          </div>
          <div className="flex gap-1 border-t p-1.5">
            <Button className="flex-1" onClick={onOpen} size="sm" variant="ghost"><PanelRightOpen /> Open</Button>
            <Button className="flex-1" onClick={() => onTest(row.caseId)} size="sm" variant="ghost"><Filter /> {test === row.caseId
              ? 'Clear filter'
              : 'Only this test'}</Button>
          </div>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}

interface CaseTableProps {
  rows: CaseComparison[];
  families: string[];
  compared: boolean;
  groupBy: GroupBy;
  targets: RerunTargets;
  test: string | null;
  empty?: string;
  onOpen: (key: string) => void;
  onTest: (caseId: string) => void;
}

function sidesOf(compared: boolean) {
  return compared ? (['before', 'after'] as const) : (['after'] as const);
}

function templateOf(groupBy: GroupBy, families: string[], compared: boolean) {
  const sides = sidesOf(compared);
  return groupBy === 'model'
    ? { gridTemplateColumns: `minmax(0,1fr) 76px ${sides.map(() => '112px').join(' ')} 128px` }
    : {
      gridTemplateColumns: `minmax(0,1fr) ${families.map(() => sides.map(() => '112px').join(' ')).join(' ')} 150px`,
    };
}

// Column titles; rendered inside the page's sticky toolbar so they stay visible while scrolling.
interface CaseTableHeadProps {
  families: string[];
  compared: boolean;
  groupBy: GroupBy;
  models?: Record<string, { before?: string; after?: string }>;
}

function sideBorder(index: number): string {
  return index === 0 ? 'border-l border-border/60' : 'border-l border-dashed border-border/40';
}

function sideTitle(side: string, compared: boolean): string {
  if (side === 'before') {
    return 'Before';
  }

  return compared ? 'Now' : 'Result';
}

export function CaseTableHead({ families, compared, groupBy, models = {} }: CaseTableHeadProps) {
  const sides = sidesOf(compared);
  const template = templateOf(groupBy, families, compared);

  if (groupBy === 'model') {
    return (
      <div className="grid items-center gap-x-3 border-b px-5 py-2 text-[11px] text-muted-foreground" style={template}>
        <span>Case</span>
        <span>Model</span>
        {compared ? <span className="text-center">Before</span> : null}
        <span className="text-center">{compared ? 'Now' : 'Result'}</span>
        <span />
      </div>
    );
  }

  return (
    <div className="grid items-stretch gap-x-0 border-b px-5 text-[11px] text-muted-foreground" style={template}>
      <span className="row-span-2 self-end pr-3 pb-1.5">Case</span>
      {families.map((family) => (
        <span className="flex items-center justify-center gap-1.5 border-l border-border/60 pt-2 pb-1 font-medium text-foreground/80" key={family} style={{ gridColumn: `span ${sides.length}` }}>
          <ModelMark className="size-3 text-[#c96442] dark:text-[#e08a6c]" model={family} />{familyName(family)}
        </span>
      ))}
      <span className="row-span-2 border-l border-border/60" />
      {families.flatMap((family) => sides.map((side, index) => (
        <span className={cn('flex flex-col items-center pt-0.5 pb-1.5 leading-tight', sideBorder(index))} key={`${family}-${side}`}>
          <span>{sideTitle(side, compared)}</span>
          {models[family]?.[side] ? <span className="font-medium text-foreground/80">{modelLabel(models[family]?.[side] ?? '')}</span> : null}
        </span>
      )))}
    </div>
  );
}

interface GroupProps {
  title: string;
  children: React.ReactNode;
  columns?: { template: React.CSSProperties; families: string[]; sides: number };
}

// An area's title row; in the by-case layout it keeps the column dividers running through it.
function Group({ title, children, columns }: GroupProps) {
  const label = <span className="pt-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{title.replaceAll('-', ' ')}</span>;
  return (
    <div className="border-t border-border/60">
      {columns ? (
        <div className="grid px-5" style={columns.template}>
          {label}
          {columns.families.flatMap((family) => Array.from({ length: columns.sides }, (_, index) => (
            <span className={index === 0 ? 'border-l border-border/60' : 'border-l border-dashed border-border/40'} key={`${family}-${index}`} />
          )))}
          <span className="border-l border-border/60" />
        </div>
      ) : <div className="px-5">{label}</div>}
      {children}
    </div>
  );
}

export function CaseTable({ rows, families, compared, groupBy, targets, test, empty, onOpen, onTest }: CaseTableProps) {
  const sides = sidesOf(compared);
  const suites = [...new Set(rows.map((row) => row.suite))];
  const rowClass = 'group grid w-full cursor-pointer items-center gap-x-3 border-t border-border/40 px-5 py-1.5 text-left transition-colors hover:bg-muted/50';
  // A soft red wash from the left marks rows that got worse.
  const worseClass = 'bg-[linear-gradient(90deg,color-mix(in_oklab,var(--destructive)_7%,transparent),transparent_28%)]';

  if (groupBy === 'model') {
    const template = templateOf(groupBy, families, compared);
    return (
      <>
        {suites.map((suite) => (
          <Group key={suite} title={suite}>
            {rows.filter((row) => row.suite === suite)
              .map((row) => (
                <div className={cn(rowClass, row.change === 'worse' && worseClass)} key={rowKey(row)} onClick={() => onOpen(rowKey(row))} role="button" style={template} tabIndex={0}>
                  <CaseTitle onOpen={() => onOpen(rowKey(row))} onTest={onTest} row={row} rows={[row]} test={test} />
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><ModelMark className="size-3 text-[#c96442] dark:text-[#e08a6c]" model={row.family} />{familyName(
                    row.family,
                  )}</span>
                  {sides.map((side) => <SideCell key={side} row={row} side={side} targets={targets} />)}
                  <span className="flex items-center justify-end gap-1">{compared
                    ? <ChangeBadge change={row.change} />
                    : null}<RerunMenu rows={[row]} targets={targets} /></span>
                </div>
              ))}
          </Group>
        ))}
        {!rows.length ? <p className="border-t px-5 py-12 text-center text-muted-foreground">{empty}</p> : null}
      </>
    );
  }

  const groups = [...new Map(rows.map((row) => [caseKey(row), rows.filter((item) => caseKey(item) === caseKey(row))])).values()];
  const template = templateOf(groupBy, families, compared);
  return (
    <>
      {suites.map((suite) => (
        <Group columns={{ template, families, sides: sides.length }} key={suite} title={suite}>
          {groups.filter((group) => group[0]?.suite === suite)
            .map((group) => {
              const first = group[0];
              const changed = group.find((row) => row.change === 'worse') ?? group.find((row) => row.change === 'fixed') ?? first;
              return (
                <div className={cn(rowClass, 'items-stretch gap-x-0 py-0', group.some((row) => row.change === 'worse') && worseClass)} key={caseKey(first)} onClick={() => onOpen(
                  rowKey(changed),
                )} role="button" style={template} tabIndex={0}>
                  <span className="flex min-w-0 items-center py-1.5 pr-3"><CaseTitle onOpen={() => onOpen(rowKey(changed))} onTest={onTest} row={first} rows={group} test={test} /></span>
                  {families.flatMap((family) => {
                    const row = group.find((item) => item.family === family);
                    return sides.map((side, index) => (
                      <span className={cn('flex items-center justify-center py-1.5', sideBorder(index))} key={`${family}-${side}`}>
                        {row ? <SideCell row={row} side={side} targets={targets} /> : <span className="text-xs text-muted-foreground/40">—</span>}
                      </span>
                    ));
                  })}
                  <span className="flex items-center justify-end gap-1 border-l border-border/60 py-1.5 pl-3">
                    {compared ? (
                      <span className="flex flex-col items-end gap-0.5">
                        {group.filter((row) => row.change === 'worse' || row.change === 'fixed')
                          .map((row) => (
                            <Badge key={row.family} variant={row.change === 'worse' ? 'danger' : 'success'}>{familyName(row.family)} {row.change}</Badge>
                          ))}
                      </span>
                    ) : null}
                    <RerunMenu rows={group} targets={targets} />
                  </span>
                </div>
              );
            })}
        </Group>
      ))}
      {!rows.length ? <p className="border-t px-5 py-12 text-center text-muted-foreground">{empty}</p> : null}
    </>
  );
}

