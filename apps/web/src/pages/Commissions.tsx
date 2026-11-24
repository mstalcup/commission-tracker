import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatShortDate, type Commission } from '@ct/shared';
import { balanceOf, isOverdue, Money, StageBadge, stageOf } from '../components/commission-bits';
import { useNewCommission } from '../components/NewCommission';
import { Button, Card, cx, EmptyState, ErrorNote, PageHeader, Spinner } from '../components/ui';
import { useBusiness, useClientMap, useCommissions } from '../lib/queries';

type Sort = 'newest' | 'due' | 'balance' | 'title';

export function Commissions() {
  const business = useBusiness();
  const commissions = useCommissions();
  const clients = useClientMap();
  const newCommission = useNewCommission();
  const [params, setParams] = useSearchParams();

  // Filters live in the URL so they survive refresh and can be linked to.
  const q = params.get('q') ?? '';
  const stage = params.get('stage') ?? 'active';
  const sort = (params.get('sort') as Sort) ?? 'newest';
  const owed = params.get('owed') === '1';
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const rows = useMemo(() => {
    let list = commissions.data ?? [];
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter((c) =>
        [c.title, c.description, clients.get(c.clientId ?? '')?.name, ...(c.tags ?? [])]
          .filter(Boolean)
          .some((s) => s!.toLowerCase().includes(term)),
      );
    }
    if (stage === 'active') list = list.filter((c) => stageOf(business, c)?.kind !== 'archived');
    else if (stage === 'overdue') list = list.filter((c) => isOverdue(business, c));
    else if (stage !== 'all') list = list.filter((c) => c.stageId === stage);
    if (owed) list = list.filter((c) => (balanceOf(c) ?? 0) > 0);

    const by: Record<Sort, (a: Commission, b: Commission) => number> = {
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      due: (a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'),
      balance: (a, b) => (balanceOf(b) ?? -1) - (balanceOf(a) ?? -1),
      title: (a, b) => a.title.localeCompare(b.title),
    };
    return [...list].sort(by[sort]);
  }, [commissions.data, q, stage, sort, owed, business, clients]);

  const totalOwed = rows.reduce((sum, c) => sum + (balanceOf(c) ?? 0), 0);
  const year = new Date().getFullYear();

  return (
    <div>
      <PageHeader
        title="Commissions"
        subtitle={`${commissions.data?.length ?? 0} on the books`}
        actions={
          <Button variant="primary" onClick={() => newCommission()}>
            + New commission
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setParam('q', e.target.value)}
          placeholder="Search jobs, clients, tags…"
          className="min-w-48 flex-1 rounded-full border border-line bg-panel px-4 py-2 text-sm placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <select value={stage} onChange={(e) => setParam('stage', e.target.value === 'active' ? '' : e.target.value)} className="rounded-full border border-line bg-panel px-3 py-2 text-sm">
          <option value="active">All active</option>
          <option value="all">Everything</option>
          <option value="overdue">Overdue</option>
          {business.stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setParam('sort', e.target.value === 'newest' ? '' : e.target.value)} className="rounded-full border border-line bg-panel px-3 py-2 text-sm">
          <option value="newest">Newest first</option>
          <option value="due">Due soonest</option>
          <option value="balance">Most owed</option>
          <option value="title">A–Z</option>
        </select>
        <label className="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-2 text-sm">
          <input type="checkbox" checked={owed} onChange={(e) => setParam('owed', e.target.checked ? '1' : '')} className="accent-[var(--color-accent)]" />
          Balance owed
        </label>
      </div>

      {commissions.isPending ? (
        <Spinner />
      ) : commissions.isError ? (
        <ErrorNote>{commissions.error.message}</ErrorNote>
      ) : rows.length === 0 ? (
        <EmptyState
          title={commissions.data.length ? 'Nothing matches those filters' : 'No commissions yet'}
          action={!commissions.data.length && <Button variant="primary" onClick={() => newCommission()}>Add your first commission</Button>}
        >
          {!commissions.data.length && 'Add a job you’re working on, or a request you’ve just received.'}
        </EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line-soft">
            {rows.map((c) => {
              const client = clients.get(c.clientId ?? '');
              const balance = balanceOf(c);
              const overdue = isOverdue(business, c);
              return (
                <li key={c.commissionId}>
                  <Link to={`/commissions/${c.commissionId}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-panel-2 sm:grid-cols-[minmax(0,2fr)_9rem_6rem_7rem_7rem]">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.title}</p>
                      <p className="truncate text-xs text-muted">{client?.name ?? 'No client'}</p>
                    </div>
                    <div className="justify-self-end sm:justify-self-start">
                      <StageBadge stage={stageOf(business, c)} />
                    </div>
                    <p className={cx('text-xs', overdue ? 'font-semibold text-bad' : 'text-muted')}>
                      {c.dueDate ? `${overdue ? 'Overdue ' : 'Due '}${formatShortDate(c.dueDate, year)}` : 'No due date'}
                    </p>
                    <p className="hidden text-right text-sm sm:block">
                      <Money cents={c.priceCents} currency={business.currency} />
                    </p>
                    <p className="text-right text-sm">
                      {balance != null && balance > 0 ? (
                        <span className="text-warn"><Money cents={balance} currency={business.currency} /> owed</span>
                      ) : balance === 0 ? (
                        <span className="text-good">Paid</span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
          {totalOwed > 0 && (
            <p className="border-t border-line px-4 py-3 text-right text-sm text-muted">
              Total still owed on these jobs: <Money cents={totalOwed} currency={business.currency} className="font-semibold text-warn" />
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
