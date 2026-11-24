import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatMoney, formatShortDate, monthKey, prevMonthKey, todayISO, type Commission, type Expense, type Payment } from '@ct/shared';
import { ExpenseForm, PaymentForm } from '../components/MoneyForms';
import { Button, Card, cx, EmptyState, ErrorNote, Modal, PageHeader, Spinner } from '../components/ui';
import { useBusiness, useCommissions, useDeleteExpense, useDeletePayment, useExpenses, usePayments } from '../lib/queries';
import { openFile } from '../lib/uploads';

const nextMonthKey = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};
const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

export function Money() {
  const business = useBusiness();
  const [params, setParams] = useSearchParams();
  const thisMonth = monthKey(todayISO(business.timezone));
  const month = params.get('month') ?? thisMonth;
  const tab = params.get('tab') === 'expenses' ? 'expenses' : 'payments';
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const payments = usePayments(month);
  const expenses = useExpenses(month);
  const { data: commissions = [] } = useCommissions();
  const byId = new Map(commissions.map((c) => [c.commissionId, c]));
  const [adding, setAdding] = useState<'payment' | 'expense' | null>(null);

  const cur = business.currency;
  const revenue = (payments.data ?? []).reduce((s, p) => s + p.amountCents, 0);
  const spent = (expenses.data ?? []).reduce((s, e) => s + e.amountCents, 0);

  function exportCsv() {
    if (tab === 'payments') {
      downloadCsv(`payments-${month}.csv`, [
        ['Date', 'Commission', 'Type', 'Method', 'Amount', 'Note'],
        ...(payments.data ?? []).map((p) => [p.date, byId.get(p.commissionId)?.title ?? '', p.type, p.method, (p.amountCents / 100).toFixed(2), p.note ?? '']),
      ]);
    } else {
      downloadCsv(`expenses-${month}.csv`, [
        ['Date', 'Category', 'Vendor', 'Commission', 'Amount', 'Note'],
        ...(expenses.data ?? []).map((e) => [e.date, e.category, e.vendor ?? '', e.commissionId ? (byId.get(e.commissionId)?.title ?? '') : '', (e.amountCents / 100).toFixed(2), e.note ?? '']),
      ]);
    }
  }

  return (
    <div>
      <PageHeader
        title="Money"
        subtitle="What came in and what went out."
        actions={
          <>
            <Button variant="primary" onClick={() => setAdding('payment')}>+ Payment</Button>
            <Button onClick={() => setAdding('expense')}>+ Expense</Button>
          </>
        }
      />

      {/* Month picker */}
      <div className="mb-4 flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => set('month', prevMonthKey(month))} aria-label="Previous month">←</Button>
        <p className="display min-w-44 text-center text-2xl">{monthLabel(month)}</p>
        <Button size="sm" variant="ghost" onClick={() => set('month', nextMonthKey(month) === thisMonth ? null : nextMonthKey(month))} disabled={month >= thisMonth} aria-label="Next month">→</Button>
        {month !== thisMonth && <Button size="sm" variant="ghost" onClick={() => set('month', null)}>This month</Button>}
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card className="p-4"><p className="eyebrow">Revenue</p><p className="display mt-1 text-3xl text-good sm:text-4xl">{formatMoney(revenue, cur)}</p></Card>
        <Card className="p-4"><p className="eyebrow">Expenses</p><p className="display mt-1 text-3xl text-bad sm:text-4xl">{formatMoney(spent, cur)}</p></Card>
        <Card className="p-4"><p className="eyebrow">Net</p><p className={cx('display mt-1 text-3xl sm:text-4xl', revenue - spent < 0 && 'text-bad')}>{formatMoney(revenue - spent, cur)}</p></Card>
      </div>

      <div className="mb-3 flex items-center gap-1">
        {(['payments', 'expenses'] as const).map((t) => (
          <button
            key={t}
            onClick={() => set('tab', t === 'payments' ? null : t)}
            className={cx('rounded-full px-4 py-1.5 text-sm font-medium', tab === t ? 'bg-panel-2 text-ink' : 'text-muted hover:text-ink')}
          >
            {cap(t)} ({(t === 'payments' ? payments.data : expenses.data)?.length ?? 0})
          </button>
        ))}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={exportCsv}>Export CSV</Button>
      </div>

      {tab === 'payments' ? (
        <PaymentList q={payments} byId={byId} currency={cur} onAdd={() => setAdding('payment')} />
      ) : (
        <ExpenseList q={expenses} byId={byId} currency={cur} onAdd={() => setAdding('expense')} />
      )}

      <Modal open={adding === 'payment'} onClose={() => setAdding(null)} title="Record payment">
        <PaymentForm onDone={() => setAdding(null)} />
      </Modal>
      <Modal open={adding === 'expense'} onClose={() => setAdding(null)} title="Add expense">
        <ExpenseForm onDone={() => setAdding(null)} />
      </Modal>
    </div>
  );
}

