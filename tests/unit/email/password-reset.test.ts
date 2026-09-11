import { describe, expect, it } from 'vitest';
import { passwordResetMail } from '@/lib/email/password-reset';

const URL = 'https://shrinkless.example/reset-password?token=abc123';

describe('passwordResetMail', () => {
  it('addresses the mail and says what it is for', () => {
    const mail = passwordResetMail('buyer@example.com', URL, 60);

    expect(mail.to).toBe('buyer@example.com');
    expect(mail.subject).toMatch(/reset/i);
  });

  it('carries the link in both the text and the html part', () => {
    const mail = passwordResetMail('buyer@example.com', URL, 60);

    expect(mail.text).toContain(URL);
    expect(mail.html).toContain(URL);
  });

  it('prints the link as well as linking it, for clients that strip anchors', () => {
    const mail = passwordResetMail('buyer@example.com', URL, 60);

    // Twice in the HTML: once as the href, once as readable text.
    expect(mail.html?.split(URL).length).toBeGreaterThanOrEqual(3);
  });

  it('states how long the link lasts', () => {
    const mail = passwordResetMail('buyer@example.com', URL, 60);

    expect(mail.text).toContain('60 minutes');
    expect(mail.html).toContain('60 minutes');
  });

  it('tells a recipient who did not ask that nothing has happened', () => {
    const mail = passwordResetMail('buyer@example.com', URL, 60);

    expect(mail.text).toMatch(/nothing has changed/i);
    expect(mail.html).toMatch(/nothing has changed/i);
  });
});
