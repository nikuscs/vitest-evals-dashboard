import { ArrowRight, Coins, Search, Square, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { caseCost, compareRuns, judgeKind, modelLabel, money, summarizeFamilies } from '#/shared/report.ts';
import { Activity } from '../components/activity';
import { CaseSheet } from '../components/case-sheet';
import { CaseTable, CaseTableHead, rowKey } from '../components/case-table';
import { CompareMenu } from '../components/compare-menu';
import { ModelMark, modelTint, BaselineBadge, Delta, familyName, JudgeIcon, LiveDot, ModelChips, RunOrigin, Spent } from '../components/evals';
import { FilterPill } from '../components/filters';
import { RerunMenu } from '../components/rerun';
import { Strip } from '../components/strip';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { cn } from '../components/ui/cn';
import { Input } from '../components/ui/input';
import { Page, PageHeader } from '../components/ui/page';
import { SegmentedControl } from '../components/ui/segmented-control';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useActions, useBraintrust, useRun, useStore } from '../store';
import type { JudgeKind } from '#/shared/report.ts';
import type * as ReportTypes from '#/shared/report.types.ts';
import type { GroupBy } from '../components/case-table';
import type { Source } from '../store';

type Filter = 'changed' | 'worse' | 'fixed' | 'failing' | 'all';

const pct = (part: { passed: number; total: number }) => (part.total ? (part.passed / part.total) * 100 : 0);

function CostLine({ before, after }: { before?: number; after?: number }) {
  if (after === undefined && before === undefined) {
    return null;
  }

  const change = before && after !== undefined ? ((after - before) / before) * 100 : undefined;
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Coins className="size-3.5" />
      <span>Per case</span>
      {before === undefined ? null : <><span className="tabular-nums">{money(before)}</span><ArrowRight className="size-3 opacity-60" /></>}
      <span className="font-medium text-foreground tabular-nums">{money(after)}</span>
      {change === undefined || Math.abs(change) < 1
        ? null
        : (<span className={cn('tabular-nums', change < 0 ? 'text-success' : 'text-destructive')}>{change < 0 ? '' : '+'}{Math.round(change)}%</span>
        )}
    </div>
  );
}

interface FamilyCardProps {
  summary: ReportTypes.FamilySummary;
  rows: ReportTypes.CaseComparison[];
  compared: boolean;
  prices: ReportTypes.Prices;
  activeTest?: string;
  onFilter: (filter: Filter) => void;
  onOpen: (row: ReportTypes.CaseComparison) => void;
  onTest: (caseId: string) => void;
  onFamily: (family: string) => void;
}

function perCase(results: ReportTypes.CaseResult[], prices: ReportTypes.Prices) {
  const costs = results.map((result) => caseCost(result, prices))
    .filter((value): value is number => value !== undefined);

  return costs.length ? costs.reduce((sum, value) => sum + value, 0) / costs.length : undefined;
}

// Names the cases in this card that reported a model other than the one the run picked.
function FixedNote({ rows, summary }: { rows: ReportTypes.CaseComparison[]; summary: ReportTypes.FamilySummary }) {
  const odd = [
    ...rows.map((row) => row.before)
      .filter((result) => result?.fixedModel && result.model !== summary.beforeModel),
    ...rows.map((row) => row.after)
      .filter((result) => result?.fixedModel && result.model !== summary.afterModel),
  ] as ReportTypes.CaseResult[];

  if (!odd.length) {
    return null;
  }

  const ids = [...new Set(odd.map((result) => result.caseId))].join(', ');
  const models = [...new Set(odd.map((result) => modelLabel(result.model)))].join(', ');
  return <span className="mt-1 text-xs text-warning">{ids} ran on {models}, not the model this run picked.</span>;
}

