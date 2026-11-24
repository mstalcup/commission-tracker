import { describe, expect, it } from 'vitest';
import {
  centsToInput,
  CommissionInputSchema,
  DEFAULT_STAGES,
  daysBetween,
  formatMoney,
  parseMoney,
  pctChange,
  prevMonthKey,
  StagesSchema,
  weekStart,
} from './index';

describe('money', () => {
  it('formats whole and fractional amounts like the mockup', () => {
    expect(formatMoney(103500)).toBe('$1,035');
    expect(formatMoney(106344)).toBe('$1,063.44');
    expect(formatMoney(5, 'USD')).toBe('$0.05');
  });
  it('parses typed amounts into cents', () => {
    expect(parseMoney('1,035')).toBe(103500);
    expect(parseMoney('$12.5')).toBe(1250);
    expect(parseMoney('0.07')).toBe(7);
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('1.234')).toBeNull();
  });
  it('round-trips cents to input strings', () => {
    expect(centsToInput(103500)).toBe('1035');
    expect(centsToInput(106344)).toBe('1063.44');
    expect(centsToInput(undefined)).toBe('');
  });
  it('computes month-over-month change', () => {
    expect(pctChange(106344, 29400)).toBeCloseTo(261.71, 1);
    expect(pctChange(100, 0)).toBeNull();
  });
});

describe('dates', () => {
  it('handles month and week math', () => {
    expect(prevMonthKey('2026-01')).toBe('2025-12');
    expect(prevMonthKey('2026-11')).toBe('2026-10');
    expect(daysBetween('2026-11-21', '2026-11-23T10:00:00Z')).toBe(2);
    expect(weekStart('2026-11-26')).toBe('2026-11-23'); // Thu → Mon
    expect(weekStart('2026-11-23')).toBe('2026-11-23');
  });
});

describe('schemas', () => {
  it('accepts default stages and rejects duplicates', () => {
    expect(StagesSchema.safeParse(DEFAULT_STAGES).success).toBe(true);
    expect(StagesSchema.safeParse([...DEFAULT_STAGES, DEFAULT_STAGES[0]]).success).toBe(false);
  });
  it('validates commission input', () => {
    expect(CommissionInputSchema.safeParse({ title: 'Coffee table', priceCents: 120000 }).success).toBe(true);
    expect(CommissionInputSchema.safeParse({ title: '' }).success).toBe(false);
    expect(CommissionInputSchema.safeParse({ title: 'x', priceCents: -1 }).success).toBe(false);
    expect(CommissionInputSchema.safeParse({ title: 'x', dueDate: '' }).success).toBe(true);
    expect(CommissionInputSchema.safeParse({ title: 'x', hacker: true }).success).toBe(false);
  });
});
