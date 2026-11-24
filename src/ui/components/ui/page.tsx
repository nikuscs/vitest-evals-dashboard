import { cn } from './cn';
import type { ComponentProps, ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  media?: ReactNode;
  actions?: ReactNode;
}

function Page({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('-mt-(--shell-header) flex min-w-0 flex-col gap-4 px-4 pt-[calc(var(--shell-header)+--spacing(6))] pb-8 md:px-8', className)}
      data-slot="page"
      {...props}
    />
  );
}

function PageHeader({ title, description, eyebrow, media, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3" data-slot="page-header">
      <div className="flex min-w-0 items-center gap-3">
        {media}
        <div className="flex min-w-0 flex-col gap-0.5">
          {eyebrow ? <p className="text-xs text-muted-foreground">{eyebrow}</p> : null}
          <h1 className="flex items-center gap-3 text-xl font-medium tracking-(--tracking-display)">{title}</h1>
          {description ? <p className="text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export { Page, PageHeader };
