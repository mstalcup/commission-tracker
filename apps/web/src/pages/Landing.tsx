import { useState } from 'react';
import { LampIcon } from '../components/Layout';
import { Button } from '../components/ui';
import { signIn, useAuth } from '../lib/auth';

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

const POINTS = [
  ['Every job in one place', 'From first inquiry to delivered, on a simple stage board.'],
  ['Know what’s owed', 'Quotes, deposits and payments add up to a clear balance per job.'],
  ['See the month at a glance', 'Revenue and expenses, compared with last month.'],
];

export function Landing() {
  const { config } = useAuth();
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-4 py-16 sm:px-6">
      <div className="grid h-14 w-14 place-items-center rounded-xl border border-accent/50 bg-panel text-accent">
        <LampIcon className="h-7 w-7" />
      </div>
      <h1 className="display mt-6 text-6xl sm:text-8xl">Commission Book</h1>
      <p className="mt-3 max-w-xl text-lg text-muted">
        Every job, what it’s worth, and what’s still owed. Built for makers, artists and anyone who takes commissions.
      </p>
      <div className="mt-8">
        <Button
          variant="primary"
          busy={busy}
          onClick={() => {
            setBusy(true);
            signIn('/').catch(() => setBusy(false));
          }}
        >
          {config.googleEnabled && (
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white">
              <GoogleMark />
            </span>
          )}
          {config.googleEnabled ? 'Sign in with Google' : 'Sign in'}
        </Button>
        {!config.googleEnabled && (
          <p className="mt-3 text-xs text-warn">Google sign-in isn’t configured yet. See docs/setup.md.</p>
        )}
      </div>
      <div className="mt-16 grid gap-4 sm:grid-cols-3">
        {POINTS.map(([title, body]) => (
          <div key={title} className="rounded-xl border border-line bg-panel p-5">
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
