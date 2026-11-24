import { formatMoney, formatShortDate, stageById, todayISO, type Business, type Commission, type Stage } from '@ct/shared';
import { cx } from './ui';

export function StageBadge({ stage, className }: { stage?: Stage; className?: string }) {
  if (!stage) return <span className="text-xs text-faint">Unknown stage</span>;
  return (
    <span
      className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium', className)}
      style={{ borderColor: `${stage.color}55`, color: stage.color, background: `${stage.color}14` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: stage.color }} />
      {stage.name}
    </span>
  );
}

export function stageOf(business: Business, c: Commission) {
  return stageById(business.stages, c.stageId);
}

/** Balance still owed on a job (never negative). Null when no price set. */
export function balanceOf(c: Commission): number | null {
  if (c.priceCents == null) return null;
  return Math.max(0, c.priceCents - (c.paidCents ?? 0));
}

export function isOverdue(business: Business, c: Commission): boolean {
  const kind = stageOf(business, c)?.kind;
  return !!c.dueDate && (kind === 'request' || kind === 'open') && c.dueDate < todayISO(business.timezone);
}

export function DueDate({ business, commission }: { business: Business; commission: Commission }) {
  if (!commission.dueDate) return null;
  const overdue = isOverdue(business, commission);
  return (
    <span className={cx('text-xs', overdue ? 'font-semibold text-bad' : 'text-muted')}>
      {overdue ? 'Overdue · ' : 'Due '}
      {formatShortDate(commission.dueDate, new Date().getFullYear())}
    </span>
  );
}

export function Money({ cents, currency, className }: { cents?: number | null; currency: string; className?: string }) {
  if (cents == null) return <span className={cx('text-faint', className)}>—</span>;
  return <span className={className}>{formatMoney(cents, currency)}</span>;
}
