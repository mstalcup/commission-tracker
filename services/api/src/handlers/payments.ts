import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { formatMoney, PaymentInputSchema, type Payment } from '@ct/shared';
import { logActivity } from '../lib/activity';
import { stripEmpty, tables, ddb } from '../lib/db';
import { HttpError, parse, reply, routes } from '../lib/http';
import { findLedgerItem, listLedger } from '../lib/ledger';
import { getCommission } from '../lib/repo';

/*
 * Each payment also bumps the commission's running "paidCents" total in the
 * same transaction, so balances are always consistent.
 */

export const handler = routes({
  'GET /api/payments': async ({ business, query }) => listLedger<Payment>('payments', business.businessId, query.month),

  'POST /api/payments': async (ctx) => {
    const input = parse(PaymentInputSchema, ctx.body());
    const { businessId, currency } = ctx.business;
    const commission = await getCommission(businessId, input.commissionId);

    const payment: Payment = stripEmpty({ ...input, businessId, paymentId: ulid(), createdAt: new Date().toISOString() });
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: tables.payments, Item: { ...payment, sk: `${payment.date}#${payment.paymentId}` } } },
          {
            Update: {
              TableName: tables.commissions,
              Key: { businessId, commissionId: commission.commissionId },
              ConditionExpression: 'attribute_exists(commissionId)',
              UpdateExpression: 'ADD paidCents :amt',
              ExpressionAttributeValues: { ':amt': payment.amountCents },
            },
          },
        ],
      }),
    );
    await logActivity(commission.commissionId, 'payment', `${cap(payment.type)} payment of ${formatMoney(payment.amountCents, currency)} received (${payment.method})`);
    return reply(201, payment);
  },

  'DELETE /api/payments/{id}': async ({ business, params }) => {
    const { businessId, currency } = business;
    const payment = await findLedgerItem<Payment>('payments', businessId, 'paymentId', params.id);
    try {
      await ddb.send(
        new TransactWriteCommand({
          TransactItems: [
            { Delete: { TableName: tables.payments, Key: { businessId, sk: payment.sk } } },
            {
              Update: {
                TableName: tables.commissions,
                Key: { businessId, commissionId: payment.commissionId },
                ConditionExpression: 'attribute_exists(commissionId)',
                UpdateExpression: 'ADD paidCents :amt',
                ExpressionAttributeValues: { ':amt': -payment.amountCents },
              },
            },
          ],
        }),
      );
    } catch (err) {
      if ((err as Error).name === 'TransactionCanceledException') throw new HttpError(409, 'Could not remove that payment; try again.');
      throw err;
    }
    await logActivity(payment.commissionId, 'payment', `Payment of ${formatMoney(payment.amountCents, currency)} removed`);
  },
});

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
