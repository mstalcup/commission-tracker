import { monthKey, prevMonthKey, todayISO, type Expense, type Payment } from '@ct/shared';
import { computeDashboard } from '../lib/dashboard';
import { routes } from '../lib/http';
import { listLedger, listLedgerRange } from '../lib/ledger';
import { listClients, listCommissions } from '../lib/repo';

export const handler = routes({
  'GET /api/dashboard': async ({ business }) => {
    const thisMonth = monthKey(todayISO(business.timezone));
    const lastMonth = prevMonthKey(thisMonth);
    const [commissions, clients, payments, expenses] = await Promise.all([
      listCommissions(business.businessId),
      listClients(business.businessId),
      listLedgerRange<Payment>('payments', business.businessId, `${lastMonth}-01`, `${thisMonth}-31`),
      listLedger<Expense>('expenses', business.businessId),
    ]);
    return computeDashboard({ business, commissions, clients, payments, expenses });
  },
});
