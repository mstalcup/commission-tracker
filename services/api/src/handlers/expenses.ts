import { DeleteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { ExpenseInputSchema, formatMoney, type Expense } from '@ct/shared';
import { logActivity } from '../lib/activity';
import { ddb, stripEmpty, tables } from '../lib/db';
import { parse, reply, routes } from '../lib/http';
import { findLedgerItem, listLedger } from '../lib/ledger';
import { getCommission } from '../lib/repo';
import { assertOwnKey, deleteObject } from '../lib/s3';

export const handler = routes({
  'GET /api/expenses': async ({ business, query }) => listLedger<Expense>('expenses', business.businessId, query.month),

  'POST /api/expenses': async (ctx) => {
    const input = parse(ExpenseInputSchema, ctx.body());
    const { businessId, currency } = ctx.business;
    if (input.commissionId) await getCommission(businessId, input.commissionId);
    if (input.receiptKey) assertOwnKey(businessId, input.receiptKey);

    const expense: Expense = stripEmpty({ ...input, businessId, expenseId: ulid(), createdAt: new Date().toISOString() });
    await ddb.send(new PutCommand({ TableName: tables.expenses, Item: { ...expense, sk: `${expense.date}#${expense.expenseId}` } }));
    if (expense.commissionId) {
      await logActivity(expense.commissionId, 'expense', `Expense: ${formatMoney(expense.amountCents, currency)} ${expense.category}${expense.vendor ? ` at ${expense.vendor}` : ''}`);
    }
    return reply(201, expense);
  },

  'DELETE /api/expenses/{id}': async ({ business, params }) => {
    const { businessId } = business;
    const expense = await findLedgerItem<Expense>('expenses', businessId, 'expenseId', params.id);
    await ddb.send(new DeleteCommand({ TableName: tables.expenses, Key: { businessId, sk: expense.sk } }));
    await deleteObject(businessId, expense.receiptKey).catch((err) => console.warn('Receipt delete failed', err));
  },
});