type Q<T> = { isPending: boolean; isError: boolean; error: Error | null; data?: T[] };

function PaymentList({ q, byId, currency, onAdd }: { q: Q<Payment>; byId: Map<string, Commission>; currency: string; onAdd: () => void }) {
  const remove = useDeletePayment();
  if (q.isPending) return <Spinner />;
  if (q.isError) return <ErrorNote>{q.error?.message}</ErrorNote>;
  if (!q.data?.length) return <EmptyState title="No payments this month" action={<Button size="sm" onClick={onAdd}>Record a payment</Button>} />;
  const year = new Date().getFullYear();
  return (
    <Card>
      <ul className="divide-y divide-line-soft">
        {q.data.map((p) => (
          <li key={p.paymentId} className="flex items-center gap-4 px-4 py-3 text-sm">
            <span className="w-14 shrink-0 text-muted">{formatShortDate(p.date, year)}</span>
            <div className="min-w-0 flex-1">
              <Link to={`/commissions/${p.commissionId}`} className="block truncate font-medium hover:text-good">
                {byId.get(p.commissionId)?.title ?? 'Commission'}
              </Link>
              <p className="truncate text-xs text-muted">{cap(p.type)} · {cap(p.method)}{p.note ? ` · ${p.note}` : ''}</p>
            </div>
            <span className="font-semibold text-good">{formatMoney(p.amountCents, currency)}</span>
            <DeleteButton busy={remove.isPending && remove.variables?.paymentId === p.paymentId} onConfirm={() => remove.mutate(p)} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ExpenseList({ q, byId, currency, onAdd }: { q: Q<Expense>; byId: Map<string, Commission>; currency: string; onAdd: () => void }) {
  const remove = useDeleteExpense();
  if (q.isPending) return <Spinner />;
  if (q.isError) return <ErrorNote>{q.error?.message}</ErrorNote>;
  if (!q.data?.length) return <EmptyState title="No expenses this month" action={<Button size="sm" onClick={onAdd}>Add an expense</Button>} />;
  const year = new Date().getFullYear();
  return (
    <Card>
      <ul className="divide-y divide-line-soft">
        {q.data.map((e) => (
          <li key={e.expenseId} className="flex items-center gap-4 px-4 py-3 text-sm">
            <span className="w-14 shrink-0 text-muted">{formatShortDate(e.date, year)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{cap(e.category)}{e.vendor ? ` · ${e.vendor}` : ''}</p>
              <p className="truncate text-xs text-muted">
                {e.commissionId ? (
                  <Link to={`/commissions/${e.commissionId}`} className="hover:text-good">{byId.get(e.commissionId)?.title ?? 'Commission'}</Link>
                ) : (
                  'General'
                )}
                {e.note ? ` · ${e.note}` : ''}
              </p>
            </div>
            {e.receiptKey && <ReceiptLink fileKey={e.receiptKey} />}
            <span className="font-semibold text-bad">{formatMoney(e.amountCents, currency)}</span>
            <DeleteButton busy={remove.isPending && remove.variables?.expenseId === e.expenseId} onConfirm={() => remove.mutate(e)} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ReceiptLink({ fileKey }: { fileKey: string }) {
  return (
    <button onClick={() => openFile(fileKey)} className="shrink-0 text-xs text-accent hover:text-good">
      Receipt
    </button>
  );
}

/** Two-step delete (click, then confirm) without a browser dialog. */
export function DeleteButton({ onConfirm, busy }: { onConfirm: () => void; busy?: boolean }) {
  const [armed, setArmed] = useState(false);
  if (busy) return <span className="w-14 text-right text-xs text-faint">Removing…</span>;
  return armed ? (
    <span className="flex shrink-0 gap-1">
      <button onClick={onConfirm} className="text-xs font-semibold text-bad">Remove</button>
      <button onClick={() => setArmed(false)} className="text-xs text-muted">Keep</button>
    </span>
  ) : (
    <button onClick={() => setArmed(true)} className="w-14 shrink-0 text-right text-xs text-faint hover:text-bad" aria-label="Delete">
      Delete
    </button>
  );
}
