import { describe, expect, it } from 'vitest';
import { DEFAULT_STAGES, type Business, type Commission, type Expense, type Payment } from '@ct/shared';
import { computeDashboard } from './dashboard';

const business: Business = {
  businessId: 'b1',
  currency: 'USD',
  timezone: 'America/New_York',
  stages: DEFAULT_STAGES,
  plan: 'free',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

let n = 0;
const job = (stageId: string, createdAt: string, extra: Partial<Commission> = {}): Commission => ({
  businessId: 'b1',
  commissionId: `c${++n}`,
  title: `Job ${n}`,
  stageId,
  tags: [],
  files: [],
  source: 'manual',
  paidCents: 0,
  stageChangedAt: createdAt,
  createdAt,
  updatedAt: createdAt,
  ...extra,
});
const pay = (date: string, amountCents: number) =>
  ({ businessId: 'b1', paymentId: date, commissionId: 'c1', amountCents, date, method: 'cash', type: 'final', createdAt: date }) as Payment;
const exp = (date: string, amountCents: number) =>
  ({ businessId: 'b1', expenseId: date, amountCents, date, category: 'materials', createdAt: date }) as Expense;

// Monday, Nov 23 2026, 3pm New York time
const now = new Date('2026-11-23T20:00:00Z');

describe('computeDashboard (mirrors the mockup)', () => {
  const commissions = [
    job('new', '2026-11-21T15:00:00Z', { clientId: 'k1' }), // request, waiting 2 days
    job('quoted', '2026-11-05T15:00:00Z', { dueDate: '2026-12-10' }),
    job('in-progress', '2026-11-10T15:00:00Z', { dueDate: '2026-11-20' }), // overdue but still listed
    job('finishing', '2026-11-12T15:00:00Z'),
    job('delivered', '2026-10-01T15:00:00Z', { dueDate: '2026-10-15' }),
    job('declined', '2026-11-15T15:00:00Z'),
  ];
  const d = computeDashboard({
    business,
    commissions,
    clients: [{ businessId: 'b1', clientId: 'k1', name: 'Jordan P.', createdAt: '', updatedAt: '' }],
    payments: [pay('2026-11-02', 50000), pay('2026-11-12', 30000), pay('2026-11-20', 23500), pay('2026-10-08', 45000)],
    expenses: [exp('2026-11-03', 106344), exp('2026-10-20', 29400)],
    now,
  });

  it('counts jobs by stage kind', () => {
    expect(d.today).toBe('2026-11-23');
    expect(d.openJobs).toBe(3);
    expect(d.openJobsNewThisMonth).toBe(3);
    expect(d.requests).toBe(1);
    expect(d.oldestRequestDays).toBe(2);
    expect(d.totalCommissions).toBe(5); // declined excluded
    expect(d.stageCounts.map((s) => s.count)).toEqual([1, 1, 1, 1, 1]);
  });

  it('totals money by month', () => {
    expect(d.revenueThisMonthCents).toBe(103500);
    expect(d.paymentsThisMonth).toBe(3);
    expect(d.revenueLastMonthCents).toBe(45000);
    expect(d.expensesThisMonthCents).toBe(106344);
    expect(d.expensesLastMonthCents).toBe(29400);
    expect(d.expensesAllTimeCents).toBe(135744);
  });

  it('lists latest and upcoming work', () => {
    expect(d.latest[0]).toMatchObject({ title: 'Job 1', clientName: 'Jordan P.' });
    expect(d.latest).toHaveLength(3);
    expect(d.upcoming.map((u) => u.dueDate)).toEqual(['2026-11-20', '2026-12-10']); // delivered job excluded
  });
});
