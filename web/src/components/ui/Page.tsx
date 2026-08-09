import type { ReactNode } from 'react';
import { Button } from './Button.js';

export function Page({
  title,
  eyebrow,
  description,
  action,
  children,
}: {
  title: string;
  eyebrow: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {action && <div className="page-action">{action}</div>}
      </header>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}): ReactNode {
  return (
    <div className="empty-state">
      <div className="empty-rule" />
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function LoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry(): void | Promise<void>;
}): ReactNode {
  return (
    <div className="load-error" role="alert">
      <div>
        <strong>无法读取最新状态</strong>
        <span>{message}</span>
      </div>
      <Button variant="secondary" size="small" onClick={() => void onRetry()}>
        重新加载
      </Button>
    </div>
  );
}
