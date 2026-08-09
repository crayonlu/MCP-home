import type { ReactNode } from 'react';

export function LoadingScreen({ label }: { label: string }): ReactNode {
  return (
    <div className="loading-screen" role="status">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  );
}
