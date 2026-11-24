import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { DEFAULT_STAGES, type Business, type User } from '@ct/shared';
import { ddb, tables } from './db';

type Claims = Record<string, string | number | boolean | string[]>;

/**
 * Looks up the signed-in user and their business. On a user's very first
 * request we create both: a new Business and a User row with role "owner".
 * All data is keyed by businessId so more users can join a business later.
 */
export async function loadMembership(claims: Claims): Promise<{ user: User; business: Business }> {
  const userId = String(claims.sub);
  let user = await getUser(userId);
  if (!user) user = await createOwner(userId, claims);

  const res = await ddb.send(new GetCommand({ TableName: tables.businesses, Key: { businessId: user.businessId } }));
  if (!res.Item) throw new Error(`Business ${user.businessId} missing for user ${userId}`);
  return { user, business: res.Item as Business };
}

async function getUser(userId: string): Promise<User | undefined> {
  const res = await ddb.send(new GetCommand({ TableName: tables.users, Key: { userId }, ConsistentRead: true }));
  return res.Item as User | undefined;
}

async function createOwner(userId: string, claims: Claims): Promise<User> {
  const now = new Date().toISOString();
  const business: Business = {
    businessId: ulid(),
    currency: 'USD',
    timezone: 'America/New_York',
    stages: DEFAULT_STAGES,
    plan: 'free',
    createdAt: now,
    updatedAt: now,
  };
  const user: User = {
    userId,
    email: String(claims.email ?? ''),
    name: claims.name ? String(claims.name) : undefined,
    businessId: business.businessId,
    role: 'owner',
    createdAt: now,
  };
  try {
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: tables.businesses, Item: business } },
          { Put: { TableName: tables.users, Item: user, ConditionExpression: 'attribute_not_exists(userId)' } },
        ],
      }),
    );
    return user;
  } catch (err) {
    // Two first requests raced and the other one won: use its records.
    if ((err as Error).name === 'TransactionCanceledException') {
      const existing = await getUser(userId);
      if (existing) return existing;
    }
    throw err;
  }
}
