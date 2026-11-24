import { ArrowRight, Pin, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { pickedCases } from '#/shared/report.ts';
import { Delta, ModelChips, ModelShifts, PassBar, rate, RunOrigin, RunState, Spent } from '../components/evals';
import { NewRunSheet } from '../components/new-run-sheet';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Page, PageHeader } from '../components/ui/page';
import { navigate, useActions, useStore } from '../store';
import type { RunSummary } from '#/shared/report.types.ts';

function Ring({ value, size = 76 }: { value: number; size?: number }) {
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg className="-rotate-90" height={size} width={size}>
        <circle className="stroke-muted" cx={size / 2} cy={size / 2} fill="none" r={radius} strokeWidth={stroke} />
        <circle
          className="stroke-success transition-[stroke-dashoffset] duration-700 ease-(--ease-enter)"
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          strokeDasharray={length}
          strokeDashoffset={length - (length * value) / 100}
          strokeLinecap="round"
          strokeWidth={stroke}
        />
      </svg>
      <span className="absolute text-base font-medium tracking-[-0.02em] tabular-nums">{Math.round(value)}%</span>
    </span>
  );
}

function CaseScope({ caseFilter }: { caseFilter?: string }) {
  if (!caseFilter) {
    return null;
  }

  const ids = pickedCases(caseFilter);
  return <span title={ids.join(', ') || caseFilter}>{ids.length ? `Only ${ids.length} ${ids.length === 1 ? 'case' : 'cases'}` : `Only ${caseFilter}`}</span>;
}

function BaselineCard({ baseline, loaded, onStart }: { baseline: RunSummary | undefined; loaded: boolean; onStart: () => void }) {
  if (baseline) {
    return (
      <Card
        className="group cursor-pointer flex-row items-center gap-5 p-5 shadow-(--shadow-resting) transition-[box-shadow,background-color] hover:shadow-(--shadow-raised)"
        onClick={() => navigate(`/runs/${baseline.id}`)}
      >
        <Ring value={rate(baseline.passed, baseline.total)} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Pin className="size-3" /> Baseline</span>
          <span className="truncate text-base font-medium tracking-(--tracking-display)">{baseline.label}</span>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <ModelChips models={baseline.models} />
            <span>{baseline.passed} of {baseline.total} passed</span>
            <CaseScope caseFilter={baseline.caseFilter} />
            <Spent cost={baseline.cost} />
            <RunState run={baseline} />
          </div>
          <RunOrigin run={baseline} />
        </div>
        <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Card>
    );
  }

  if (!loaded) {
    return null;
  }

  return (
    <Card className="items-center gap-3 px-6 py-12 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-muted"><Sparkles className="size-4.5 text-muted-foreground" /></span>
      <span className="text-base font-medium">Start with a baseline</span>
      <span className="max-w-sm text-muted-foreground">Run the evals once on the models you use today. Every change after that is measured against it.</span>
      <Button className="mt-1" onClick={onStart}><Plus /> Run the baseline</Button>
    </Card>
  );
}

export function RunsPage() {
  const { runs, loaded } = useStore();
  const { setBaseline } = useActions();
  const [open, setOpen] = useState(false);
  const baseline = runs.find((run) => run.baseline);
  const others = runs.filter((run) => !run.baseline);

  return (
    <Page className="gap-5">
      <PageHeader
        actions={<Button onClick={() => setOpen(true)}><Plus /> New run</Button>}
        description="Run a baseline once, then compare every change against it."
        title="Eval runs"
      />

      {others.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-medium text-muted-foreground">Compared with the baseline</h2>
          <Card className="divide-y divide-border/60" variant="flush">
            {others.map((run) => (
              <div
                className="group flex cursor-pointer items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/40"
                key={run.id}
                onClick={() => navigate(`/runs/${run.id}`)}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="truncate font-medium">{run.label}</span>
                  <ModelShifts className="flex-col items-start" from={baseline?.models} models={run.models} />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <Spent cost={run.cost} />
                    <CaseScope caseFilter={run.caseFilter} />
                    <RunState run={run} />
                    <RunOrigin run={run} />
                  </div>
                </div>
                <div className="hidden flex-col items-end gap-1.5 sm:flex">
                  <span className="text-sm font-medium tabular-nums">{Math.round(rate(run.passed, run.total))}% <span className="font-normal text-muted-foreground">passed</span></span>
                  <PassBar failed={run.failed} passed={run.passed} />
                </div>
                <div className="flex w-16 justify-end">{run.baselineDelta === undefined ? null : <Delta value={run.baselineDelta} />}</div>
                {run.state === 'finished' ? (
                  <Button
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(event) => {
                      event.stopPropagation(); void setBaseline(run.id);
                    }}
                    size="xs"
                    variant="outline"
                  >
                    <Pin /> Use as baseline
                  </Button>
                ) : null}
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      <BaselineCard baseline={baseline} loaded={loaded} onStart={() => setOpen(true)} />

      <NewRunSheet baseline={baseline} onOpenChange={setOpen} open={open} />
    </Page>
  );
}
