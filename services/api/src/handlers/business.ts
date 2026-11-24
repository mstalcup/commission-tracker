import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { BusinessUpdateSchema, type Business } from '@ct/shared';
import { buildUpdate, ddb, tables } from '../lib/db';
import { HttpError, parse, requireOwner, routes } from '../lib/http';
import { listCommissions } from '../lib/repo';

export const handler = routes({
  'GET /api/me': async ({ user, business }) => ({ user, business }),

  'PATCH /api/business': async (ctx) => {
    requireOwner(ctx);
    const input = parse(BusinessUpdateSchema, ctx.body());

    // A stage can't be removed while commissions are still in it.
    if (input.stages) {
      const keep = new Set(input.stages.map((s) => s.id));
      const removed = ctx.business.stages.filter((s) => !keep.has(s.id));
      if (removed.length) {
        const commissions = await listCommissions(ctx.business.businessId);
        for (const stage of removed) {
          const n = commissions.filter((c) => c.stageId === stage.id).length;
          if (n) throw new HttpError(409, `“${stage.name}” still has ${n} commission(s). Move them to another stage first.`);
        }
      }
    }

    const res = await ddb.send(
      new UpdateCommand({
        TableName: tables.businesses,
        Key: { businessId: ctx.business.businessId },
        ...buildUpdate({ ...input, updatedAt: new Date().toISOString() }),
        ReturnValues: 'ALL_NEW',
      }),
    );
    return res.Attributes as Business;
  },
});
