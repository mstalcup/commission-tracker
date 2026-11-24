import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, queryAll, tables } from './db';
import { HttpError } from './http';

/*
 * Payments and expenses are stored with sort key "<date>#<id>", so a month's
 * items can be read with a single begins_with("2026-11") query.
 */

export type LedgerTable = 'payments' | 'expenses';

export function listLedger<T>(table: LedgerTable, businessId: string, month?: string): Promise<T[]> {
  if (month && !/^\d{4}-\d{2}$/.test(month)) throw new HttpError(400, 'month must look like 2026-11');
  return queryAll<T>({
    TableName: tables[table],
    KeyConditionExpression: month ? 'businessId = :b AND begins_with(sk, :m)' : 'businessId = :b',
    ExpressionAttributeValues: month ? { ':b': businessId, ':m': month } : { ':b': businessId },
    ScanIndexForward: false, // newest first
  });
}

/** Items dated within [fromDate, toDate] inclusive (YYYY-MM-DD). */
export function listLedgerRange<T>(table: LedgerTable, businessId: string, fromDate: string, toDate: string): Promise<T[]> {
  return queryAll<T>({
    TableName: tables[table],
    KeyConditionExpression: 'businessId = :b AND sk BETWEEN :from AND :to',
    ExpressionAttributeValues: { ':b': businessId, ':from': fromDate, ':to': `${toDate}#~` },
  });
}

/** Finds one item by its id (small partitions, so a filtered query is fine). */
export async function findLedgerItem<T>(table: LedgerTable, businessId: string, idField: string, id: string): Promise<T & { sk: string }> {
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: tables[table],
        KeyConditionExpression: 'businessId = :b',
        FilterExpression: '#id = :id',
        ExpressionAttributeNames: { '#id': idField },
        ExpressionAttributeValues: { ':b': businessId, ':id': id },
        ExclusiveStartKey,
      }),
    );
    if (res.Items?.length) return res.Items[0] as T & { sk: string };
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  throw new HttpError(404, 'Not found');
}
