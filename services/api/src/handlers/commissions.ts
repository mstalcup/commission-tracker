import { BatchWriteCommand, DeleteCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import {
  CommissionInputSchema,
  CommissionPatchSchema,
  firstRequestStage,
  stageById,
  type Activity,
  type Business,
  type Commission,
  type Expense,
  type Payment,
} from '@ct/shared';
import { logActivity } from '../lib/activity';
import { buildUpdate, ddb, queryAll, stripEmpty, tables } from '../lib/db';
import { HttpError, parse, reply, routes } from '../lib/http';
import { getClient, getCommission, listCommissions, listForCommission } from '../lib/repo';

function checkStage(business: Business, stageId: string) {
  if (!stageById(business.stages, stageId)) throw new HttpError(400, 'Unknown stage', { stageId: ['Pick a valid stage'] });
}

async function checkClient(businessId: string, clientId?: string) {
  if (!clientId) return;
  try {
    await getClient(businessId, clientId);
  } catch {
    throw new HttpError(400, 'Unknown client', { clientId: ['Pick a valid client'] });
  }
}

export const handler = routes({
  'GET /api/commissions': async ({ business }) => {
    const items = await listCommissions(business.businessId);
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  'POST /api/commissions': async (ctx) => {
    const input = parse(CommissionInputSchema, ctx.body());
    const { businessId } = ctx.business;
    const stageId = input.stageId || firstRequestStage(ctx.business.stages).id;
    checkStage(ctx.business, stageId);
    await checkClient(businessId, input.clientId);

    const now = new Date().toISOString();
    const commission: Commission = stripEmpty({
      ...input,
      businessId,
      commissionId: ulid(),
      stageId,
      tags: input.tags ?? [],
      files: input.files ?? [],
      source: 'manual' as const,
      paidCents: 0,
      stageSort: `${stageId}#${now}`,
      stageChangedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await ddb.send(new PutCommand({ TableName: tables.commissions, Item: commission }));
    await logActivity(commission.commissionId, 'created', 'Commission created');
    return reply(201, commission);
  },

  'GET /api/commissions/{id}': async ({ business, params }) => {
    const commission = await getCommission(business.businessId, params.id);
    const [payments, expenses, activity] = await Promise.all([
      listForCommission<Payment>('payments', business.businessId, commission.commissionId),
      listForCommission<Expense>('expenses', business.businessId, commission.commissionId),
      ddb
        .send(
          new QueryCommand({
            TableName: tables.activity,
            KeyConditionExpression: 'commissionId = :c',
            ExpressionAttributeValues: { ':c': commission.commissionId },
            ScanIndexForward: false,
            Limit: 50,
          }),
        )
        .then((r) => (r.Items ?? []) as Activity[]),
    ]);
    return { commission, payments, expenses, activity };
  },

  'PATCH /api/commissions/{id}': async (ctx) => {
    const input = parse(CommissionPatchSchema, ctx.body());
    const { businessId } = ctx.business;
    const existing = await getCommission(businessId, ctx.params.id);
    if (input.title === '') throw new HttpError(400, 'Title is required', { title: ['Title is required'] });
    if (input.stageId === '') delete input.stageId;
    if (input.stageId) checkStage(ctx.business, input.stageId);
    if (input.clientId) await checkClient(businessId, input.clientId);

    const now = new Date().toISOString();
    const stageChanged = input.stageId && input.stageId !== existing.stageId;
    const res = await ddb.send(
      new UpdateCommand({
        TableName: tables.commissions,
        Key: { businessId, commissionId: existing.commissionId },
        ConditionExpression: 'attribute_exists(commissionId)',
        ...buildUpdate({
          ...input,
          updatedAt: now,
          ...(stageChanged ? { stageChangedAt: now, stageSort: `${input.stageId}#${now}` } : {}),
        }),
        ReturnValues: 'ALL_NEW',
      }),
    );

    if (stageChanged) {
      const to = stageById(ctx.business.stages, input.stageId!)?.name ?? input.stageId;
      await logActivity(existing.commissionId, 'stage', `Moved to ${to}`);
    } else {
      const changed = Object.keys(input).filter((k) => k !== 'stageId');
      if (changed.length) await logActivity(existing.commissionId, 'updated', `Updated ${changed.join(', ')}`);
    }
    return res.Attributes as Commission;
  },

  /**
   * Deleting a job also deletes its payments and activity. Expenses are kept
   * (they were real costs) but unlinked from the job.
   */
  'DELETE /api/commissions/{id}': async ({ business, params }) => {
    const { businessId } = business;
    const commission = await getCommission(businessId, params.id);
    const { commissionId } = commission;
    const [payments, expenses, activity] = await Promise.all([
      listForCommission<Payment>('payments', businessId, commissionId),
      listForCommission<Expense>('expenses', businessId, commissionId),
      queryAll<Activity>({
        TableName: tables.activity,
        KeyConditionExpression: 'commissionId = :c',
        ExpressionAttributeValues: { ':c': commissionId },
        ProjectionExpression: 'commissionId, ts',
      }),
    ]);

    await batchDelete(tables.payments, payments.map((p) => ({ businessId, sk: (p as Payment & { sk: string }).sk })));
    await batchDelete(tables.activity, activity.map((a) => ({ commissionId, ts: a.ts })));
    for (const e of expenses) {
      await ddb.send(
        new UpdateCommand({
          TableName: tables.expenses,
          Key: { businessId, sk: (e as Expense & { sk: string }).sk },
          UpdateExpression: 'REMOVE commissionId',
        }),
      );
    }
    await ddb.send(new DeleteCommand({ TableName: tables.commissions, Key: { businessId, commissionId } }));
  },
});

async function batchDelete(table: string, keys: Record<string, string>[]) {
  for (let i = 0; i < keys.length; i += 25) {
    const chunk = keys.slice(i, i + 25);
    let pending: Record<string, unknown> | undefined = {
      [table]: chunk.map((Key) => ({ DeleteRequest: { Key } })),
    };
    while (pending && Object.keys(pending).length) {
      const res: { UnprocessedItems?: Record<string, unknown> } = await ddb.send(
        new BatchWriteCommand({ RequestItems: pending as never }),
      );
      pending = res.UnprocessedItems;
    }
  }
}
