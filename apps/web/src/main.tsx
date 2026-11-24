import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider, initAuth } from './lib/auth';
import { loadConfig } from './lib/config';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

loadConfig()
  .then((config) => {
    initAuth(config);
    root.render(
      <StrictMode>
        <AuthProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </QueryClientProvider>
        </AuthProvider>
      </StrictMode>,
    );
  })
  .catch((err: Error) => {
    root.render(
      <div style={{ padding: 32, fontFamily: 'system-ui', color: '#eee' }}>
        <h1>Can’t start the app</h1>
        <p>{err.message}</p>
      </div>,
    );
  });
