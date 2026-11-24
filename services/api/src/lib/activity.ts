import { PutCommand } from '@aws-sdk/lib-dynamodb';
import type { Activity } from '@ct/shared';
import { ddb, tables } from './db';

/** Appends an entry to a commission's activity log. */
export async function logActivity(commissionId: string, type: Activity['type'], message: string) {
  // Random suffix keeps the sort key unique if two events land in the same millisecond.
  const ts = `${new Date().toISOString()}#${Math.random().toString(36).slice(2, 6)}`;
  await ddb.send(new PutCommand({ TableName: tables.activity, Item: { commissionId, ts, type, message } }));
}
