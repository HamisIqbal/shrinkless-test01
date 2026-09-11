import { describe, expect, it } from 'vitest';
import { formatCents, parsePriceToCents } from '@/lib/money';

describe('formatCents', () => {
  it('formats whole dollars', () => {
    expect(formatCents(4500)).toBe('$45.00');
  });

  it('formats zero', () => {
    expect(formatCents(0)).toBe('$0.00');
  });

  it('formats amounts over a thousand with a separator', () => {
    expect(formatCents(123456)).toBe('$1,234.56');
  });
});

describe('parsePriceToCents', () => {
  it('parses a decimal string', () => {
    expect(parsePriceToCents('45.00')).toBe(4500);
  });

  it('parses a value with a currency symbol', () => {
    expect(parsePriceToCents('$45.99')).toBe(4599);
  });

  it('rounds to the nearest cent rather than truncating', () => {
    expect(parsePriceToCents('45.005')).toBe(4501);
  });

  it('throws on non-numeric input', () => {
    expect(() => parsePriceToCents('free')).toThrowError(/invalid price/i);
  });

  it('throws on an empty string rather than returning zero', () => {
    expect(() => parsePriceToCents('')).toThrowError(/invalid price/i);
    expect(() => parsePriceToCents('   ')).toThrowError(/invalid price/i);
  });

  it('throws on a negative price', () => {
    expect(() => parsePriceToCents('-5.00')).toThrowError(/invalid price/i);
  });
});
