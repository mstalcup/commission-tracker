import { BusinessUpdateSchema, type Business } from '@ct/shared';
import { useForm } from '../lib/form';
import { useUpdateBusiness } from '../lib/queries';
import { Button, ErrorNote, SelectField, TextField } from './ui';

const CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'NZD', 'JPY', 'MXN', 'CHF', 'SEK', 'NOK', 'DKK'];

function timezones(current: string): string[] {
  const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  return all.includes(current) ? all : [current, ...all];
}

/** Business profile. `compact` shows just name + website (first-run welcome). */
export function ProfileForm({ business, compact, onSaved }: { business: Business; compact?: boolean; onSaved?: () => void }) {
  const update = useUpdateBusiness();
  const form = useForm({
    name: business.name ?? '',
    tagline: business.tagline ?? '',
    website: business.website ?? '',
    currency: business.currency,
    timezone: business.timezone,
    instagram: business.socialLinks?.instagram ?? '',
    etsy: business.socialLinks?.etsy ?? '',
    other: business.socialLinks?.other ?? '',
  });
  const v = form.values;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = compact
      ? { name: v.name.trim(), website: v.website.trim() }
      : {
          name: v.name.trim(),
          tagline: v.tagline.trim(),
          website: v.website.trim(),
          currency: v.currency,
          timezone: v.timezone,
          socialLinks: { instagram: v.instagram.trim(), etsy: v.etsy.trim(), other: v.other.trim() },
        };
    const data = form.validate(BusinessUpdateSchema, payload);
    if (!data) return;
    try {
      await update.mutateAsync(data);
      onSaved?.();
    } catch (err) {
      form.showServerError(err);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Business name" placeholder="Late Night Woodworking" {...form.field('name')} />
        <TextField label="Website" placeholder="https://yourshop.com" type="url" {...form.field('website')} />
      </div>
      {!compact && (
        <>
          <TextField
            label="Tagline"
            placeholder="Commission book: every job, what it's worth, and what's still owed."
            hint="Shown under your business name."
            {...form.field('tagline')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Currency" {...form.field('currency')}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </SelectField>
            <SelectField label="Timezone" hint="Used for “this month” and “today”." {...form.field('timezone')}>
              {timezones(v.timezone).map((tz) => (
                <option key={tz}>{tz}</option>
              ))}
            </SelectField>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Instagram" placeholder="https://instagram.com/…" {...form.field('instagram')} error={form.errors['socialLinks'] ?? form.errors['instagram']} />
            <TextField label="Etsy" placeholder="https://etsy.com/shop/…" {...form.field('etsy')} />
            <TextField label="Other link" placeholder="https://…" {...form.field('other')} />
          </div>
        </>
      )}
      <ErrorNote>{form.formError}</ErrorNote>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" busy={update.isPending}>
          Save
        </Button>
        {update.isSuccess && !compact && <span className="text-sm text-good">Saved</span>}
      </div>
    </form>
  );
}