function FamilyCard({ summary, rows, compared: comparedRun, prices, activeTest, onFilter, onOpen, onTest, onFamily }: FamilyCardProps) {
  // A model the other run never ran has nothing to compare with.
  const compared = comparedRun && summary.before.total > 0;
  const before = pct(summary.before);
  const after = pct(summary.after);
  const mine = rows.filter((row) => row.family === summary.family);
  return (
    <Card className="gap-4 p-5 shadow-(--shadow-resting)">
      <div className="flex items-center gap-2">
        <button className="flex min-w-0 items-center gap-2 rounded-lg text-left transition-opacity hover:opacity-80" onClick={() => onFamily(summary.family)} title={`Show only ${familyName(summary.family)} cases`} type="button">
          <span className={cn('grid size-7 place-items-center rounded-lg', modelTint(summary.family))}><ModelMark model={summary.family} /></span>
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-medium">{familyName(summary.family)}</span>
            <span className="truncate text-xs text-muted-foreground">{compared && summary.beforeModel
              ? `${modelLabel(summary.beforeModel)} → `
              : ''}{summary.afterModel ? modelLabel(summary.afterModel) : ''}</span>
            <FixedNote rows={mine} summary={summary} />
          </div>
        </button>
        {compared && summary.after.total ? <Delta className="ml-auto" value={after - before} /> : null}
        {comparedRun && !compared ? <Badge className="ml-auto">Not in the other run</Badge> : null}
      </div>
      <div className="flex items-end gap-3">
        {compared ? (
          <>
            <span className="text-[1.75rem] leading-none font-medium tracking-[-0.03em] text-muted-foreground/70 tabular-nums">{Math.round(before)}%</span>
            <ArrowRight className="mb-1 size-4 text-muted-foreground/60" />
          </>
        ) : null}
        <span className="text-[1.75rem] leading-none font-medium tracking-[-0.03em] tabular-nums">{Math.round(after)}%</span>
        <span className="mb-0.5 text-xs text-muted-foreground tabular-nums">{summary.after.passed} of {summary.after.total} passed</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {compared ? <Strip activeTest={activeTest} compared={compared} onOpen={onOpen} onTest={onTest} rows={mine} side="before" /> : null}
        <Strip activeTest={activeTest} compared={compared} onOpen={onOpen} onTest={onTest} rows={mine} side="after" />
      </div>
      <CostLine after={perCase(mine.flatMap((row) => row.afterAttempts), prices)} before={compared
        ? perCase(mine.flatMap((row) => row.beforeAttempts), prices)
        : undefined} />
      {compared ? (
        <div className="flex gap-2 text-xs">
          <button className="inline-flex items-center gap-1.5 rounded-full bg-destructive/8 px-2.5 py-1 text-destructive transition-colors hover:bg-destructive/14" onClick={() => onFilter(
            'worse',
          )} type="button">
            <span className="font-medium tabular-nums">{summary.worse}</span> worse
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-success transition-colors hover:bg-success/16" onClick={() => onFilter(
            'fixed',
          )} type="button">
            <span className="font-medium tabular-nums">{summary.fixed}</span> fixed
          </button>
        </div>
      ) : null}
    </Card>
  );
}

// The run the page compares with when nobody picked one: the local baseline, or for Braintrust the newest earlier run on the default branch.
function defaultCompare(source: Source, runs: ReportTypes.RunSummary[], id: string, defaultBranch: string) {
  if (source === 'evals') {
    return runs.find((item) => item.baseline && item.id !== id)?.id;
  }

  const run = runs.find((item) => item.id === id);
  return runs.find((item) => item.id !== id && item.git?.branch === defaultBranch && run && item.createdAt < run.createdAt && item.total > 0)?.id;
}

function emptyText({ waiting, unchanged, other }: { waiting: boolean; unchanged: boolean; other: string | undefined }): string {
  if (waiting) {
    return 'Waiting for the first case…';
  }

  return unchanged ? `Nothing changed. Same results as ${other ?? 'the other run'}.` : 'No cases match these filters.';
}

