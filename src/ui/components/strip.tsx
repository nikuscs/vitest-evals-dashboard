import { Filter, PanelRightOpen } from 'lucide-react';
import { useRef, useState } from 'react';
import { judgeKind, judgeScore } from '#/shared/report.ts';
import { ChangeBadge, JudgeIcon } from './evals';
import { Dots } from './rerun';
import { Button } from './ui/button';
import { cn } from './ui/cn';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import type { CaseComparison } from '#/shared/report.types.ts';
import type { Side } from './rerun';

interface StripProps {
  rows: CaseComparison[];
  side: 'before' | 'after';
  compared: boolean;
  activeTest?: string;
  onOpen: (row: CaseComparison) => void;
  onTest: (caseId: string) => void;
}

function sideTitle(side: Side, compared: boolean): string {
  if (side === 'before') {
    return 'Before';
  }

  return compared ? 'Now' : 'Result';
}

function scoreText(score: number | undefined, passed: number, done: number): string {
  if (score !== undefined) {
    return `${Math.round(score * 100)}%`;
  }

  return done ? `${Math.round((passed / done) * 100)}%` : '—';
}

// One bar per case. Hover shows the case, click keeps it open with actions.
export function Strip({ rows, side, compared, activeTest, onOpen, onTest }: StripProps) {
  const [open, setOpen] = useState<string>();
  const [pinned, setPinned] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const hover = (key: string | undefined) => {
    clearTimeout(timer.current);
    if (pinned) {
      return;
    }
    timer.current = setTimeout(() => setOpen(key), key ? 60 : 120);
  };

  return (
    <div className="flex flex-wrap gap-[2px]" onPointerLeave={() => hover(undefined)}>
      {rows.map((row) => {
        const key = `${row.suite}::${row.caseId}::${row.family}`;
        const result = side === 'before' ? row.before : row.after;
        const dimmed = activeTest && activeTest !== row.caseId;
        return (
          <Popover
            key={key}
            onOpenChange={(next) => {
              if (next) {
                return;
              }

              setOpen(undefined);
              setPinned(false);
            }}
            open={open === key}
          >
            <PopoverTrigger asChild>
              <button
                aria-label={`${row.caseId}: ${result?.status ?? 'not run'}`}
                className={cn(
                  'h-2.5 w-1 cursor-pointer rounded-full transition-[background-color,transform,opacity] duration-200 hover:scale-y-150',
                  result?.status === 'passed' && 'bg-success/60 hover:bg-success',
                  result?.status === 'failed' && 'bg-destructive',
                  (result?.status === 'running' || result?.status === 'queued') && 'animate-pulse bg-info/60',
                  !result && 'bg-muted',
                  open === key && 'scale-y-150 ring-2 ring-foreground/30',
                  dimmed && 'opacity-25',
                )}
                onClick={() => {
                  setOpen(key); setPinned(true);
                }}
                onPointerEnter={() => hover(key)}
                type="button"
              />
            </PopoverTrigger>
            <PopoverContent
              className="w-80 p-0"
              onOpenAutoFocus={(event) => event.preventDefault()}
              onPointerEnter={() => clearTimeout(timer.current)}
              onPointerLeave={() => hover(undefined)}
              side="top"
            >
              <div className="flex flex-col gap-3 p-4">
                <div className="flex items-start gap-2.5">
                  <JudgeIcon kind={judgeKind([...row.beforeAttempts, ...row.afterAttempts])} />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[13px] leading-snug font-medium">{row.title.charAt(0).toUpperCase() + row.title.slice(1)}</span>
                    <span className="text-xs text-muted-foreground capitalize">{row.suite.replaceAll('-', ' ')} · {row.caseId}</span>
                  </div>
                </div>
                <div className={cn('grid gap-2', compared ? 'grid-cols-2' : 'grid-cols-1')}>
                  {(compared ? (['before', 'after'] as const) : (['after'] as const)).map((which) => {
                    const attempts = which === 'before' ? row.beforeAttempts : row.afterAttempts;
                    const done = attempts.filter((item) => item.status === 'passed' || item.status === 'failed');
                    const passed = done.filter((item) => item.status === 'passed').length;
                    const score = judgeScore(attempts);
                    return (
                      <div className={cn('flex flex-col gap-1.5 rounded-xl border px-3 py-2.5', which === side && 'border-foreground/20 bg-muted/40')} key={which}>
                        <span className="flex items-center justify-between text-[11px] text-muted-foreground">
                          {sideTitle(which, compared)}
                          <Dots attempts={attempts} />
                        </span>
                        <span className="text-lg leading-none font-medium tracking-[-0.02em] tabular-nums">
                          {scoreText(score, passed, done.length)}
                        </span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {score === undefined ? `${passed} of ${done.length} passed` : `judge score · ${passed}/${done.length} passed`}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {row.change === 'worse' || row.change === 'fixed' ? <ChangeBadge change={row.change} /> : null}
              </div>
              <div className="flex gap-1 border-t p-1.5">
                <Button className="flex-1" onClick={() => {
                  setOpen(undefined); onOpen(row);
                }} size="sm" variant="ghost"><PanelRightOpen /> Open</Button>
                <Button className="flex-1" onClick={() => {
                  setOpen(undefined); onTest(row.caseId);
                }} size="sm" variant="ghost">
                  <Filter /> {activeTest === row.caseId ? 'Clear filter' : 'Only this test'}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
