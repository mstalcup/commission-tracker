import { DeleteCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { ClientInputSchema, type Client } from '@ct/shared';
import { buildUpdate, ddb, stripEmpty, tables } from '../lib/db';
import { HttpError, parse, reply, routes } from '../lib/http';
import { getClient, listClients, listCommissions } from '../lib/repo';

export const handler = routes({
  'GET /api/clients': async ({ business }) => {
    const clients = await listClients(business.businessId);
    return clients.sort((a, b) => a.name.localeCompare(b.name));
  },

  'POST /api/clients': async (ctx) => {
    const input = parse(ClientInputSchema, ctx.body());
    const now = new Date().toISOString();
    const client: Client = { ...input, businessId: ctx.business.businessId, clientId: ulid(), createdAt: now, updatedAt: now };
    await ddb.send(new PutCommand({ TableName: tables.clients, Item: stripEmpty(client) }));
    return reply(201, stripEmpty(client));
  },

  'GET /api/clients/{id}': async ({ business, params }) => {
    const client = await getClient(business.businessId, params.id);
    const commissions = (await listCommissions(business.businessId)).filter((c) => c.clientId === client.clientId);
    return { client, commissions };
  },

  'PATCH /api/clients/{id}': async (ctx) => {
    const input = parse(ClientInputSchema.partial(), ctx.body());
    try {
      const res = await ddb.send(
        new UpdateCommand({
          TableName: tables.clients,
          Key: { businessId: ctx.business.businessId, clientId: ctx.params.id },
          ConditionExpression: 'attribute_exists(clientId)',
          ...buildUpdate({ ...input, updatedAt: new Date().toISOString() }),
          ReturnValues: 'ALL_NEW',
        }),
      );
      return res.Attributes as Client;
    } catch (err) {
      if ((err as Error).name === 'ConditionalCheckFailedException') throw new HttpError(404, 'Client not found');
      throw err;
    }
  },

  'DELETE /api/clients/{id}': async ({ business, params }) => {
    const used = (await listCommissions(business.businessId)).filter((c) => c.clientId === params.id);
    if (used.length) {
      throw new HttpError(409, `This client has ${used.length} commission(s). Reassign or delete them first.`);
    }
    await ddb.send(new DeleteCommand({ TableName: tables.clients, Key: { businessId: business.businessId, clientId: params.id } }));
  },
});