export function RunPage({ id, source = 'evals' }: { id: string; source?: Source }) {
  const { runs: evalRuns, prices, settings } = useStore();
  const braintrust = useBraintrust(source === 'braintrust');
  const runs = source === 'braintrust' ? braintrust.runs ?? [] : evalRuns;
  const run = useRun(id, source);
  // undefined: the default; null: compare with nothing.
  const [against, setAgainst] = useState<string | null>();
  const compareId = against === undefined ? defaultCompare(source, runs, id, settings.defaultBranch) : against;
  const compareSummary = runs.find((item) => item.id === compareId);
  const compared = Boolean(compareSummary);
  const baseline = useRun(compareSummary?.id, source);
  const { cancel } = useActions();
  // Until someone picks a tab, a compared run opens on what changed; the other run can arrive after the first render.
  const [pickedFilter, setFilter] = useState<Filter>();
  const filter = pickedFilter ?? (compared ? 'changed' : 'all');
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState<string | null>(null);
  const [suite, setSuite] = useState<string | null>(null);
  const [test, setTest] = useState<string | null>(null);
  const [grader, setGrader] = useState<JudgeKind | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('case');
  const [open, setOpen] = useState<string>();

  const rows = useMemo(
    () => {
      if (!run) {
        return [];
      }

      const all = compareRuns(compared ? baseline?.cases ?? [] : [], run.cases);
      return run.caseFilter || run.state !== 'running'
        ? all.filter((row) => row.after)
        : all;
    },
    [run, baseline, compared],
  );

  const families = useMemo(() => summarizeFamilies(rows), [rows]);

  const matches: Record<Filter, (row: ReportTypes.CaseComparison) => boolean> = {
    changed: (row) => row.change === 'worse' || row.change === 'fixed',
    worse: (row) => row.change === 'worse',
    fixed: (row) => row.change === 'fixed',
    failing: (row) => row.after?.status === 'failed',
    all: () => true,
  };

  const scoped = rows.filter((row) => (!family
    || row.family === family)
    && (!suite
    || row.suite === suite)
    && (!test
    || row.caseId === test)
    && (!grader
    || judgeKind([...row.beforeAttempts, ...row.afterAttempts]) === grader)
    && (!query
    || `${row.caseId} ${row.title} ${row.suite}`.toLowerCase().includes(query.toLowerCase())));

  const visible = scoped.filter(matches[filter]);
  const matched = new Set(visible.map((row) => `${row.suite}::${row.caseId}`));
  const grouped = scoped.filter((row) => matched.has(`${row.suite}::${row.caseId}`));

  const shownFamilies = families.map((summary) => summary.family)
    .filter((value) => !family || value === family);

  const filtered = [family, suite, test, grader, query].some(Boolean);

  const toggleTest = (caseId: string) => {
    setTest(test === caseId ? null : caseId); if (filter !== 'all' && test !== caseId) {
      setFilter('all');
    }
  };

  const count = <K extends string>(values: K[]) => values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<K, number>());
  const familyCounts = count(rows.map((row) => row.family));
  const suiteCounts = count(rows.map((row) => row.suite));
  const graderCounts = count(rows.map((row) => judgeKind([...row.beforeAttempts, ...row.afterAttempts])));
  const tests = [...new Map(rows.map((row) => [row.caseId, row.title])).entries()].sort(([a], [b]) => a.localeCompare(b));
  const selected = rows.find((row) => rowKey(row) === open);

  const tabs: [Filter, string][] = [...(compared
    ? [['changed', 'Changed'], ['worse', 'Worse'], ['fixed', 'Fixed']] as [Filter, string][]
    : []), ['failing', 'Failing'], ['all', 'All']];

  const targets = { before: compareSummary?.id, after: id, readOnly: source === 'braintrust' };

  if (!run) {
    return <Page><div className="h-40 animate-pulse rounded-(--radius-panel) bg-muted" /></Page>;
  }

  return (
    <Page className="gap-5">
      <PageHeader
        actions={(
          <>
            <CompareMenu
              onChange={(next) => {
                setAgainst(next);
                setFilter(next ? 'changed' : 'all');
              }}
              runId={run.id}
              runs={runs}
              value={compareSummary}
            />
            {run.state === 'running' ? <Button onClick={() => void cancel(run.id)} size="sm" variant="outline"><Square /> Stop</Button> : null}
          </>
        )}
        description={(
          <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            <ModelChips models={run.models} />
            <Spent cost={runs.find((item) => item.id === id)?.cost} />
            <RunOrigin className="ml-1" run={run} />
            {run.state === 'running' ? <LiveDot label="Running" /> : null}
            {run.state === 'failed' ? <Badge variant="danger">Did not finish</Badge> : null}
          </span>
        )}
        title={<>{run.label}{run.baseline ? <BaselineBadge /> : null}</>}
      />

      <div className="grid gap-3 md:grid-cols-2">
        {families.map((summary) => (
          <FamilyCard
            activeTest={test ?? undefined}
            compared={compared}
            key={summary.family}
            onFamily={(value) => setFamily(family === value ? null : value)}
            onFilter={(value) => {
              setFilter(value); setFamily(summary.family);
            }}
            onOpen={(row) => setOpen(rowKey(row))}
            onTest={toggleTest}
            prices={prices}
            rows={rows}
            summary={summary}
          />
        ))}
      </div>

      <Activity
        after={run.cases}
        before={compared ? baseline?.cases : undefined}
        onStop={() => {
          void cancel(run.id); if (compareSummary) {
            void cancel(compareSummary.id);
          }
        }}
      />

      <Card className="gap-0 shadow-(--shadow-resting)" variant="flush" style={{ overflow: 'clip' }}>
        <div className="sticky top-(--shell-header) z-10 rounded-t-[inherit] bg-card/95 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
            <Tabs onValueChange={(value) => setFilter(value as Filter)} value={filter}>
              <TabsList>
                {tabs.map(([value, label]) => (
                  <TabsTrigger className="gap-1.5 px-2.5 text-[13px]" key={value} value={value}>
                    {label}<span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{scoped.filter(matches[value]).length}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <span className="ml-auto" />
            <RerunMenu label={`Run ${visible.length === rows.length ? 'all' : visible.length} again`} rows={visible} targets={targets} />
            <Input className="h-8 max-w-56 text-[13px]" onChange={(event) => setQuery(event.target.value)} placeholder="Search" prefix={<Search className="size-3.5" />} value={query} />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
            <FilterPill
              label="Model"
              onValueChange={setFamily}
              options={[...familyCounts].map(([value, total]) => ({
                value,
                label: familyName(value),
                hint: total,
                icon: <ModelMark className="size-3 text-[#c96442] dark:text-[#e08a6c]" model={value} />,
              }))}
              value={family}
            />
            <FilterPill
              label="Area"
              onValueChange={setSuite}
              options={[...suiteCounts]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([value, total]) => ({
                  value,
                  label: value.replaceAll('-', ' ')
                    .replace(/^./, (c) => c.toUpperCase()),
                  hint: total,
                }))}
              value={suite}
            />
            <FilterPill
              label="Graded by"
              onValueChange={setGrader}
              options={[...graderCounts].map(([value, total]) => ({
                value,
                label: value === 'rules' ? 'Rules' : value.charAt(0).toUpperCase() + value.slice(1),
                hint: total,
                icon: <JudgeIcon className="-ml-0.5" kind={value} />,
              }))}
              value={grader}
            />
            <FilterPill label="Test" onValueChange={setTest} options={tests.map(([value, title]) => ({
              value,
              label: value,
              hint: title.length > 28 ? `${title.slice(0, 28)}…` : title,
            }))} value={test} />
            {filtered ? (
              <button
                className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => {
                  setFamily(null); setSuite(null); setTest(null); setGrader(null); setQuery('');
                }}
                type="button"
              >
                <X className="size-3.5" /> Clear
              </button>
            ) : null}
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">{matched.size} of {new Set(rows.map((row) => `${row.suite}::${row.caseId}`)).size} cases</span>
            <SegmentedControl
              className="text-[13px]"
              label="Group rows"
              onValueChange={setGroupBy}
              options={[{ value: 'case', label: 'By case' }, { value: 'model', label: 'By model' }]}
              value={groupBy}
            />
          </div>
          <CaseTableHead compared={compared} families={shownFamilies} groupBy={groupBy} models={Object.fromEntries(families.map(
            (summary) => [summary.family, { before: summary.beforeModel, after: summary.afterModel }],
          ))} />
        </div>
        <CaseTable
          compared={compared}
          empty={emptyText({ waiting: run.state === 'running' && !rows.length, unchanged: filter === 'changed' && !filtered, other: compareSummary?.label })}
          families={shownFamilies}
          groupBy={groupBy}
          onOpen={setOpen}
          onTest={toggleTest}
          rows={groupBy === 'case' ? grouped : visible}
          targets={targets}
          test={test}
        />
        <div className="h-2" />
      </Card>

      <CaseSheet
        judges={{ before: baseline?.judge, after: run.judge }}
        key={open}
        onOpenChange={(next) => !next && setOpen(undefined)}
        onPick={setOpen}
        row={selected}
        siblings={selected
          ? rows.filter((row) => row.suite === selected.suite && row.caseId === selected.caseId)
          : []}
      />
    </Page>
  );
}
