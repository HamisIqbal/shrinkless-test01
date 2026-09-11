import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from '@/lib/validation/auth';

describe('registerSchema', () => {
  it('accepts a valid registration', () => {
    const parsed = registerSchema.parse({
      email: 'Buyer@Example.com',
      password: 'a-strong-password',
      name: 'A Buyer',
    });

    expect(parsed.email).toBe('buyer@example.com');
    expect(parsed.name).toBe('A Buyer');
  });

  it('lowercases and trims the email', () => {
    expect(registerSchema.parse({
      email: '  MiXeD@Example.com ',
      password: 'a-strong-password',
    }).email).toBe('mixed@example.com');
  });

  it('rejects an invalid email', () => {
    expect(() => registerSchema.parse({ email: 'nope', password: 'a-strong-password' })).toThrow();
  });

  it('rejects a password under 8 characters', () => {
    expect(() => registerSchema.parse({ email: 'a@b.com', password: 'short12' })).toThrow();
  });

  it('accepts a password of exactly 8 characters', () => {
    expect(registerSchema.parse({ email: 'a@b.com', password: '12345678' }).password).toBe('12345678');
  });

  it('defaults name to an empty string', () => {
    expect(registerSchema.parse({ email: 'a@b.com', password: 'a-strong-password' }).name).toBe('');
  });
});

describe('loginSchema', () => {
  it('accepts any non-empty password', () => {
    const parsed = loginSchema.parse({ email: 'a@b.com', password: 'x' });
    expect(parsed.password).toBe('x');
  });

  it('rejects an empty password', () => {
    expect(() => loginSchema.parse({ email: 'a@b.com', password: '' })).toThrow();
  });
});
