import { useState } from 'react';
import {
  centsToInput,
  EXPENSE_CATEGORIES,
  ExpenseInputSchema,
  parseMoney,
  PAYMENT_METHODS,
  PAYMENT_TYPES,
  PaymentInputSchema,
  stageById,
  todayISO,
} from '@ct/shared';
import { useForm } from '../lib/form';
import { useBusiness, useCommissions, useCreateExpense, useCreatePayment } from '../lib/queries';
import { ACCEPT, uploadFile } from '../lib/uploads';
import { Button, ErrorNote, MoneyField, SelectField, TextField } from './ui';

const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Pick a job: active ones first, archived ones last. */
function CommissionOptions() {
  const business = useBusiness();
  const { data = [] } = useCommissions();
  const archived = (id: string) => stageById(business.stages, id)?.kind === 'archived';
  const sorted = [...data].sort((a, b) => Number(archived(a.stageId)) - Number(archived(b.stageId)) || a.title.localeCompare(b.title));
  return (
    <>
      {sorted.map((c) => (
        <option key={c.commissionId} value={c.commissionId}>
          {c.title}
        </option>
      ))}
    </>
  );
}

export function PaymentForm({
  commissionId,
  suggestedCents,
  onDone,
}: {
  commissionId?: string;
  suggestedCents?: number;
  onDone: () => void;
}) {
  const business = useBusiness();
  const create = useCreatePayment();
  const form = useForm({
    commissionId: commissionId ?? '',
    amount: suggestedCents ? centsToInput(suggestedCents) : '',
    date: todayISO(business.timezone),
    method: 'cash',
    type: 'final',
    note: '',
  });
  const v = form.values;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = parseMoney(v.amount);
    const data = form.validate(
      PaymentInputSchema,
      { ...v, amountCents: amountCents ?? undefined, amount: undefined },
      amountCents === null ? { amount: 'Enter an amount like 250 or 250.00' } : {},
    );
    if (!data) return;
    try {
      await create.mutateAsync(data);
      onDone();
    } catch (err) {
      form.showServerError(err);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {!commissionId && (
        <SelectField label="For which job?" {...form.field('commissionId')}>
          <option value="">Choose a commission…</option>
          <CommissionOptions />
        </SelectField>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField label={`Amount (${business.currency})`} autoFocus {...form.field('amount')} error={form.errors.amount ?? form.errors.amountCents} />
        <TextField label="Date received" type="date" {...form.field('date')} />
        <SelectField label="Type" {...form.field('type')}>
          {PAYMENT_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
        </SelectField>
        <SelectField label="Method" {...form.field('method')}>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{label(m)}</option>)}
        </SelectField>
      </div>
      <TextField label="Note (optional)" {...form.field('note')} />
      <ErrorNote>{form.formError}</ErrorNote>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" busy={create.isPending}>Record payment</Button>
      </div>
    </form>
  );
}

export function ExpenseForm({ commissionId, onDone }: { commissionId?: string; onDone: () => void }) {
  const business = useBusiness();
  const create = useCreateExpense();
  const [receipt, setReceipt] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const form = useForm({
    amount: '',
    date: todayISO(business.timezone),
    category: 'materials',
    vendor: '',
    note: '',
    commissionId: commissionId ?? '',
  });
  const v = form.values;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = parseMoney(v.amount);
    const data = form.validate(
      ExpenseInputSchema,
      { ...v, amountCents: amountCents ?? undefined, amount: undefined },
      amountCents === null ? { amount: 'Enter an amount like 42 or 42.50' } : {},
    );
    if (!data) return;
    try {
      if (receipt) {
        setUploading(true);
        data.receiptKey = (await uploadFile(receipt, 'receipt')).key;
      }
      await create.mutateAsync(data);
      onDone();
    } catch (err) {
      form.showServerError(err);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField label={`Amount (${business.currency})`} autoFocus {...form.field('amount')} error={form.errors.amount ?? form.errors.amountCents} />
        <TextField label="Date" type="date" {...form.field('date')} />
        <SelectField label="Category" {...form.field('category')}>
          {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}
        </SelectField>
        <TextField label="Vendor (optional)" placeholder="Hardwood supplier" {...form.field('vendor')} />
      </div>
      {!commissionId && (
        <SelectField label="For a specific job? (optional)" {...form.field('commissionId')}>
          <option value="">General shop expense</option>
          <CommissionOptions />
        </SelectField>
      )}
      <TextField label="Note (optional)" {...form.field('note')} />
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Receipt (optional)</p>
        <input
          type="file"
          accept={ACCEPT}
          onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border file:border-line file:bg-panel-2 file:px-4 file:py-1.5 file:text-ink"
        />
      </div>
      <ErrorNote>{form.formError}</ErrorNote>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" busy={create.isPending || uploading}>
          {uploading ? 'Uploading receipt…' : 'Add expense'}
        </Button>
      </div>
    </form>
  );
}
