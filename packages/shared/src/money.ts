/** All money is stored as integer cents to avoid floating-point rounding errors. */

/**
 * Formats cents for display. Whole amounts drop the ".00" ($1,035) while
 * amounts with cents keep them ($1,063.44), matching the dashboard design.
 */
export function formatMoney(cents: number, currency = 'USD', opts: { alwaysCents?: boolean } = {}): string {
  const whole = cents % 100 === 0;
  const digits = opts.alwaysCents || !whole ? 2 : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(cents / 100);
}

/** Parses user-typed money ("1,035", "$12.5", "12.50") into cents. Returns null if invalid. */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '');
  if (cleaned === '' || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

/** Cents → plain editable string for form inputs ("1063.44", "1035"). */
export function centsToInput(cents: number | undefined | null): string {
  if (cents == null) return '';
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** Percent change from previous to current. Null when there is no baseline. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
