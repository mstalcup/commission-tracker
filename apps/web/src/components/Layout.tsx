import { NavLink, Outlet } from 'react-router-dom';
import { signOut } from '../lib/auth';
import { useMe } from '../lib/queries';
import { NewCommissionProvider, useNewCommission } from './NewCommission';
import { Button, cx } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/board', label: 'Stage board' },
  { to: '/commissions', label: 'Commissions' },
  { to: '/settings', label: 'Settings' },
];

export function LampIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M7.5 4h9l-2 7h-5z M12 11v7 M8.5 20h7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Layout() {
  return (
    <NewCommissionProvider>
      <Shell />
    </NewCommissionProvider>
  );
}

function Shell() {
  const { data } = useMe();
  const newCommission = useNewCommission();
  const business = data?.business;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-[radial-gradient(ellipse_at_top_left,#16201b_0%,transparent_60%)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-accent/50 bg-panel text-accent sm:h-14 sm:w-14">
              <LampIcon className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div className="min-w-0">
              <h1 className="display truncate text-4xl sm:text-5xl">{business?.name || 'Your commission book'}</h1>
              <p className="truncate text-sm text-muted">
                {business?.tagline || 'Commission book: every job, what it’s worth, and what’s still owed.'}
              </p>
            </div>
          </div>
          <Button variant="primary" onClick={() => newCommission()}>
            <span className="text-lg leading-none">+</span> New commission
          </Button>
        </div>
        <nav className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cx(
                  'whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium',
                  isActive ? 'bg-panel-2 text-ink' : 'text-muted hover:text-ink',
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
          <button
            onClick={() => signOut()}
            className="ml-auto whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm text-faint hover:text-ink"
            title={data?.user.email}
          >
            Sign out
          </button>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
