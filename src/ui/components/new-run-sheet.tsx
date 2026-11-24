import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { caseFilterFor, modelFamily, modelLabel, pickedCases } from '#/shared/report.ts';
import { navigate, useActions, useStore } from '../store';
import { CasePicker } from './case-picker';
import { ModelMark } from './evals';
import { Button } from './ui/button';
import { cn } from './ui/cn';
import { Input } from './ui/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from './ui/sheet';
import { Switch } from './ui/switch';
import type { RunSummary } from '#/shared/report.types.ts';

interface NewRunSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseline?: RunSummary;
}

export function NewRunSheet({ open, onOpenChange, baseline }: NewRunSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <NewRunForm baseline={baseline} key={baseline?.id} onOpenChange={onOpenChange} />
      </SheetContent>
    </Sheet>
  );
}

function NewRunForm({ onOpenChange, baseline }: Omit<NewRunSheetProps, 'open'>) {
  const { start, pending } = useActions();
  const { settings } = useStore();
  const [label, setLabel] = useState('');
  // Without --models the evals run as they are, so there is nothing to pick.
  const [models, setModels] = useState<string[]>(() => (settings.models.length ? baseline?.models.filter(Boolean) ?? settings.models.slice(0, 1) : []));
  const [judge, setJudge] = useState(baseline?.judge ?? settings.judges[0]);
  const [custom, setCustom] = useState('');
  const [picked, setPicked] = useState<string[]>(() => pickedCases(baseline?.caseFilter));
  const [asBaseline, setAsBaseline] = useState(!baseline);

  // A run compares one model per family, so picking a model replaces the other model of its family.
  const toggle = (model: string) => setModels((current) => (current.includes(model)
    ? current.filter((item) => item !== model)
    : [...current.filter((item) => modelFamily(item) !== modelFamily(model)), model]));

  const all = [...new Set([...settings.models, ...models])];

  const submit = async () => {
    const run = await start({
      label: label.trim() || (asBaseline ? 'Baseline' : 'New run'),
      baseline: asBaseline,
      models,
      judge: settings.judges.length ? judge : undefined,
      caseFilter: picked.length ? caseFilterFor(picked) : undefined,
    });

    if (!run) {
      return;
    }
    onOpenChange(false);
    setLabel('');
    navigate(asBaseline ? '/' : `/runs/${run.id}`);
  };

  return (
    <>
      <SheetHeader className="border-b p-6">
        <SheetTitle className="text-base font-medium">New run</SheetTitle>
        <SheetDescription>Runs the evals{settings.models.length ? ' once per model you pick' : ''}. Cases that call a model cost money.</SheetDescription>
      </SheetHeader>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Name</span>
          <Input onChange={(event) => setLabel(event.target.value)} placeholder="Shorter tool descriptions" value={label} />
        </label>
        {settings.models.length ? (<div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Models</span>
          <div className="flex flex-wrap gap-2">
            {all.map((model) => {
              const on = models.includes(model);
              const tone = on ? 'border-transparent bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground';
              return (
                <button
                  className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border pr-3 pl-2 text-sm transition-colors', tone)}
                  key={model}
                  onClick={() => toggle(model)}
                  type="button"
                >
                  <ModelMark className="size-3" model={model} />
                  {modelLabel(model.split('@')[0] ?? model)}
                </button>
              );
            })}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (custom.trim()) {
                setModels((current) => [...current.filter((item) => modelFamily(item) !== modelFamily(custom.trim())), custom.trim()]);
              }
              setCustom('');
            }}
          >
            <Input onChange={(event) => setCustom(event.target.value)} placeholder="Another model" value={custom} />
            <Button type="submit" variant="outline">Add</Button>
          </form>
        </div>) : null}
        {settings.judges.length ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Judge</span>
            <div className="flex flex-wrap gap-2">
              {settings.judges.map((item) => (
                <button
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
                    item === judge ? 'border-transparent bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground',
                  )}
                  key={item}
                  onClick={() => setJudge(item)}
                  type="button"
                >
                  {modelLabel(item.split('@')[0] ?? item)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Cases</span>
          <CasePicker onChange={setPicked} value={picked} />
          <span className="text-xs text-muted-foreground">Leave empty to run every case.</span>
        </div>
        <label className="flex items-center justify-between gap-4 rounded-(--radius-control) border p-4">
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Make this the baseline</span>
            <span className="text-xs text-muted-foreground">Every other run is compared with it.</span>
          </span>
          <Switch checked={asBaseline} onCheckedChange={setAsBaseline} />
        </label>
        {asBaseline && picked.length ? (
          <p className="flex gap-2.5 rounded-(--radius-control) bg-warning/10 p-3 text-xs leading-relaxed text-warning">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <span>
                This baseline will only have {picked.length} {picked.length === 1
                ? 'case'
                : 'cases'}. Later runs are compared on those cases alone, and every other case shows up as new with nothing before it.
            </span>
          </p>
        ) : null}
      </div>
      <SheetFooter className="flex-row justify-end border-t p-6">
        <Button onClick={() => onOpenChange(false)} variant="ghost">Cancel</Button>
        <Button disabled={Boolean(settings.models.length) && !models.length} onClick={() => void submit()} pending={pending}>Start run</Button>
      </SheetFooter>
    </>
  );
}
