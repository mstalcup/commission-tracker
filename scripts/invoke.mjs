#!/usr/bin/env node
/**
 * Calls a deployed API Lambda directly with a simulated signed-in user, for
 * testing the backend without going through Google sign-in.
 *
 *   node scripts/invoke.mjs <handler> "<METHOD /api/path/{id}>" [jsonBody] [pathParamsJson] [queryJson]
 *   node scripts/invoke.mjs business "GET /api/me"
 *   node scripts/invoke.mjs clients "POST /api/clients" '{"name":"Jordan P."}'
 *   node scripts/invoke.mjs clients "GET /api/clients/{id}" "" '{"id":"01H..."}'
 *
 * TEST_SUB / TEST_EMAIL env vars choose the fake user (default: test-user-0001).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [handler, routeKey, body, pathParams, query] = process.argv.slice(2);
if (!handler || !routeKey) {
  console.error('usage: node scripts/invoke.mjs <handler> "<METHOD /api/path>" [body] [pathParams] [query]');
  process.exit(1);
}

const aws = (...args) => execFileSync('aws', args, { encoding: 'utf8' }).trim();
const names = JSON.parse(aws('lambda', 'list-functions', '--query', 'Functions[].FunctionName', '--output', 'json'));
const fn = names.find((n) => n.startsWith(`CommissionTracker-${handler}fn`));
if (!fn) throw new Error(`No deployed Lambda for handler "${handler}"`);

const event = {
  version: '2.0',
  routeKey,
  rawPath: routeKey.split(' ')[1],
  headers: {},
  isBase64Encoded: false,
  body: body || undefined,
  pathParameters: pathParams ? JSON.parse(pathParams) : undefined,
  queryStringParameters: query ? JSON.parse(query) : undefined,
  requestContext: {
    http: { method: routeKey.split(' ')[0] },
    authorizer: {
      jwt: {
        claims: { sub: process.env.TEST_SUB ?? 'test-user-0001', email: process.env.TEST_EMAIL ?? 'test@example.com' },
        scopes: null,
      },
    },
  },
};

const dir = mkdtempSync(join(tmpdir(), 'ct-invoke-'));
writeFileSync(join(dir, 'ev.json'), JSON.stringify(event));
aws(
  'lambda', 'invoke',
  '--function-name', fn,
  '--cli-binary-format', 'raw-in-base64-out',
  '--payload', `file://${join(dir, 'ev.json')}`,
  join(dir, 'out.json'),
);
const res = JSON.parse(readFileSync(join(dir, 'out.json'), 'utf8'));
console.log(res.statusCode);
if (res.body) console.log(JSON.stringify(JSON.parse(res.body), null, 2));
else if (!res.statusCode) console.log(res);
