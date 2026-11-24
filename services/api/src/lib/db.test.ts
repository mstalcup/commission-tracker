import { describe, expect, it } from 'vitest';
import { buildUpdate, stripEmpty } from './db';

describe('buildUpdate', () => {
  it('sets values, removes cleared fields, skips absent ones', () => {
    const u = buildUpdate({ title: 'Table', website: '', priceCents: null, notes: undefined, count: 0 });
    expect(u.UpdateExpression).toBe('SET #title = :title, #count = :count REMOVE #website, #priceCents');
    expect(u.ExpressionAttributeValues).toEqual({ ':title': 'Table', ':count': 0 });
    expect(u.ExpressionAttributeNames).toEqual({
      '#title': 'title',
      '#website': 'website',
      '#priceCents': 'priceCents',
      '#count': 'count',
    });
  });

  it('omits ExpressionAttributeValues when only removing', () => {
    expect(buildUpdate({ website: '' }).ExpressionAttributeValues).toBeUndefined();
  });
});

describe('stripEmpty', () => {
  it('drops empty strings and undefined but keeps 0/false', () => {
    expect(stripEmpty({ a: '', b: undefined, c: 0, d: false, e: 'x' })).toEqual({ c: 0, d: false, e: 'x' });
  });
});
