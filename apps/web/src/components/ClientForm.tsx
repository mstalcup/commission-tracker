import { ClientInputSchema, type Client } from '@ct/shared';
import { useForm } from '../lib/form';
import { useCreateClient, useUpdateClient } from '../lib/queries';
import { Button, ErrorNote, TextArea, TextField } from './ui';

export function ClientForm({ client, onDone }: { client?: Client; onDone: (c: Client) => void }) {
  const create = useCreateClient();
  const update = useUpdateClient(client?.clientId ?? '');
  const form = useForm({
    name: client?.name ?? '',
    email: client?.email ?? '',
    phone: client?.phone ?? '',
    notes: client?.notes ?? '',
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const data = form.validate(ClientInputSchema, form.values);
    if (!data) return;
    try {
      // On edit, send '' for emptied fields so they're cleared.
      onDone(client ? await update.mutateAsync({ ...form.values, name: data.name }) : await create.mutateAsync(data));
    } catch (err) {
      form.showServerError(err);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextField label="Name" autoFocus {...form.field('name')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Email" type="email" {...form.field('email')} />
        <TextField label="Phone" type="tel" {...form.field('phone')} />
      </div>
      <TextArea label="Notes" placeholder="How they found you, preferences, address…" {...form.field('notes')} />
      <ErrorNote>{form.formError}</ErrorNote>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" busy={create.isPending || update.isPending}>
          {client ? 'Save' : 'Add client'}
        </Button>
      </div>
    </form>
  );
}
