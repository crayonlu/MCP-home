import * as Toast from '@radix-ui/react-toast';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppShell } from './components/AppShell.js';
import { LoginScreen } from './components/LoginScreen.js';
import { Button } from './components/ui/Button.js';
import { LoadingScreen } from './components/ui/LoadingScreen.js';
import { ApiError, api, errorMessage, logout } from './lib/api.js';
import { overviewSchema, type View } from './lib/contracts.js';
import { CredentialsPage } from './pages/CredentialsPage.js';
import { DiagnosticsPage } from './pages/DiagnosticsPage.js';
import { KeysPage } from './pages/KeysPage.js';
import { OverviewPage } from './pages/OverviewPage.js';
import { ServersPage } from './pages/ServersPage.js';

export function App(): ReactNode {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [view, setView] = useState<View>('overview');
  const [toast, setToast] = useState<{ title: string; detail?: string } | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const checkSession = useCallback(async () => {
    setSessionError(null);
    try {
      await api('/api/v1/overview', overviewSchema);
      setAuthenticated(true);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setAuthenticated(false);
      } else {
        setSessionError(errorMessage(cause));
      }
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const notify = useCallback((title: string, detail?: string) => {
    setToast({ title, ...(detail === undefined ? {} : { detail }) });
  }, []);

  if (authenticated === null && sessionError) {
    return (
      <div className="loading-screen connection-error" role="alert">
        <strong>无法连接 MCP Home</strong>
        <span>{sessionError}</span>
        <Button variant="secondary" size="small" onClick={() => void checkSession()}>
          重试连接
        </Button>
      </div>
    );
  }
  if (authenticated === null) return <LoadingScreen label="正在连接 MCP Home" />;
  if (!authenticated) return <LoginScreen onSuccess={() => setAuthenticated(true)} />;

  return (
    <Toast.Provider swipeDirection="right" duration={4200}>
      <AppShell
        view={view}
        onViewChange={setView}
        onLogout={async () => {
          try {
            await logout();
            setAuthenticated(false);
          } catch (cause) {
            notify('退出失败', errorMessage(cause));
          }
        }}
      >
        {view === 'overview' && <OverviewPage onNavigate={setView} />}
        {view === 'servers' && <ServersPage notify={notify} />}
        {view === 'credentials' && <CredentialsPage notify={notify} />}
        {view === 'keys' && <KeysPage notify={notify} />}
        {view === 'diagnostics' && <DiagnosticsPage />}
      </AppShell>
      <Toast.Root
        className="toast"
        open={toast !== null}
        onOpenChange={(open) => {
          if (!open) setToast(null);
        }}
      >
        <Toast.Title className="toast-title">{toast?.title}</Toast.Title>
        {toast?.detail && (
          <Toast.Description className="toast-detail">{toast.detail}</Toast.Description>
        )}
      </Toast.Root>
      <Toast.Viewport className="toast-viewport" />
    </Toast.Provider>
  );
}
