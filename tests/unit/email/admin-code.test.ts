import { describe, expect, it } from 'vitest';
import { adminCodeMail, adminCodeRecipient, maskEmail } from '@/lib/email/admin-code';
import { mailFrom } from '@/lib/email/send';

const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;

describe('adminCodeRecipient', () => {
  it('prefers the configured second-factor mailbox', () => {
    expect(
      adminCodeRecipient('admin@shop.com', env({ ADMIN_2FA_EMAIL: 'Owner@Gmail.com' })),
    ).toBe('owner@gmail.com');
  });

  it('falls back to the account address when unset or blank', () => {
    expect(adminCodeRecipient('admin@shop.com', env({}))).toBe('admin@shop.com');
    expect(adminCodeRecipient('admin@shop.com', env({ ADMIN_2FA_EMAIL: '  ' }))).toBe(
      'admin@shop.com',
    );
  });
});

describe('maskEmail', () => {
  it('keeps the first and last character of the name and the whole domain', () => {
    expect(maskEmail('hamisiqbal7@gmail.com')).toBe('h••••••7@gmail.com');
  });

  it('handles very short names and non-addresses without throwing', () => {
    expect(maskEmail('ab@x.com')).toBe('a•••@x.com');
    expect(maskEmail('nonsense')).toBe('nonsense');
  });
});

describe('adminCodeMail', () => {
  it('carries the code in the subject, the text and the html', () => {
    const mail = adminCodeMail('owner@gmail.com', '048213', 10);

    expect(mail.to).toBe('owner@gmail.com');
    expect(mail.subject).toContain('048213');
    expect(mail.text).toContain('048213');
    expect(mail.text).toContain('10 minutes');
    expect(mail.html).toContain('048213');
  });
});

describe('mailFrom', () => {
  it('uses the configured sender, and the shared Resend one otherwise', () => {
    expect(mailFrom(env({ EMAIL_FROM: 'Shop <hi@shop.com>' }))).toBe('Shop <hi@shop.com>');
    expect(mailFrom(env({}))).toBe('Shrinkless <onboarding@resend.dev>');
  });
});
