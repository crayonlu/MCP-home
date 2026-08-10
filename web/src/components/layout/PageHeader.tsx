import type { ReactNode } from 'react';

export function PageHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-kumo-line px-4">
      <h1 className="text-sm font-semibold tracking-tight text-kumo-strong">{title}</h1>
      {children && <div className="flex items-center gap-1.5">{children}</div>}
    </header>
  );
}
