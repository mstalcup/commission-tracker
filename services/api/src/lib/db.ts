import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, type QueryCommandInput } from '@aws-sdk/lib-dynamodb';

export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

/** Table names are injected by CDK as environment variables. */
export const tables = {
  get businesses() { return env('TABLE_BUSINESSES'); },
  get users() { return env('TABLE_USERS'); },
  get clients() { return env('TABLE_CLIENTS'); },
  get commissions() { return env('TABLE_COMMISSIONS'); },
  get payments() { return env('TABLE_PAYMENTS'); },
  get expenses() { return env('TABLE_EXPENSES'); },
  get activity() { return env('TABLE_ACTIVITY'); },
};

/** Runs a query and follows pagination until all items are returned. */
export async function queryAll<T>(input: QueryCommandInput): Promise<T[]> {
  const items: T[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(new QueryCommand({ ...input, ExclusiveStartKey }));
    items.push(...((res.Items ?? []) as T[]));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

/**
 * Builds an UpdateExpression from a partial object.
 * - undefined values are skipped (field not sent)
 * - '' or null removes the attribute (field cleared)
 */
export function buildUpdate(fields: Record<string, unknown>) {
  const sets: string[] = [];
  const removes: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    names[`#${k}`] = k;
    if (v === '' || v === null) removes.push(`#${k}`);
    else {
      sets.push(`#${k} = :${k}`);
      values[`:${k}`] = v;
    }
  }
  const parts: string[] = [];
  if (sets.length) parts.push(`SET ${sets.join(', ')}`);
  if (removes.length) parts.push(`REMOVE ${removes.join(', ')}`);
  return {
    UpdateExpression: parts.join(' '),
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: Object.keys(values).length ? values : undefined,
  };
}

/** Drops empty optional strings / undefined so they aren't stored. */
export function stripEmpty<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined)) as T;
}
