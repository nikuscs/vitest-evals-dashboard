import { ChevronDown, LoaderCircle, Square } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { modelLabel } from '#/shared/report.ts';
import { ModelMark, Dot } from './evals';
import { Button } from './ui/button';
import { cn } from './ui/cn';
import { MOTION } from './ui/motion.constants';
import type { CaseResult } from '#/shared/report.types.ts';

interface Item {
  result: CaseResult;
  side: 'before' | 'now';
}

const ORDER = { running: 0, queued: 1, failed: 2, passed: 2, skipped: 3 } as const;
const VISIBLE = 6;

function batchOf(cases: CaseResult[] | undefined) {
  const all = cases ?? [];

  const active = new Set(all.filter((result) => result.status === 'running' || result.status === 'queued')
    .map((result) => `${result.attempt}:${result.family}`));

  return all.filter((result) => active.has(`${result.attempt}:${result.family}`));
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(
    () => {
      if (!active) {
        return undefined;
      }

      const timer = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(timer);
    },
    [active],
  );

  return now;
}

function seconds(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return total < 60 ? `${total}s` : `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, '0')}s`;
}

function Icon({ status }: { status: CaseResult['status'] }) {
  if (status === 'running') {
    return <LoaderCircle className="size-4 animate-spin text-info" />;
  }
  return <Dot status={status} />;
}

function elapsed(result: CaseResult, now: number): string {
  if (result.status === 'running' && result.startedAt) {
    return seconds(now - Date.parse(result.startedAt));
  }

  return result.status === 'passed' || result.status === 'failed' ? seconds(result.durationMs) : '';
}

function Row({ item, now }: { item: Item; now: number }) {
  const { result, side } = item;
  const time = elapsed(result, now);
  const sideTone = side === 'now' ? 'bg-foreground/6 text-foreground' : 'text-muted-foreground';

  return (
    <div className={cn('flex h-10 items-center gap-3 px-4 transition-opacity', result.status === 'queued' && 'opacity-55')}>
      <span className="grid size-4 shrink-0 place-items-center"><Icon status={result.status} /></span>
      <span className="min-w-0 flex-1 truncate text-[13px]">
        {result.title.charAt(0).toUpperCase() + result.title.slice(1)}
        <span className="ml-2 text-xs text-muted-foreground/70">{result.caseId}</span>
      </span>
      <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex">
        <ModelMark className="size-3 text-[#c96442] dark:text-[#e08a6c]" model={result.model} />
        {modelLabel(result.model)}
      </span>
      <span className={cn('w-14 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px]', sideTone)}>
        {side === 'now' ? 'Now' : 'Before'}
      </span>
      <span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{time}</span>
    </div>
  );
}

interface ActivityProps {
  before?: CaseResult[];
  after?: CaseResult[];
  onStop: () => void;
}

export function Activity({ before, after, onStop }: ActivityProps) {
  const reduced = Boolean(useReducedMotion());
  const [expanded, setExpanded] = useState(false);

  const items: Item[] = [
    ...batchOf(before).map((result) => ({
      result,
      side: 'before' as const,
    })),
    ...batchOf(after).map((result) => ({
      result,
      side: 'now' as const,
    })),
  ].sort((a, b) => ORDER[a.result.status] - ORDER[b.result.status]);

  const now = useNow(items.length > 0);
  const done = items.filter((item) => item.result.status === 'passed' || item.result.status === 'failed').length;
  const running = items.filter((item) => item.result.status === 'running').length;
  const shown = expanded ? items : items.slice(0, VISIBLE);
  const spring = reduced ? { duration: 0 } : MOTION.spring.smooth;

  return (
    <AnimatePresence initial={false}>
      {items.length ? (
        <motion.section
          animate={{ opacity: 1, height: 'auto' }}
          className="overflow-hidden"
          exit={{ opacity: 0, height: 0 }}
          initial={{ opacity: 0, height: 0 }}
          transition={spring}
        >
          <div className="overflow-hidden rounded-(--radius-panel) border bg-card shadow-(--shadow-resting)">
            <div className="flex items-center gap-3 px-4 pt-3.5 pb-3">
              <LoaderCircle className="size-4 animate-spin text-info" />
              <span className="text-sm font-medium">{running ? 'Running' : 'Starting'}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{done} of {items.length} done</span>
              <Button className="ml-auto text-muted-foreground" onClick={onStop} size="xs" variant="ghost"><Square className="fill-current" /> Stop</Button>
            </div>
            <div className="mx-4 h-[3px] overflow-hidden rounded-full bg-muted">
              <motion.div animate={{ width: `${(done / items.length) * 100}%` }} className="h-full rounded-full bg-info" initial={false} transition={spring} />
            </div>
            <div className="mt-2 divide-y divide-border/50 border-t border-border/60">
              <AnimatePresence initial={false}>
                {shown.map((item) => (
                  <motion.div
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    initial={{ opacity: 0, height: 0 }}
                    key={`${item.side}-${item.result.id}`}
                    layout={!reduced}
                    transition={spring}
                  >
                    <Row item={item} now={now} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {items.length > VISIBLE ? (
              <button
                className="flex h-9 w-full items-center justify-center gap-1.5 border-t border-border/60 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                onClick={() => setExpanded(!expanded)}
                type="button"
              >
                {expanded ? 'Show less' : `Show ${items.length - VISIBLE} more`}
                <ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} />
              </button>
            ) : null}
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
