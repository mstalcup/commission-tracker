import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  firstRequestStage,
  formatLongDate,
  formatMoney,
  formatShortDate,
  monthKey,
  pctChange,
  prevMonthKey,
  stageById,
  type DashboardSummary,
} from '@ct/shared';
import { useNewCommission } from '../components/NewCommission';
import { ProfileForm } from '../components/ProfileForm';
import { Arrow, Button, Card, cx, Dot, ErrorNote, FooterLink, SectionTitle, Spinner } from '../components/ui';
import { useBusiness, useDashboard } from '../lib/queries';

const monthName = (key: string, style: 'long' | 'short' = 'long') =>
  new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-US', { month: style, timeZone: 'UTC' });

export function Dashboard() {
  const business = useBusiness();
  const dash = useDashboard();
  const newCommission = useNewCommission();
  const [dismissed, setDismissed] = useState(false);

  return (
    <div className="space-y-10">
      {!business.name && !dismissed && (
        <Card className="border-accent/40 p-5 sm:p-6">
          <p className="eyebrow text-accent">Welcome</p>
          <h2 className="display mt-1 text-3xl">Let’s set up your commission book</h2>
          <p className="mb-5 mt-1 text-sm text-muted">Add your business name and website. You can change these any time in Settings.</p>
          <ProfileForm business={business} compact onSaved={() => setDismissed(true)} />
        </Card>
      )}

      {dash.isPending ? (
        <Spinner />
      ) : dash.isError ? (
        <ErrorNote>{dash.error.message}</ErrorNote>
      ) : (
        <>
          <Overview d={dash.data} />
          <Projects d={dash.data} onNew={() => newCommission()} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Overview

function Overview({ d }: { d: DashboardSummary }) {
  const business = useBusiness();
  const cur = business.currency;
  const thisMonth = monthKey(d.today);
  const lastMonthShort = monthName(prevMonthKey(thisMonth), 'short');
  const requestStage = firstRequestStage(business.stages);

  return (
    <section>
      <SectionTitle right={<p className="eyebrow pb-1.5">{formatLongDate(d.today)}</p>}>Overview</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard to="/board" label="Open jobs" value={d.openJobs}>
          <p>{d.openJobsNewThisMonth} new this month</p>
        </StatCard>

        <StatCard to={`/commissions?stage=${requestStage.id}`} label="Commission requests" value={d.requests} valueClass="text-warn">
          <p>
            {d.requests === 0
              ? 'No requests waiting'
              : d.oldestRequestDays === 0
                ? 'Oldest came in today'
                : `Oldest waiting ${d.oldestRequestDays} day${d.oldestRequestDays === 1 ? '' : 's'}`}
          </p>
        </StatCard>

        <StatCard
          to="/money?tab=expenses"
          label="Expenses this month"
          value={formatMoney(d.expensesThisMonthCents, cur)}
          valueClass="text-bad"
          tone="bad"
        >
          <p>{formatMoney(d.expensesAllTimeCents, cur)} all time</p>
          <Change current={d.expensesThisMonthCents} previous={d.expensesLastMonthCents} currency={cur} vs={lastMonthShort} upIsGood={false} />
        </StatCard>

        <StatCard to="/money" label="Revenue this month" value={formatMoney(d.revenueThisMonthCents, cur)} valueClass="text-good" tone="good">
          <p>
            {d.paymentsThisMonth} payment{d.paymentsThisMonth === 1 ? '' : 's'} in {monthName(thisMonth)}
          </p>
          <Change current={d.revenueThisMonthCents} previous={d.revenueLastMonthCents} currency={cur} vs={lastMonthShort} upIsGood />
        </StatCard>
      </div>
    </section>
  );
}

function StatCard({
  to,
  label,
  value,
  valueClass,
  tone,
  children,
}: {
  to: string;
  label: string;
  value: ReactNode;
  valueClass?: string;
  tone?: 'good' | 'bad';
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cx(
        'group flex min-h-36 flex-col rounded-xl border border-line bg-panel p-5 transition hover:border-faint',
        tone === 'bad' && 'bg-[linear-gradient(135deg,#2a1d1a_0%,var(--color-panel)_55%)]',
        tone === 'good' && 'bg-[linear-gradient(135deg,#17271e_0%,var(--color-panel)_55%)]',
      )}
    >
      <div className="flex items-center justify-between">
        <p className="eyebrow">{label}</p>
        <Arrow className="text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
      </div>
      <p className={cx('display mt-3 text-5xl sm:text-6xl', valueClass)}>{value}</p>
      <div className="mt-2 space-y-1.5 text-sm text-muted">{children}</div>
    </Link>
  );
}

/** "↑ +$769.44 (262%) vs Oct" */
function Change({ current, previous, currency, vs, upIsGood }: { current: number; previous: number; currency: string; vs: string; upIsGood: boolean }) {
  const delta = current - previous;
  if (current === 0 && previous === 0) return null;
  const pct = pctChange(current, previous);
  const up = delta > 0;
  const good = delta === 0 ? null : up === upIsGood;
  return (
    <p className={cx('text-xs font-medium', good === null ? 'text-muted' : good ? 'text-good' : 'text-bad')}>
      {delta === 0 ? '→ same' : `${up ? '↑ +' : '↓ −'}${formatMoney(Math.abs(delta), currency)}`}
      {pct != null && delta !== 0 && ` (${Math.abs(Math.round(pct))}%)`}
      <span className="font-normal text-muted"> vs {vs}</span>
    </p>
  );
}

// ---------------------------------------------------------------- Projects

function Projects({ d, onNew }: { d: DashboardSummary; onNew: () => void }) {
  const business = useBusiness();
  const year = Number(d.today.slice(0, 4));
  const totalInStages = d.stageCounts.reduce((s, x) => s + x.count, 0);

  return (
    <section>
      <SectionTitle>Projects</SectionTitle>
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Jobs by stage */}
        <Card className="flex min-h-72 flex-col p-5">
          <h3 className="display text-2xl">Jobs by stage</h3>
          <div className="mt-3 flex h-3 gap-0.5 overflow-hidden rounded-full bg-panel-2" role="img" aria-label="Jobs by stage">
            {totalInStages > 0 &&
              d.stageCounts
                .filter((s) => s.count > 0)
                .map((s) => {
                  const stage = stageById(business.stages, s.stageId);
                  return <span key={s.stageId} style={{ flexGrow: s.count, background: stage?.color }} title={`${stage?.name}: ${s.count}`} />;
                })}
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {d.stageCounts.map((s) => {
              const stage = stageById(business.stages, s.stageId);
              return (
                <li key={s.stageId} className="flex items-center gap-2">
                  <Dot color={stage?.color ?? '#888'} />
                  <span className="truncate text-muted">{stage?.name}</span>
                  <span className="ml-auto font-semibold">{s.count}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-6 flex flex-1 flex-col">
            <FooterLink to="/board">Open the stage board</FooterLink>
          </div>
        </Card>

        {/* Timeline */}
        <Card className="flex min-h-72 flex-col p-5">
          <h3 className="display text-2xl">Timeline</h3>
          {d.upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No due dates set on open jobs yet.</p>
          ) : (
            <ul className="mt-3 space-y-2.5 text-sm">
              {d.upcoming.map((u) => {
                const overdue = u.dueDate < d.today;
                return (
                  <li key={u.commissionId}>
                    <Link to={`/commissions/${u.commissionId}`} className="flex items-baseline gap-3 hover:text-good">
                      <span className={cx('w-14 shrink-0 text-xs font-semibold', overdue ? 'text-bad' : 'text-muted')}>
                        {formatShortDate(u.dueDate, year)}
                      </span>
                      <span className="truncate">{u.title}</span>
                      {overdue && <span className="ml-auto shrink-0 text-xs text-bad">Overdue</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-6 flex flex-1 flex-col">
            <FooterLink to="/timeline">See every deadline</FooterLink>
          </div>
        </Card>

        {/* Commissions */}
        <Card className="flex min-h-72 flex-col p-5">
          <h3 className="display text-2xl">Commissions</h3>
          <p className="mt-2 flex items-baseline gap-3">
            <span className="display text-5xl">{d.totalCommissions}</span>
            <span className="text-sm text-muted">commission{d.totalCommissions === 1 ? '' : 's'} on the books</span>
          </p>
          {d.latest.length > 0 ? (
            <>
              <p className="eyebrow mt-4">Latest added</p>
              <ul className="mt-2 space-y-2 text-sm">
                {d.latest.map((c) => (
                  <li key={c.commissionId}>
                    <Link to={`/commissions/${c.commissionId}`} className="flex justify-between gap-3 hover:text-good">
                      <span className="truncate">{c.title}</span>
                      <span className="shrink-0 text-muted">{c.clientName}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="mt-4">
              <Button size="sm" variant="primary" onClick={onNew}>+ Add your first commission</Button>
            </div>
          )}
          <div className="mt-6 flex flex-1 flex-col">
            <FooterLink to="/commissions">See all commissions</FooterLink>
          </div>
        </Card>
      </div>
    </section>
  );
}
