import { Button, Loader, Toasty, TooltipProvider } from '@cloudflare/kumo';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { LoginScreen } from '@/components/LoginScreen';
import { ApiError, api, errorMessage, logout } from '@/lib/api';
import { overviewSchema } from '@/lib/contracts';
import { useHashRoute } from '@/lib/hooks';
import { OverviewPage } from '@/pages/OverviewPage';
import { ServersPage } from '@/pages/ServersPage';
import { CredentialsPage } from '@/pages/CredentialsPage';
import { KeysPage } from '@/pages/KeysPage';
import { LogsPage } from '@/pages/LogsPage';

export function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [route, go] = useHashRoute();

  const checkSession = useCallback(async () => {
    setSessionError(null);
    try {
      await api('/api/v1/overview', overviewSchema);
      setAuthed(true);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setAuthed(false);
      } else {
        setSessionError(errorMessage(cause));
      }
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  let content;
  if (authed === null && sessionError) {
    content = (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-sm font-medium text-kumo-strong">无法连接 MCP Home</p>
        <p className="max-w-md text-xs text-kumo-subtle">{sessionError}</p>
        <Button variant="secondary" size="sm" onClick={() => void checkSession()}>
          重试
        </Button>
      </div>
    );
  } else if (authed === null) {
    content = (
      <div className="flex min-h-screen items-center justify-center">
        <Loader />
      </div>
    );
  } else if (!authed) {
    content = <LoginScreen onSuccess={() => setAuthed(true)} />;
  } else {
    content = (
      <AppShell
        route={route}
        onNavigate={go}
        onLogout={async () => {
          try {
            await logout();
          } finally {
            setAuthed(false);
          }
        }}
      >
        {route === 'overview' && <OverviewPage onNavigate={go} />}
        {route === 'servers' && <ServersPage />}
        {route === 'credentials' && <CredentialsPage />}
        {route === 'keys' && <KeysPage />}
        {route === 'logs' && <LogsPage />}
      </AppShell>
    );
  }

  return (
    <Toasty>
      <TooltipProvider>{content}</TooltipProvider>
    </Toasty>
  );
}
