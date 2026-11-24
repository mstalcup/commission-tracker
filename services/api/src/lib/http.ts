import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z, type ZodType } from 'zod';
import type { Business, User } from '@ct/shared';
import { loadMembership } from './membership';

export type Event = APIGatewayProxyEventV2WithJWTAuthorizer;

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Not found') => new HttpError(404, what);

/** Lets a handler choose a status code other than 200. */
export class Reply {
  constructor(
    public status: number,
    public body?: unknown,
  ) {}
}
export const reply = (status: number, body?: unknown) => new Reply(status, body);

export interface Ctx {
  event: Event;
  user: User;
  business: Business;
  params: Record<string, string>;
  query: Record<string, string>;
  body(): unknown;
}

export type RouteHandler = (ctx: Ctx) => Promise<unknown>;

/** Validates input with a shared zod schema; throws a 400 with field errors on failure. */
export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, 'Please fix the highlighted fields.', z.flattenError(r.error).fieldErrors);
  return r.data;
}

export function requireOwner(ctx: Ctx) {
  if (ctx.user.role !== 'owner') throw new HttpError(403, 'Only the business owner can do that.');
}

function json(status: number, body?: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: body === undefined ? '' : JSON.stringify(body),
  };
}

/**
 * API Gateway already did the routing (and checked the login token). Each Lambda
 * just maps the matched route key, e.g. "GET /api/clients/{id}", to a function.
 */
export function routes(map: Record<string, RouteHandler>) {
  return async (event: Event): Promise<APIGatewayProxyResultV2> => {
    try {
      const handler = map[event.routeKey];
      if (!handler) throw notFound(`No handler for ${event.routeKey}`);
      const claims = event.requestContext.authorizer.jwt.claims;
      const { user, business } = await loadMembership(claims);
      const ctx: Ctx = {
        event,
        user,
        business,
        params: (event.pathParameters ?? {}) as Record<string, string>,
        query: (event.queryStringParameters ?? {}) as Record<string, string>,
        body() {
          if (!event.body) return {};
          const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
          try {
            return JSON.parse(raw);
          } catch {
            throw new HttpError(400, 'Request body must be JSON');
          }
        },
      };
      const result = await handler(ctx);
      if (result instanceof Reply) return json(result.status, result.body);
      return json(result === undefined ? 204 : 200, result);
    } catch (err) {
      if (err instanceof HttpError) return json(err.status, { message: err.message, details: err.details });
      console.error('Unhandled error', err);
      return json(500, { message: 'Something went wrong. Please try again.' });
    }
  };
}
