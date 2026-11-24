import { useNavigate } from 'react-router-dom';
import {
  centsToInput,
  ClientInputSchema,
  CommissionInputSchema,
  firstRequestStage,
  parseMoney,
  type Commission,
  type CommissionInput,
} from '@ct/shared';
import { useForm } from '../lib/form';
import { useBusiness, useClients, useCreateClient, useCreateCommission, useUpdateCommission } from '../lib/queries';
import { Button, ErrorNote, MoneyField, SelectField, TextArea, TextField } from './ui';

const NEW_CLIENT = '__new__';

/** Create or edit a commission. Can also create a new client inline. */
export function CommissionForm({
  commission,
  initialStageId,
  onDone,
}: {
  commission?: Commission;
  initialStageId?: string;
  onDone: (c: Commission) => void;
}) {
  const business = useBusiness();
  const clients = useClients();
  const createClient = useCreateClient();
  const create = useCreateCommission();
  const update = useUpdateCommission();
  const navigate = useNavigate();

  const form = useForm({
    title: commission?.title ?? '',
    clientId: commission?.clientId ?? '',
    newClientName: '',
    newClientEmail: '',
    stageId: commission?.stageId ?? initialStageId ?? firstRequestStage(business.stages).id,
    price: centsToInput(commission?.priceCents),
    deposit: centsToInput(commission?.depositCents),
    dueDate: commission?.dueDate ?? '',
    description: commission?.description ?? '',
    tags: (commission?.tags ?? []).join(', '),
    notes: commission?.notes ?? '',
  });
  const v = form.values;
  const busy = createClient.isPending || create.isPending || update.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const moneyErrors: Record<string, string> = {};
    const priceCents = v.price.trim() ? parseMoney(v.price) : undefined;
    const depositCents = v.deposit.trim() ? parseMoney(v.deposit) : undefined;
    if (priceCents === null) moneyErrors.price = 'Enter an amount like 450 or 450.00';
    if (depositCents === null) moneyErrors.deposit = 'Enter an amount like 100 or 100.00';
    if (v.clientId === NEW_CLIENT) {
      const c = ClientInputSchema.safeParse({ name: v.newClientName, email: v.newClientEmail });
      if (!c.success) moneyErrors.newClientName = 'Enter the client’s name (and a valid email, if any)';
    }

    const payload: CommissionInput = {
      title: v.title,
      clientId: v.clientId === NEW_CLIENT ? undefined : v.clientId,
      stageId: v.stageId,
      priceCents: priceCents ?? undefined,
      depositCents: depositCents ?? undefined,
      dueDate: v.dueDate,
      description: v.description,
      tags: v.tags.split(',').map((t) => t.trim()).filter(Boolean),
      notes: v.notes,
    };
    const data = form.validate(CommissionInputSchema, payload, moneyErrors);
    if (!data) return;

    try {
      if (v.clientId === NEW_CLIENT) {
        const client = await createClient.mutateAsync({ name: v.newClientName.trim(), email: v.newClientEmail.trim() });
        data.clientId = client.clientId;
        form.set('clientId', client.clientId);
      }
      if (commission) {
        // '' / null tell the API to clear a field the user emptied.
        const saved = await update.mutateAsync({
          id: commission.commissionId,
          input: { ...data, clientId: data.clientId ?? '', priceCents: data.priceCents ?? null, depositCents: data.depositCents ?? null },
        });
        onDone(saved);
      } else {
        const saved = await create.mutateAsync(data);
        onDone(saved);
        navigate(`/commissions/${saved.commissionId}`);
      }
    } catch (err) {
      form.showServerError(err);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextField label="What’s the job?" placeholder="Live-edge coffee table" autoFocus {...form.field('title')} />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Client" {...form.field('clientId')}>
          <option value="">No client yet</option>
          {(clients.data ?? []).map((c) => (
            <option key={c.clientId} value={c.clientId}>
              {c.name}
            </option>
          ))}
          <option value={NEW_CLIENT}>+ New client…</option>
        </SelectField>
        <SelectField label="Stage" {...form.field('stageId')}>
          {business.stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
      </div>

      {v.clientId === NEW_CLIENT && (
        <div className="grid gap-4 rounded-lg border border-line bg-panel-2 p-3 sm:grid-cols-2">
          <TextField label="Client name" placeholder="Jordan P." {...form.field('newClientName')} />
          <TextField label="Client email (optional)" type="email" placeholder="jordan@example.com" {...form.field('newClientEmail')} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <MoneyField label={`Price (${business.currency})`} {...form.field('price')} error={form.errors.price ?? form.errors.priceCents} />
        <MoneyField label="Deposit" {...form.field('deposit')} error={form.errors.deposit ?? form.errors.depositCents} />
        <TextField label="Due date" type="date" {...form.field('dueDate')} />
      </div>

      <TextArea label="Description" placeholder="Size, materials, finish, anything agreed with the client…" {...form.field('description')} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Tags" placeholder="walnut, furniture" hint="Separate with commas" {...form.field('tags')} />
        <TextField label="Private notes" placeholder="Only you see these" {...form.field('notes')} />
      </div>

      <ErrorNote>{form.formError}</ErrorNote>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="submit" variant="primary" busy={busy}>
          {commission ? 'Save changes' : 'Add commission'}
        </Button>
      </div>
    </form>
  );
}
