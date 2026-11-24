import { Bot, ChevronRight, Clock, Coins, Gavel, Hash, MessagesSquare, User, Wrench } from 'lucide-react';
import { useState } from 'react';
import { caseCost, judgeKind, modelLabel, money } from '#/shared/report.ts';
import { useStore } from '../store';
import { ModelMark, ChangeBadge, Dot, JudgeIcon, StatusMark } from './evals';
import { OpenIn } from './open-in';
import { Badge } from './ui/badge';
import { cn } from './ui/cn';
import { Markdown } from './ui/markdown';
import { SegmentedControl } from './ui/segmented-control';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import type { JudgeKind } from '#/shared/report.ts';
import type { CaseComparison, CaseResult, ToolCall } from '#/shared/report.types.ts';

function Json({ value }: { value: unknown }) {
  let text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);

  if (typeof value === 'string') {
    try {
      text = JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      text = value;
    }
  }

  return <pre className="max-h-72 overflow-auto rounded-(--radius-control) border bg-muted/60 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">{text}</pre>;
}

function ToolRow({ call }: { call: ToolCall }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-2.5 text-[13px] transition-colors hover:bg-muted/40">
        <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
        <span className="grid size-5 place-items-center rounded-md bg-muted text-muted-foreground"><Wrench className="size-3" /></span>
        <span className="font-medium">{call.name}</span>
      </summary>
      <div className="flex flex-col gap-2 px-4 pb-4 pl-11">
        <span className="text-xs text-muted-foreground">Asked with</span>
        <Json value={call.arguments} />
        {call.result === undefined ? null : <><span className="text-xs text-muted-foreground">Got back</span><Json value={call.result} /></>}
      </div>
    </details>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

const BUBBLE = { user: 'rounded-tr-md bg-primary text-primary-foreground', assistant: 'rounded-tl-md border bg-card' };

function Avatar({ kind }: { kind: 'user' | 'assistant' }) {
  return kind === 'user'
    ? (<span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground" title="User"><User className="size-3.5" /></span>)
    : (<span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-foreground/80" title="Assistant"><Bot className="size-4" /></span>
    );
}

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function entriesOf(result: CaseResult | undefined, input: string | undefined) {
  if (result?.transcript.length) {
    return result.transcript;
  }

  return input ? [{ kind: 'user' as const, text: input }] : [];
}

function judgeKindOf(name: string): JudgeKind {
  if (/factual/i.test(name)) {
    return 'factuality';
  }

  return /rubric/i.test(name) ? 'rubric' : 'judge';
}

function roundState(status: CaseResult['status']): string {
  if (status === 'queued') {
    return 'waiting';
  }

  return status === 'running' ? 'running' : status;
}

function Conversation({ result, input }: { result?: CaseResult; input?: string }) {
  const entries = entriesOf(result, input);
  const reply = result?.output && !result.transcript.some((entry) => entry.kind === 'assistant') ? result.output : undefined;
  const busy = result?.status === 'running' || result?.status === 'queued';
  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry, index) => (
        entry.kind === 'tool' ? (
          <details className="group ml-10" key={index}>
            <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-md py-0.5 pr-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
              <span className="grid size-4 place-items-center rounded bg-muted"><Wrench className="size-2.5" /></span>
              {entry.text}
              {entry.tool ? <ChevronRight className="size-3 opacity-0 transition group-open:rotate-90 group-hover:opacity-100 group-open:opacity-100" /> : null}
            </summary>
            {entry.tool ? (
              <div className="mt-1.5 mb-1 flex flex-col gap-2 border-l pl-4">
                <span className="text-[11px] text-muted-foreground">Asked with</span>
                <Json value={entry.tool.arguments} />
                {entry.tool.result === undefined
                  ? null
                  : <><span className="text-[11px] text-muted-foreground">Got back</span><Json value={entry.tool.result} /></>}
              </div>
            ) : null}
          </details>
        ) : (
          <div className={cn('flex items-start gap-3', entry.kind === 'user' && 'flex-row-reverse')} key={index}>
            <Avatar kind={entry.kind} />
            <div className={cn('min-w-0 max-w-[85%] rounded-2xl px-4 py-2.5', BUBBLE[entry.kind])}>
              {entry.kind === 'user' ? <p className="text-sm whitespace-pre-wrap">{entry.text}</p> : <Markdown text={entry.text} />}
            </div>
          </div>
        )
      ))}
      {reply ? (
        <div className="flex items-start gap-3">
          <Avatar kind="assistant" />
          <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tl-md border bg-card px-4 py-2.5"><Markdown text={reply} /></div>
        </div>
      ) : null}
      {busy ? (
        <div className="flex items-center gap-3">
          <Avatar kind="assistant" />
          <span className="flex items-center gap-1 rounded-2xl rounded-tl-md border bg-card px-4 py-3">
            {[0, 1, 2].map(
              (dot) => <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" key={dot} style={{ animationDelay: `${dot * 120}ms` }} />,
            )}
          </span>
          <span className="text-xs text-muted-foreground">{result.status === 'queued' ? 'Waiting to run' : 'Running'}</span>
        </div>
      ) : null}
    </div>
  );
}

