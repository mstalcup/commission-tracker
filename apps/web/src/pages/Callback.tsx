import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorNote, Spinner } from '../components/ui';
import { completeSignIn } from '../lib/auth';

/** Google → Cognito sends the user back here with a one-time code. */
export function Callback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // StrictMode runs effects twice in dev; the code is single-use.
    ran.current = true;
    completeSignIn()
      .then((to) => navigate(to, { replace: true }))
      .catch((err: Error) => setError(err.message));
  }, [navigate]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8">
        <ErrorNote>Sign-in failed: {error}</ErrorNote>
        <a href="/" className="text-sm text-accent">
          Back to start
        </a>
      </div>
    );
  }
  return <Spinner label="Signing you in…" />;
}
