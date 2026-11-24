import { FlaskConical, RotateCw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { navigate, useStore } from '../store';
import { cn } from './ui/cn';
import { ThemeSwitch } from './ui/theme-switch';
import type { Source } from '../store';
import type { ReactNode } from 'react';

const THEME_KEY = 'evals-ui-theme';

export function initialDark() {
  const saved = localStorage.getItem(THEME_KEY);
  const dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);

  return dark;
}

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  const change = (next: boolean, trigger: HTMLButtonElement) => {
    const apply = () => {
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
      setDark(next);
    };

    if (!('startViewTransition' in document) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      apply();
      return;
    }

    const { left, top, width, height } = trigger.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = document.startViewTransition(apply);
    void transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
          },
          {
            duration: 480,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            pseudoElement: '::view-transition-new(root)',
          },
        );
      })
      .catch(() => undefined);
  };

  return <ThemeSwitch dark={dark} onThemeChange={change} />;
}

const TABS = [{ source: 'evals', label: 'Evals', path: '/' }, { source: 'braintrust', label: 'Braintrust', path: '/braintrust' }] as const;

function tabTone(active: boolean): string {
  return active ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground';
}

export function Shell({ crumb, source, children }: { crumb?: ReactNode; source: Source; children: ReactNode }) {
  const { settings } = useStore();
  // The Braintrust tab shows only when its credentials were found.
  const tabs = TABS.filter((tab) => tab.source === 'evals' || settings.braintrust);
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-(--shell-header) max-w-6xl items-center gap-2 px-4 md:px-8">
          <span className="mr-2 grid size-6 place-items-center rounded-lg bg-primary text-primary-foreground"><FlaskConical className="size-3.5" /></span>
          <nav className="flex items-center gap-0.5">
            {tabs.map((tab) => (
              <button
                className={cn('rounded-full px-3 py-1 text-sm transition-colors', tabTone(tab.source === source))}
                key={tab.source}
                onClick={() => navigate(tab.path)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </nav>
          {crumb ? <><span className="text-muted-foreground/60">/</span><span className="truncate text-sm text-muted-foreground">{crumb}</span></> : null}
          <span className="ml-auto" />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-6xl">{children}</main>
      <Toast />
    </div>
  );
}

function Toast() {
  const { toast } = useStore();

  if (!toast) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4" key={toast.id}>
      <div className="flex animate-in items-center gap-2.5 rounded-full border bg-popover py-2 pr-4 pl-3 text-sm text-popover-foreground shadow-(--shadow-floating) duration-300 fade-in slide-in-from-bottom-2">
        {toast.tone === 'info' || !toast.tone
          ? <span className="grid size-5 place-items-center rounded-full bg-info/14 text-info"><RotateCw className="size-3" /></span>
          : <span className={toast.tone === 'error'
            ? 'grid size-5 place-items-center rounded-full bg-destructive/14 text-destructive'
            : 'grid size-5 place-items-center rounded-full bg-warning/16 text-warning'}><TriangleAlert className="size-3" /></span>}
        {toast.text}
      </div>
    </div>
  );
}
