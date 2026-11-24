import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { BusinessUpdateSchema, type Business } from '@ct/shared';
import { buildUpdate, ddb, tables } from '../lib/db';
import { parse, requireOwner, routes } from '../lib/http';

export const handler = routes({
  'GET /api/me': async ({ user, business }) => ({ user, business }),

  'PATCH /api/business': async (ctx) => {
    requireOwner(ctx);
    const input = parse(BusinessUpdateSchema, ctx.body());
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
