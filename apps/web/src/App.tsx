import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorNote, Spinner } from './components/ui';
import { useAuth } from './lib/auth';
import { useMe } from './lib/queries';
import { Board } from './pages/Board';
import { Callback } from './pages/Callback';
import { CommissionDetail } from './pages/CommissionDetail';
import { Commissions } from './pages/Commissions';
import { Dashboard } from './pages/Dashboard';
import { Landing } from './pages/Landing';
import { Money } from './pages/Money';
import { Settings } from './pages/Settings';

export function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/callback" element={<Callback />} />
      <Route
        path="*"
        element={loading ? <Spinner /> : user ? <SignedIn /> : <Landing />}
      />
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
        <Route path="money" element={<Money />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
