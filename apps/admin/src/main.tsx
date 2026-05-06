import * as Sentry from '@sentry/react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouter } from './app/router';
import { AuthProvider } from './features/auth/auth-provider';
import './styles/index.css';

// Sentry — only initializes when VITE_SENTRY_DSN is set at build time.
// Vite resolves import.meta.env.* at build, so the DSN gets baked into
// the bundle. Set on prod via apps/admin/.env (gitignored).
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE,
    // No browser tracing / replays — keeps free-tier quotas for actual errors.
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
  });
}

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>,
);