function Summary({ result }: { result?: CaseResult }) {
  const { prices } = useStore();

  if (!result || result.status === 'running' || result.status === 'queued') {
    return null;
  }

  const cost = caseCost(result, prices);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-(--radius-control) border px-4 py-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-2 text-sm font-medium text-foreground"><StatusMark status={result.status} />{result.status === 'passed'
        ? 'Passed'
        : 'Failed'}</span>
      <span className="flex items-center gap-1.5"><ModelMark className="size-3 text-[#c96442] dark:text-[#e08a6c]" model={result.model} />{modelLabel(result.model)}</span>
      <span className="flex items-center gap-1.5 tabular-nums"><Clock className="size-3.5" />{(result.durationMs / 1000).toFixed(1)} s</span>
      {result.tokens
        ? <span className="flex items-center gap-1.5 tabular-nums"><Hash className="size-3.5" />{result.tokens.toLocaleString('en')} tokens</span>
        : null}
      <span className="flex items-center gap-1.5 tabular-nums"><Wrench className="size-3.5" />{result.toolCalls.length} tools</span>
      {cost === undefined
        ? null
        : <span className="flex items-center gap-1.5 font-medium text-foreground tabular-nums" title="Estimate from list prices on models.dev, before prompt-cache discounts"><Coins className="size-3.5" />{money(
          cost,
        )}</span>}
    </div>
  );
}

