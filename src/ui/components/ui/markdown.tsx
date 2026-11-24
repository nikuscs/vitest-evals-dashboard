import { Streamdown } from 'streamdown';
import { cn } from './cn';
import type { ComponentProps, HTMLAttributes } from 'react';
import type { Components, ExtraProps } from 'streamdown';

interface MarkdownProps {
  text: string;
  className?: string;
}

type MarkdownTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'ul' | 'ol' | 'li' | 'blockquote' | 'hr' | 'strong' | 'em' | 'thead' | 'tbody' | 'tr' | 'th' | 'td';

function markdownElement(Tag: MarkdownTag, base: string) {
  return function MarkdownElement({ node: _node, className, ...props }: HTMLAttributes<HTMLElement> & ExtraProps) {
    return <Tag className={cn(base, className)} {...props} />;
  };
}

function MarkdownCode({ node: _node, className, children, 'data-block': block, ...props }: ComponentProps<'code'> & ExtraProps & { 'data-block'?: string }) {
  if (block === undefined) {
    return <code className="rounded-[5px] bg-muted px-1 py-0.5 font-mono text-[0.85em]" {...props}>{children}</code>;
  }

  return (
    <pre className="max-h-96 overflow-auto rounded-(--radius-control) border bg-muted p-3 font-mono text-xs leading-relaxed">
      <code className={className} {...props}>{children}</code>
    </pre>
  );
}

function MarkdownLink({ node: _node, className, href, children, ...props }: ComponentProps<'a'> & ExtraProps) {
  return (
    <a
      className={cn('font-medium underline decoration-current/30 underline-offset-2 transition-colors hover:decoration-current', className)}
      href={href}
      rel="noreferrer"
      target="_blank"
      {...props}
    >
      {children}
    </a>
  );
}

function MarkdownTable({ node: _node, className, ...props }: ComponentProps<'table'> & ExtraProps) {
  return (
    <div className="max-w-full overflow-x-auto rounded-(--radius-control) border bg-card">
      <table className={cn('w-max min-w-full border-collapse text-[13px] tabular-nums', className)} {...props} />
    </div>
  );
}

function MarkdownImage({ node: _node, className, alt, ...props }: ComponentProps<'img'> & ExtraProps) {
  return <img alt={alt ?? ''} className={cn('max-h-96 max-w-full rounded-(--radius-control) border', className)} loading="lazy" {...props} />;
}

const markdownComponents: Components = {
  a: MarkdownLink,
  h1: markdownElement('h1', 'mt-6 mb-2 text-lg font-semibold tracking-[-0.02em] text-balance'),
  h2: markdownElement('h2', 'mt-6 mb-2 text-base font-semibold tracking-[-0.01em] text-balance'),
  h3: markdownElement('h3', 'mt-5 mb-1.5 text-sm font-semibold text-balance'),
  h4: markdownElement('h4', 'mt-4 mb-1 text-sm font-semibold'),
  h5: markdownElement('h5', 'mt-4 mb-1 text-sm font-medium'),
  h6: markdownElement('h6', 'mt-4 mb-1 text-sm font-medium text-muted-foreground'),
  p: markdownElement('p', 'text-pretty'),
  ul: markdownElement('ul', 'flex list-disc flex-col gap-1 pl-5 marker:text-muted-foreground'),
  ol: markdownElement('ol', 'flex list-decimal flex-col gap-1 pl-5 marker:text-muted-foreground marker:tabular-nums'),
  li: markdownElement('li', 'pl-0.5 [&>ol]:mt-1 [&>p]:inline [&>ul]:mt-1'),
  blockquote: markdownElement('blockquote', 'border-l-2 border-(--border-strong) pl-3 text-muted-foreground'),
  hr: markdownElement('hr', 'border-border'),
  strong: markdownElement('strong', 'font-semibold'),
  em: markdownElement('em', 'italic'),
  code: MarkdownCode,
  img: MarkdownImage,
  table: MarkdownTable,
  thead: markdownElement('thead', ''),
  tbody: markdownElement('tbody', '[&>tr:last-child>td]:border-0'),
  tr: markdownElement('tr', ''),
  th: markdownElement('th', 'h-9 border-b px-3 text-left text-xs font-normal whitespace-nowrap text-muted-foreground'),
  td: markdownElement('td', 'h-10 border-b border-border/60 px-3 whitespace-nowrap'),
};

export function Markdown({ text, className }: MarkdownProps) {
  return (
    <Streamdown
      className={cn('min-w-0 space-y-3 text-sm leading-relaxed text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0', className)}
      components={markdownComponents}
      controls={false}
      linkSafety={{ enabled: false }}
      mode="static"
    >
      {text}
    </Streamdown>
  );
}
