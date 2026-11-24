import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatShortDate } from '@ct/shared';
import { ClientForm } from '../components/ClientForm';
import { balanceOf, Money, StageBadge, stageOf } from '../components/commission-bits';
import { Button, Card, EmptyState, ErrorNote, Modal, PageHeader, Spinner } from '../components/ui';
import { useBusiness, useClient, useClients, useCommissions, useDeleteClient } from '../lib/queries';

export function Clients() {
  const business = useBusiness();
  const clients = useClients();
  const commissions = useCommissions();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);

  // Per-client totals: number of jobs and money received ("lifetime value").
  const stats = useMemo(() => {
    const m = new Map<string, { jobs: number; paid: number; owed: number }>();
    for (const c of commissions.data ?? []) {
      if (!c.clientId) continue;
      const s = m.get(c.clientId) ?? { jobs: 0, paid: 0, owed: 0 };
      s.jobs += 1;
      s.paid += c.paidCents ?? 0;
      if (stageOf(business, c)?.kind !== 'archived') s.owed += balanceOf(c) ?? 0;
      m.set(c.clientId, s);
    }
    return m;
  }, [commissions.data, business]);

  const rows = (clients.data ?? []).filter((c) =>
    [c.name, c.email, c.phone].filter(Boolean).some((s) => s!.toLowerCase().includes(q.trim().toLowerCase())),
  );

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`${clients.data?.length ?? 0} people you’ve made things for`}
        actions={<Button variant="primary" onClick={() => setAdding(true)}>+ New client</Button>}
      />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name, email or phone…"
        className="mb-4 w-full rounded-full border border-line bg-panel px-4 py-2 text-sm placeholder:text-faint focus:border-accent focus:outline-none"
      />
      {clients.isPending ? (
        <Spinner />
      ) : clients.isError ? (
        <ErrorNote>{clients.error.message}</ErrorNote>
      ) : rows.length === 0 ? (
        <EmptyState title={clients.data.length ? 'No matches' : 'No clients yet'}>
          {!clients.data.length && 'Clients are added when you create a commission, or here.'}
        </EmptyState>
      ) : (
        <Card>
          <ul className="divide-y divide-line-soft">
            {rows.map((c) => {
              const s = stats.get(c.clientId);
              return (
                <li key={c.clientId}>
                  <Link to={`/clients/${c.clientId}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-panel-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted">{c.email || c.phone || 'No contact details'}</p>
                    </div>
                    <span className="text-xs text-muted">{s?.jobs ?? 0} job{s?.jobs === 1 ? '' : 's'}</span>
                    {s && s.owed > 0 && <span className="text-xs text-warn"><Money cents={s.owed} currency={business.currency} /> owed</span>}
                    <span className="w-24 text-right text-sm font-semibold"><Money cents={s?.paid ?? 0} currency={business.currency} /></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <Modal open={adding} onClose={() => setAdding(false)} title="New client">
        <ClientForm onDone={() => setAdding(false)} />
      </Modal>
    </div>
  );
}

export function ClientDetail() {
  const { id = '' } = useParams();
  const business = useBusiness();
  const detail = useClient(id);
  const remove = useDeleteClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  if (detail.isPending) return <Spinner />;
  if (detail.isError) return <ErrorNote>{detail.error.message}</ErrorNote>;

  const { client, commissions } = detail.data;
  const cur = business.currency;
  const paid = commissions.reduce((s, c) => s + (c.paidCents ?? 0), 0);
  const year = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <Link to="/clients" className="text-sm text-muted hover:text-ink">← All clients</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="display text-4xl sm:text-5xl">{client.name}</h1>
          <p className="mt-1 space-x-3 text-sm text-muted">
            {client.email && <a href={`mailto:${client.email}`} className="hover:text-ink">{client.email}</a>}
            {client.phone && <a href={`tel:${client.phone}`} className="hover:text-ink">{client.phone}</a>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setEditing(true)}>Edit</Button>
          <Button
            size="sm"
            variant="ghost"
            busy={remove.isPending}
            onClick={() => remove.mutate(client.clientId, { onSuccess: () => navigate('/clients', { replace: true }) })}
          >
            Delete
          </Button>
        </div>
      </div>
      <ErrorNote>{remove.error?.message}</ErrorNote>

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <Card className="p-4"><p className="eyebrow">Jobs</p><p className="display mt-1 text-3xl">{commissions.length}</p></Card>
        <Card className="p-4"><p className="eyebrow">Lifetime value</p><p className="display mt-1 text-3xl text-good"><Money cents={paid} currency={cur} /></p></Card>
      </div>

      {client.notes && (
        <Card className="p-5">
          <p className="eyebrow mb-1">Notes</p>
          <p className="whitespace-pre-wrap text-sm text-muted">{client.notes}</p>
        </Card>
      )}

      <section>
        <h2 className="display mb-3 text-3xl">Commissions</h2>
        {commissions.length === 0 ? (
          <EmptyState title="No commissions for this client yet" />
        ) : (
          <Card>
            <ul className="divide-y divide-line-soft">
              {commissions.map((c) => (
                <li key={c.commissionId}>
                  <Link to={`/commissions/${c.commissionId}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-panel-2">
                    <span className="min-w-0 flex-1 truncate font-medium">{c.title}</span>
                    <span className="text-xs text-muted">{formatShortDate(c.createdAt.slice(0, 10), year)}</span>
                    <StageBadge stage={stageOf(business, c)} />
                    <Money cents={c.priceCents} currency={cur} className="w-20 text-right text-sm" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit client">
        <ClientForm client={client} onDone={() => setEditing(false)} />
      </Modal>
    </div>
  );
}
