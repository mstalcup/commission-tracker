import {
  daysBetween,
  monthKey,
  prevMonthKey,
  stageById,
  todayISO,
  type Business,
  type Client,
  type Commission,
  type DashboardSummary,
  type Expense,
  type Payment,
} from '@ct/shared';

/** Local (business timezone) date of an ISO timestamp. */
const localDate = (iso: string, tz: string) => todayISO(tz, new Date(iso));

/**
 * All dashboard numbers, computed from raw records. Kept pure (no database
 * calls) so it is easy to test.
 *
 * @param payments payments dated in last month or this month
 * @param expenses all expenses (for the all-time total)
 */
export function computeDashboard(input: {
  business: Business;
  commissions: Commission[];
  clients: Client[];
  payments: Payment[];
  expenses: Expense[];
  now?: Date;
}): DashboardSummary {
  const { business, commissions, clients, payments, expenses } = input;
  const tz = business.timezone;
  const today = todayISO(tz, input.now);
  const thisMonth = monthKey(today);
  const lastMonth = prevMonthKey(thisMonth);
  const kindOf = (c: Commission) => stageById(business.stages, c.stageId)?.kind ?? 'request';

  const open = commissions.filter((c) => kindOf(c) === 'open');
  const requests = commissions.filter((c) => kindOf(c) === 'request');
  const active = commissions.filter((c) => kindOf(c) !== 'archived');

  const oldestRequest = requests.reduce<string | null>(
    (oldest, c) => (!oldest || c.createdAt < oldest ? c.createdAt : oldest),
    null,
  );

  const sum = <T extends { amountCents: number }>(xs: T[]) => xs.reduce((s, x) => s + x.amountCents, 0);
  const inMonth = <T extends { date: string }>(xs: T[], m: string) => xs.filter((x) => monthKey(x.date) === m);
  const paymentsThisMonth = inMonth(payments, thisMonth);

  const clientName = new Map(clients.map((c) => [c.clientId, c.name]));

  return {
    today,
    openJobs: open.length,
    openJobsNewThisMonth: open.filter((c) => monthKey(localDate(c.createdAt, tz)) === thisMonth).length,
    requests: requests.length,
    oldestRequestDays: oldestRequest ? daysBetween(localDate(oldestRequest, tz), today) : null,
    expensesThisMonthCents: sum(inMonth(expenses, thisMonth)),
    expensesLastMonthCents: sum(inMonth(expenses, lastMonth)),
    expensesAllTimeCents: sum(expenses),
    revenueThisMonthCents: sum(paymentsThisMonth),
    revenueLastMonthCents: sum(inMonth(payments, lastMonth)),
    paymentsThisMonth: paymentsThisMonth.length,
    stageCounts: business.stages
      .filter((s) => s.kind !== 'archived')
      .map((s) => ({ stageId: s.id, count: commissions.filter((c) => c.stageId === s.id).length })),
    totalCommissions: active.length,
    latest: [...active]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3)
      .map((c) => ({ commissionId: c.commissionId, title: c.title, clientName: c.clientId ? clientName.get(c.clientId) : undefined })),
    upcoming: commissions
      .filter((c) => c.dueDate && (kindOf(c) === 'open' || kindOf(c) === 'request'))
      .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
      .slice(0, 5)
      .map((c) => ({ commissionId: c.commissionId, title: c.title, dueDate: c.dueDate!, stageId: c.stageId })),
  };
}
