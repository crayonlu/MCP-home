import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from '@/components/layout/AppShell';
import { LoginScreen } from '@/components/LoginScreen';
import { Button } from '@/components/ui/button';
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

  if (authed === null && sessionError) {
    return (
      <div className="flex min-h-screen w-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
        <p className="text-sm font-medium text-foreground">无法连接 MCP Home</p>
        <p className="max-w-md text-xs text-muted-foreground">{sessionError}</p>
        <Button variant="outline" size="sm" onClick={() => void checkSession()}>
          重试
        </Button>
      </div>
    );
  }

  if (authed === null) {
    return (
      <div className="flex min-h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!authed) return <LoginScreen onSuccess={() => setAuthed(true)} />;

  return (
    <TooltipProvider delayDuration={250}>
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
      <Toaster />
    </TooltipProvider>
  );
}
