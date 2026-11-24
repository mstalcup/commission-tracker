import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorNote, Spinner } from './components/ui';
import { useAuth } from './lib/auth';
import { useMe } from './lib/queries';
import { Callback } from './pages/Callback';
import { Dashboard } from './pages/Dashboard';
import { Landing } from './pages/Landing';

// Other pages load on first visit, keeping the initial download small.
const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));
const Board = page(() => import('./pages/Board'), 'Board');
const Commissions = page(() => import('./pages/Commissions'), 'Commissions');
const CommissionDetail = page(() => import('./pages/CommissionDetail'), 'CommissionDetail');
const Timeline = page(() => import('./pages/Timeline'), 'Timeline');
const Money = page(() => import('./pages/Money'), 'Money');
const Clients = page(() => import('./pages/Clients'), 'Clients');
const ClientDetail = page(() => import('./pages/Clients'), 'ClientDetail');
const Settings = page(() => import('./pages/Settings'), 'Settings');

export function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/callback" element={<Callback />} />
      <Route path="*" element={loading ? <Spinner /> : user ? <SignedIn /> : <Landing />} />
    </Routes>
  );
}

/** Loads the user's business first, so every page can rely on it. */
function SignedIn() {
  const me = useMe();
  if (me.isPending) return <Spinner label="Opening your commission book…" />;
  if (me.isError) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <ErrorNote>{me.error.message}</ErrorNote>
      </div>
    );
  }
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="board" element={<Board />} />
        <Route path="commissions" element={<Commissions />} />
        <Route path="commissions/:id" element={<CommissionDetail />} />
        <Route path="timeline" element={<Timeline />} />
        <Route path="money" element={<Money />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