function Verdict({ result, judgeModel }: { result?: CaseResult; judgeModel?: string }) {
  if (!result || result.status === 'running' || result.status === 'queued') {
    return <Empty>No result yet.</Empty>;
  }

  if (!result.failure && !result.judges.length) {
    return <Empty>All checks passed. No judge scores this case.</Empty>;
  }

  return (
    <div className="flex flex-col gap-3">
      {result.failure ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Why it failed</span>
          <div className="rounded-(--radius-control) border border-destructive/20 bg-destructive/6 px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap text-destructive">{result.failure}</div>
        </div>
      ) : null}
      {result.judges.map((judge) => (
        <div className="flex flex-col gap-2 rounded-(--radius-control) border px-4 py-3.5" key={judge.name}>
          <div className="flex items-center justify-between">
            <JudgeIcon kind={judgeKindOf(judge.name)} withLabel />
            {judge.score === null ? null : <Badge variant={result.status === 'passed' ? 'success' : 'danger'}>{Math.round(judge.score * 100)}%</Badge>}
          </div>
          {judge.rationale ? <p className="text-[13px] leading-relaxed">{judge.rationale}</p> : null}
          {judgeModel ? (
            <span className="flex items-center gap-1.5 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
              <ModelMark className="size-3 text-[#c96442] dark:text-[#e08a6c]" model={judgeModel} />
              Judged by {modelLabel(judgeModel.split('@')[0] ?? judgeModel)}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function score(result: CaseResult) {
  const scores = result.judges
    .map((judge) => judge.score)
    .filter((value): value is number => value !== null);

  return scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : undefined;
}

function Rounds({ attempts, selected, onSelect }: { attempts: CaseResult[]; selected?: string; onSelect: (attempt: number) => void }) {
  const { prices } = useStore();
  const done = attempts.filter((result) => result.status === 'passed' || result.status === 'failed');
  const passed = done.filter((result) => result.status === 'passed').length;
  return (
    <div className="overflow-hidden rounded-(--radius-control) border">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Rounds</span>
        <span className="tabular-nums">{passed} of {done.length} passed</span>
        {done.length ? <span className="ml-auto font-medium text-foreground tabular-nums">{Math.round((passed / done.length) * 100)}%</span> : null}
      </div>
      {attempts.map((result, index) => {
        const value = score(result);
        return (
          <button
            className={cn(
              'grid w-full grid-cols-[20px_1fr_64px_64px_88px] items-center gap-3 border-b border-border/50 px-4 py-2 text-left text-[13px] transition-colors last:border-0 hover:bg-muted/40',
              result.id === selected && 'bg-muted/60',
            )}
            key={result.id}
            onClick={() => onSelect(result.attempt)}
            type="button"
          >
            <StatusMark className="size-4" status={result.status} />
            <span>Round {index + 1} <span className="text-muted-foreground">· {roundState(result.status)}</span></span>
            <span className="text-right text-xs text-muted-foreground tabular-nums">{value === undefined ? '' : `${Math.round(value * 100)}%`}</span>
            <span className="text-right text-xs text-muted-foreground tabular-nums">{result.durationMs
              ? `${(result.durationMs / 1000).toFixed(1)} s`
              : ''}</span>
            <span className="text-right text-xs text-muted-foreground tabular-nums" title={result.tokens
              ? `${result.tokens.toLocaleString('en')} tokens`
              : undefined}>{result.status === 'passed' || result.status === 'failed' ? money(caseCost(result, prices)) : ''}</span>
          </button>
        );
      })}
    </div>
  );
}

function Tools({ result }: { result?: CaseResult }) {
  if (!result?.toolCalls.length) {
    return <Empty>No tools were called.</Empty>;
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col divide-y divide-border/60 overflow-hidden rounded-(--radius-control) border">
        {result.toolCalls.map((call, index) => <ToolRow call={call} key={`${call.name}-${index}`} />)}
      </div>
    </div>
  );
}

function SideRate({ attempts }: { attempts: CaseResult[] }) {
  const done = attempts.filter((result) => result.status === 'passed' || result.status === 'failed');

  if (done.length < 2) {
    return null;
  }

  const passed = done.filter((result) => result.status === 'passed').length;
  return <span className="text-xs font-normal text-muted-foreground tabular-nums">{passed}/{done.length}</span>;
}

interface CaseSheetProps {
  row?: CaseComparison;
  siblings: CaseComparison[];
  judges: { before?: string; after?: string };
  onOpenChange: (open: boolean) => void;
  onPick: (key: string) => void;
}

export function CaseSheet({ row, siblings, judges, onOpenChange, onPick }: CaseSheetProps) {
  const [side, setSide] = useState<'after' | 'before'>('after');
  const [picked, setPicked] = useState<number>();
  const compared = Boolean(row?.before);
  const attempts = (side === 'after' || !compared ? row?.afterAttempts : row?.beforeAttempts) ?? [];
  const shown = attempts.find((result) => result.attempt === picked) ?? attempts.findLast((result) => result.status !== 'running') ?? attempts.at(-1);
  const input = shown?.input ?? row?.after?.input ?? row?.before?.input;
  return (
    <Sheet onOpenChange={onOpenChange} open={Boolean(row)}>
      <SheetContent className="w-full gap-0 sm:max-w-2xl">
        {row ? (
          <>
            <SheetHeader className="gap-2 border-b p-5 pr-12">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="capitalize">{row.suite.replaceAll('-', ' ')}</span><span>·</span><span>{row.caseId}</span>
                <ChangeBadge change={row.change} />
                <JudgeIcon className="ml-auto" kind={judgeKind([...row.beforeAttempts, ...row.afterAttempts])} withLabel />
                <OpenIn caseId={row.caseId} />
              </div>
              <SheetTitle className="text-lg leading-snug font-medium tracking-(--tracking-display)">{capitalized(row.title)}</SheetTitle>
              <SheetDescription className="sr-only">The baseline and this run for one case</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col gap-5 p-5">
                {siblings.length > 1
                  ? (<SegmentedControl
                    label="Which model"
                    onValueChange={(value) => onPick(`${row.suite}::${row.caseId}::${value}`)}
                    options={siblings.map((item) => ({
                      value: item.family,
                      label: <><ModelMark className="size-3 text-[#c96442] dark:text-[#e08a6c]" model={item.family} /> {capitalized(item.family)} <StatusMark className="size-4" status={item.after?.status} /></>,
                    }))}
                    value={row.family}
                  />
                  ) : null}
                {compared
                  ? (<SegmentedControl
                    label="Which run"
                    onValueChange={(value) => {
                      setSide(value); setPicked(undefined);
                    }}
                    options={[
                      { value: 'after', label: <><StatusMark className="size-4" status={row.after?.status} /> Now <SideRate attempts={row.afterAttempts} /></> },
                      {
                        value: 'before',
                        label: <><StatusMark className="size-4" status={row.before?.status} /> Before <SideRate attempts={row.beforeAttempts} /></>,
                      },
                    ]}
                    value={side}
                  />
                  ) : null}
                {attempts.length > 1 ? <Rounds attempts={attempts} onSelect={setPicked} selected={shown?.id} /> : null}
                {shown ? (
                  <>
                    <Summary result={shown} />
                    <Tabs defaultValue="transcript" key={shown.id}>
                      <TabsList className="w-full">
                        <TabsTrigger className="flex-1 gap-1.5 text-[13px]" value="transcript"><MessagesSquare className="size-3.5" /> Transcript</TabsTrigger>
                        <TabsTrigger className="flex-1 gap-1.5 text-[13px]" value="judge">
                          <Gavel className="size-3.5" /> {shown.judges.length ? 'Judge' : 'Checks'}
                          {shown.status === 'passed' || shown.status === 'failed' ? <Dot className="size-1.5" status={shown.status} /> : null}
                        </TabsTrigger>
                        <TabsTrigger className="flex-1 gap-1.5 text-[13px]" value="tools"><Wrench className="size-3.5" /> Tools <span className="text-xs text-muted-foreground">{shown.toolCalls.length}</span></TabsTrigger>
                      </TabsList>
                      <TabsContent className="pt-2" value="transcript"><Conversation input={input} result={shown} /></TabsContent>
                      <TabsContent className="pt-2" value="judge"><Verdict judgeModel={side === 'after' || !compared
                        ? judges.after
                        : judges.before} result={shown} /></TabsContent>
                      <TabsContent className="pt-2" value="tools"><Tools result={shown} /></TabsContent>
                    </Tabs>
                  </>
                ) : <Empty>This case did not run here.</Empty>}
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
