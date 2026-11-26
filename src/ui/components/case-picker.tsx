import { Check, ChevronsUpDown, LoaderCircle, Minus, RotateCw, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { cn } from './ui/cn';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import type { EvalCase } from '#/shared/report.types.ts';

let cache: Promise<EvalCase[]> | undefined;

const fetchCases = (refresh = false) => {
  if (refresh || !cache) {
    const request = refresh ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' } : undefined;
    cache = fetch('/api/cases', request).then(async (response) => {
      if (!response.ok) {
        throw new Error(((await response.json()) as { error?: string }).error ?? 'Could not read the evals');
      }
      return response.json() as Promise<EvalCase[]>;
    });
    cache.catch(() => (cache = undefined));
  }
  return cache;
};

function BoxMark({ state }: { state: boolean | 'some' }) {
  if (state === 'some') {
    return <Minus className="size-3" strokeWidth={3} />;
  }

  return state ? <Check className="size-3" strokeWidth={3} /> : null;
}

function Box({ state }: { state: boolean | 'some' }) {
  const tone = state ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background';

  return (
    <span className={cn('grid size-4 shrink-0 place-items-center rounded-[5px] border transition-colors', tone)}>
      <BoxMark state={state} />
    </span>
  );
}

function suiteState(count: number, total: number): boolean | 'some' {
  if (count === total) {
    return true;
  }

  return count ? 'some' : false;
}

interface CaseListProps {
  cases: EvalCase[] | undefined;
  error: string | undefined;
  shown: EvalCase[];
  query: string;
  picked: Set<string>;
  toggle: (ids: string[], on: boolean) => void;
  onRetry: () => void;
}

function CaseList({ cases, error, shown, query, picked, toggle, onRetry }: CaseListProps) {
  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
        {error}
        <button className="inline-flex items-center gap-1.5 text-foreground hover:underline" onClick={onRetry} type="button"><RotateCw className="size-3.5" /> Try again</button>
      </div>
    );
  }

  if (!cases) {
    return <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Reading the evals…</div>;
  }

  if (!shown.length) {
    return <p className="px-4 py-8 text-center text-sm text-muted-foreground">No case matches “{query}”.</p>;
  }

  const suites = [...new Set(shown.map((item) => item.suite))];

  return suites.map((suite) => {
    const items = shown.filter((item) => item.suite === suite);
    const count = items.filter((item) => picked.has(item.id)).length;
    const state = suiteState(count, items.length);
    return (
      <div className="pb-1" key={suite}>
        <button className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-muted/60" onClick={() => toggle(
          items.map((item) => item.id),
          state !== true,
        )} type="button">
          <Box state={state} />
          <span className="flex-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{suite.replaceAll('-', ' ')}</span>
          <span className="text-[11px] text-muted-foreground tabular-nums">{count ? `${count}/` : ''}{items.length}</span>
        </button>
        {items.map((item) => (
          <button className="flex w-full items-center gap-2.5 rounded-md py-1.5 pr-2 pl-4 text-left hover:bg-muted/60" key={item.id} onClick={() => toggle(
            [item.id],
            !picked.has(item.id),
          )} type="button">
            <Box state={picked.has(item.id)} />
            <span className="shrink-0 text-xs font-medium">{item.id}</span>
            <span className="min-w-0 truncate text-xs text-muted-foreground" title={item.title}>{item.title}</span>
          </button>
        ))}
      </div>
    );
  });
}

interface CasePickerProps {
  value: string[];
  onChange: (ids: string[]) => void;
}

// Pick cases to run by name: search, tick single cases or a whole area. Nothing ticked runs every case.
export function CasePicker({ value, onChange }: CasePickerProps) {
  const [cases, setCases] = useState<EvalCase[]>();
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const load = (refresh = false) => {
    setError(undefined);
    if (refresh) {
      setCases(undefined);
    }
    fetchCases(refresh).then(setCases, (reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
  };

  useEffect(() => load(), []);

  const picked = new Set(value);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);

  const shown = useMemo(
    () => (cases ?? []).filter((item) => words.every((word) => `${item.id} ${item.title} ${item.suite}`.toLowerCase().includes(word))),
    [cases, query],
  );

  const toggle = (ids: string[], on: boolean) => onChange(on
    ? [...new Set([...value, ...ids])]
    : value.filter((id) => !ids.includes(id)));

  return (
    <Popover
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery('');
        }
      }}
      open={open}
    >
      <PopoverTrigger asChild>
        <button
          className="flex min-h-(--control-height-sm) w-full items-center gap-2 rounded-(--radius-control) border border-input bg-transparent py-1 pr-2 pl-3 text-left text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          type="button"
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {value.length ? (
              <>
                {value.slice(0, 4)
                  .map((id) => (
                    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-muted pr-1 pl-2 text-xs font-medium" key={id}>
                      {id}
                      <span
                        aria-label={`Remove ${id}`}
                        className="grid size-4 place-items-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggle([id], false);
                        }}
                        role="button"
                      >
                        <X className="size-3" />
                      </span>
                    </span>
                  ))}
                {value.length > 4 ? <span className="px-1 text-xs text-muted-foreground">+{value.length - 4} more</span> : null}
              </>
            ) : <span className="text-muted-foreground">Every case</span>}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-(--radix-popover-trigger-width) flex-col p-0" inline>
        <label className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by ID, name or area"
            value={query}
          />
          {query
            ? <button className="text-muted-foreground hover:text-foreground" onClick={() => setQuery('')} type="button"><X className="size-4" /></button>
            : null}
        </label>
        <div className="max-h-80 overflow-y-auto overscroll-contain p-1">
          <CaseList cases={cases} error={error} onRetry={() => load(true)} picked={picked} query={query} shown={shown} toggle={toggle} />
        </div>
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
          <span className="tabular-nums">{value.length ? `${value.length} of ${cases?.length ?? '…'} cases` : `All ${cases?.length ?? ''} cases`}</span>
          <span className="flex items-center gap-3">
            {value.length ? <button className="hover:text-foreground" onClick={() => onChange([])} type="button">Clear</button> : null}
            <button className="font-medium text-foreground hover:underline" onClick={() => setOpen(false)} type="button">Done</button>
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
