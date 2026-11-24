import { GetCommand } from '@aws-sdk/lib-dynamodb';
import type { Client, Commission, Expense, Payment } from '@ct/shared';
import { ddb, queryAll, tables } from './db';
import { notFound } from './http';

/*
 * Small read helpers shared by several handlers. Every lookup is scoped by
 * businessId (the partition key), so one business can never read another's data.
 */

export async function getCommission(businessId: string, commissionId: string): Promise<Commission> {
  const res = await ddb.send(new GetCommand({ TableName: tables.commissions, Key: { businessId, commissionId } }));
  if (!res.Item) throw notFound('Commission not found');
  return res.Item as Commission;
}

export async function getClient(businessId: string, clientId: string): Promise<Client> {
  const res = await ddb.send(new GetCommand({ TableName: tables.clients, Key: { businessId, clientId } }));
  if (!res.Item) throw notFound('Client not found');
  return res.Item as Client;
}

export function listCommissions(businessId: string) {
  return queryAll<Commission>({
    TableName: tables.commissions,
    KeyConditionExpression: 'businessId = :b',
    ExpressionAttributeValues: { ':b': businessId },
  });
}

export function listClients(businessId: string) {
  return queryAll<Client>({
    TableName: tables.clients,
    KeyConditionExpression: 'businessId = :b',
    ExpressionAttributeValues: { ':b': businessId },
  });
}

/** Payments or expenses linked to one commission (via the byCommission index). */
export async function listForCommission<T extends Payment | Expense>(
  table: 'payments' | 'expenses',
  businessId: string,
  commissionId: string,
): Promise<T[]> {
  const items = await queryAll<T>({
    TableName: tables[table],
    IndexName: 'byCommission',
    KeyConditionExpression: 'commissionId = :c',
    ExpressionAttributeValues: { ':c': commissionId },
  });
  // Index is keyed by commissionId only; double-check the owner.
  return items.filter((i) => i.businessId === businessId);
}
