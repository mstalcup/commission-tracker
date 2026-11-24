import { Link } from 'react-router-dom';
import { addDays, formatShortDate, todayISO, weekStart, type Commission } from '@ct/shared';
import { StageBadge, stageOf } from '../components/commission-bits';
import { Card, cx, EmptyState, ErrorNote, PageHeader, Spinner } from '../components/ui';
import { useBusiness, useClientMap, useCommissions } from '../lib/queries';

/** Every deadline on open work, grouped by week, overdue first. */
export function Timeline() {
  const business = useBusiness();
  const commissions = useCommissions();
  const clients = useClientMap();

  if (commissions.isPending) return <Spinner />;
  if (commissions.isError) return <ErrorNote>{commissions.error.message}</ErrorNote>;

  const today = todayISO(business.timezone);
  const thisWeek = weekStart(today);
  const year = Number(today.slice(0, 4));
  const active = commissions.data.filter((c) => {
    const kind = stageOf(business, c)?.kind;
    return kind === 'open' || kind === 'request';
  });
  const dated = active.filter((c) => c.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const undated = active.filter((c) => !c.dueDate);

  const overdue = dated.filter((c) => c.dueDate! < today);
  const weeks = new Map<string, Commission[]>();
  for (const c of dated.filter((c) => c.dueDate! >= today)) {
    const w = weekStart(c.dueDate!);
    weeks.set(w, [...(weeks.get(w) ?? []), c]);
  }

  const weekLabel = (w: string) => {
    if (w === thisWeek) return 'This week';
    if (w === addDays(thisWeek, 7)) return 'Next week';
    return `Week of ${formatShortDate(w, year)}`;
  };

  const Row = ({ c }: { c: Commission }) => (
    <li>
      <Link to={`/commissions/${c.commissionId}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-panel-2">
        <span className="w-16 shrink-0 text-sm font-semibold">{c.dueDate ? formatShortDate(c.dueDate, year) : '—'}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{c.title}</span>
          <span className="block truncate text-xs text-muted">{clients.get(c.clientId ?? '')?.name ?? 'No client'}</span>
        </span>
        <StageBadge stage={stageOf(business, c)} />
      </Link>
    </li>
  );

  return (
    <div className="space-y-8">
      <PageHeader title="Timeline" subtitle="Every deadline on open jobs and requests." />

      {dated.length === 0 && (
        <EmptyState title="No due dates set on open jobs yet">Add a due date to a commission and it will show up here.</EmptyState>
      )}

      {overdue.length > 0 && (
        <section>
          <h2 className="eyebrow mb-2 text-bad">Overdue · {overdue.length}</h2>
          <Card className="border-bad/40">
            <ul className="divide-y divide-line-soft">{overdue.map((c) => <Row key={c.commissionId} c={c} />)}</ul>
          </Card>
        </section>
      )}

      {[...weeks.entries()].map(([w, items]) => (
        <section key={w}>
          <h2 className={cx('eyebrow mb-2', w === thisWeek && 'text-warn')}>{weekLabel(w)}</h2>
          <Card>
            <ul className="divide-y divide-line-soft">{items.map((c) => <Row key={c.commissionId} c={c} />)}</ul>
          </Card>
        </section>
      ))}

      {undated.length > 0 && (
        <section>
          <h2 className="eyebrow mb-2">No due date · {undated.length}</h2>
          <Card>
            <ul className="divide-y divide-line-soft">
              {undated.map((c) => (
                <li key={c.commissionId}>
                  <Link to={`/commissions/${c.commissionId}`} className="flex items-center gap-4 px-4 py-3 hover:bg-panel-2">
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    <StageBadge stage={stageOf(business, c)} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}
