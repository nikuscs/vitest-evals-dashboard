import { ArrowRight, CalendarDays, GitBranch, KeyRound, RotateCw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { pickedCases } from '#/shared/report.ts';
import { ModelChips, PassBar, rate, Spent, when } from '../components/evals';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Page, PageHeader } from '../components/ui/page';
import { SegmentedControl } from '../components/ui/segmented-control';
import { navigate, useBraintrust, useStore } from '../store';

const PAGE = 30;

// Braintrust experiments grouped into runs, newest first; read from Braintrust, so nothing here runs a model.
export function BraintrustPage() {
  const { runs, error, setup, loaded, retry } = useBraintrust();
  const { settings } = useStore();
  const [scope, setScope] = useState<'all' | 'default'>('all');
  const [shown, setShown] = useState(PAGE);
  const list = (runs ?? []).filter((run) => scope === 'all' || run.git?.branch === settings.defaultBranch);

  return (
    <Page className="gap-5">
      <PageHeader
        actions={runs
          ? (<SegmentedControl
            className="text-[13px]"
            label="Which runs"
            onValueChange={setScope}
            options={[{ value: 'all', label: 'All runs' }, { value: 'default', label: `Only ${settings.defaultBranch}` }]}
            value={scope}
          />
          ) : null}
        description="Experiments in your Braintrust project, grouped into runs with one experiment per model. Read only: open a run to compare it with another."
        title="Braintrust runs"
      />

      {error ? (
        <Card className="items-center gap-3 px-6 py-12 text-center">
          <span className={setup
            ? 'grid size-10 place-items-center rounded-full bg-muted'
            : 'grid size-10 place-items-center rounded-full bg-destructive/10 text-destructive'}>
            {setup ? <KeyRound className="size-4.5 text-muted-foreground" /> : <TriangleAlert className="size-4.5" />}
          </span>
          <span className="text-base font-medium">{setup ? 'Connect Braintrust' : 'Braintrust did not answer'}</span>
          <span className="max-w-md text-muted-foreground">{error}</span>
          {setup ? null : <Button className="mt-1" onClick={retry} variant="outline"><RotateCw /> Try again</Button>}
        </Card>
      ) : null}

      {!loaded ? <Card className="h-64 animate-pulse" /> : null}

      {list.length ? (
        <Card className="divide-y divide-border/60" variant="flush">
          {list.slice(0, shown)
            .map((run) => {
              const picked = pickedCases(run.caseFilter);
              return (
                <div
                  className="group flex cursor-pointer items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/40"
                  key={run.id}
                  onClick={() => navigate(`/braintrust/${run.id}`)}
                >
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <ModelChips models={run.models} />
                    {picked.length ? <span title={picked.join(', ')}>Only {picked.length} {picked.length === 1 ? 'case' : 'cases'}</span> : null}
                    <Spent cost={run.cost} />
                    <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />{when(run.createdAt)}</span>
                    {run.git ? (
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <GitBranch className="size-3.5 shrink-0" />
                        <span className="max-w-[16rem] truncate text-foreground/80">{run.git.branch}</span>
                        <span className="text-muted-foreground/70">{run.git.commit}</span>
                      </span>
                    ) : null}
                  </div>
                  {run.total ? (
                    <div className="hidden flex-col items-end gap-1.5 sm:flex">
                      <span className="text-sm font-medium tabular-nums">{Math.round(rate(run.passed, run.total))}% <span className="font-normal text-muted-foreground">passed</span></span>
                      <PassBar failed={run.failed} passed={run.passed} />
                    </div>
                  ) : <span className="hidden text-xs text-muted-foreground sm:block">Open to load results</span>}
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              );
            })}
          {list.length > shown ? (
            <button className="w-full px-5 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground" onClick={() => setShown(
              shown + PAGE,
            )} type="button">
              Show {Math.min(PAGE, list.length - shown)} more
            </button>
          ) : null}
        </Card>
      ) : null}
      {loaded && runs && !list.length ? <Card className="px-6 py-12 text-center text-muted-foreground">No Braintrust runs yet.</Card> : null}
    </Page>
  );
}
