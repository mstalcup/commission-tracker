import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatLongDate, formatShortDate } from '@ct/shared';
import { balanceOf, DueDate, Money, stageOf } from '../components/commission-bits';
import { CommissionForm } from '../components/CommissionForm';
import { Button, Card, ErrorNote, Modal, Spinner } from '../components/ui';
import { useBusiness, useClientMap, useCommission, useDeleteCommission, useUpdateCommission } from '../lib/queries';

export function CommissionDetail() {
  const { id = '' } = useParams();
  const business = useBusiness();
  const detail = useCommission(id);
  const clients = useClientMap();
  const update = useUpdateCommission();
  const remove = useDeleteCommission();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (detail.isPending) return <Spinner />;
  if (detail.isError) {
    return (
      <div className="space-y-4">
        <ErrorNote>{detail.error.message}</ErrorNote>
        <Link to="/commissions" className="text-sm text-accent">← All commissions</Link>
      </div>
    );
  }

  const { commission: c, activity, payments } = detail.data;
  const client = clients.get(c.clientId ?? '');
  const stage = stageOf(business, c);
  const balance = balanceOf(c);
  const cur = business.currency;
  const year = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <Link to="/commissions" className="text-sm text-muted hover:text-ink">← All commissions</Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="display text-4xl sm:text-5xl">{c.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {client ? (
              <Link to={`/clients/${client.clientId}`} className="hover:text-ink">{client.name}</Link>
            ) : (
              'No client'
            )}
            {' · '}Added {formatShortDate(c.createdAt.slice(0, 10), year)}
            {c.source !== 'manual' && ` · from ${c.source}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="stage">Stage</label>
          <select
            id="stage"
            value={c.stageId}
            onChange={(e) => update.mutate({ id: c.commissionId, input: { stageId: e.target.value } })}
            className="rounded-full border px-3 py-2 text-sm font-medium"
            style={{ borderColor: stage?.color, color: stage?.color, background: `${stage?.color ?? '#888'}14` }}
          >
            {business.stages.map((s) => (
              <option key={s.id} value={s.id} style={{ color: '#eee', background: '#151a18' }}>
                {s.name}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => setEditing(true)}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Button>
        </div>
      </div>
      {update.isError && <ErrorNote>{update.error.message}</ErrorNote>}

      {/* Money summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Price"><Money cents={c.priceCents} currency={cur} /></Stat>
        <Stat label="Deposit"><Money cents={c.depositCents} currency={cur} /></Stat>
        <Stat label="Paid so far"><Money cents={c.paidCents ?? 0} currency={cur} className="text-good" /></Stat>
        <Stat label="Still owed">
          {balance == null ? <span className="text-faint">Set a price</span> : balance > 0 ? <Money cents={balance} currency={cur} className="text-warn" /> : <span className="text-good">Paid in full</span>}
        </Stat>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="eyebrow">Details</h2>
              <DueDate business={business} commission={c} />
              {c.dueDate && <span className="text-xs text-faint">({formatLongDate(c.dueDate)})</span>}
            </div>
            {c.description ? <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.description}</p> : <p className="text-sm text-faint">No description yet.</p>}
            {c.tags?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {c.tags.map((t) => (
                  <span key={t} className="rounded-full bg-panel-2 px-2.5 py-0.5 text-xs text-muted">{t}</span>
                ))}
              </div>
            )}
            {c.notes && (
              <div className="mt-4 rounded-lg border border-line-soft bg-bg p-3">
                <p className="eyebrow mb-1">Private notes</p>
                <p className="whitespace-pre-wrap text-sm text-muted">{c.notes}</p>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="eyebrow mb-3">Payments</h2>
            {payments.length === 0 ? (
              <p className="text-sm text-faint">No payments recorded yet.</p>
            ) : (
              <ul className="divide-y divide-line-soft text-sm">
                {payments.map((p) => (
                  <li key={p.paymentId} className="flex justify-between py-2">
                    <span>{formatShortDate(p.date, year)} · {p.type}</span>
                    <Money cents={p.amountCents} currency={cur} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="h-fit p-5">
          <h2 className="eyebrow mb-3">Activity</h2>
          <ol className="space-y-3 border-l border-line pl-4">
            {activity.map((a) => (
              <li key={a.ts} className="relative text-sm">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-line" />
                <p>{a.message}</p>
                <p className="text-xs text-faint">{new Date(a.ts.split('#')[0]).toLocaleString()}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit commission" wide>
        <CommissionForm commission={c} onDone={() => setEditing(false)} />
      </Modal>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete commission?">
        <p className="text-sm text-muted">
          This permanently deletes <strong className="text-ink">{c.title}</strong>
          {payments.length > 0 && ` and its ${payments.length} payment(s)`}. Linked expenses are kept but unlinked.
        </p>
        <ErrorNote>{remove.error?.message}</ErrorNote>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button
            variant="danger"
            busy={remove.isPending}
            onClick={() => remove.mutate(c.commissionId, { onSuccess: () => navigate('/commissions', { replace: true }) })}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card className="p-4">
      <p className="eyebrow">{label}</p>
      <p className="display mt-1 text-3xl">{children}</p>
    </Card>
  );
}
