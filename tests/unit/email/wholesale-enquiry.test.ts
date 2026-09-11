import { describe, expect, it } from 'vitest';
import { wholesaleEnquiryMail } from '@/lib/email/wholesale-enquiry';
import type { WholesaleEnquiryDTO } from '@/types/dto';

const ENQUIRY: WholesaleEnquiryDTO = {
  id: 'abc123',
  company: 'Northwood Supply Co',
  contactName: 'Alex Reyes',
  email: 'buyer@northwood.com',
  phone: '+1 555 0134',
  country: 'United States',
  message: 'Spring drop, need delivery by March.',
  lines: [
    { slug: 'wholesale-razor-tank', title: 'Razor Tank', tier: 150, unitPriceCents: 2880, totalCents: 432_000 },
    { slug: 'wholesale-crop-tee', title: 'Crop Tee', tier: 1200, unitPriceCents: 1840, totalCents: 2_208_000 },
  ],
  units: 1350,
  totalCents: 2_640_000,
  status: 'new',
};

describe('wholesaleEnquiryMail', () => {
  it('goes to the store and names the company in the subject', () => {
    const mail = wholesaleEnquiryMail('trade@shrinkless.example', ENQUIRY);

    expect(mail.to).toBe('trade@shrinkless.example');
    expect(mail.subject).toContain('Northwood Supply Co');
  });

  it('carries every line, with its quantity and its money', () => {
    const mail = wholesaleEnquiryMail('trade@shrinkless.example', ENQUIRY);

    for (const part of [mail.text, mail.html ?? '']) {
      expect(part).toContain('Razor Tank');
      expect(part).toContain('Crop Tee');
      expect(part).toContain('150');
      expect(part).toContain('1,200');
      expect(part).toContain('$28.80');
      expect(part).toContain('$26,400.00');
    }
  });

  it('makes the buyer reachable without opening the database', () => {
    const mail = wholesaleEnquiryMail('trade@shrinkless.example', ENQUIRY);

    expect(mail.text).toContain('buyer@northwood.com');
    expect(mail.text).toContain('+1 555 0134');
    expect(mail.text).toContain('Alex Reyes');
    expect(mail.text).toContain('Spring drop, need delivery by March.');
  });

  it('says the quote is indicative, so nobody treats it as an invoice', () => {
    const mail = wholesaleEnquiryMail('trade@shrinkless.example', ENQUIRY);
    expect(mail.text).toMatch(/indicative/i);
  });

  it('leaves out an empty phone and an empty message rather than printing a blank label', () => {
    const mail = wholesaleEnquiryMail('trade@shrinkless.example', {
      ...ENQUIRY,
      phone: '',
      message: '',
    });

    expect(mail.text).not.toMatch(/Phone:/);
    expect(mail.text).not.toMatch(/Notes:/);
  });

  it('escapes what the buyer typed instead of letting it into the markup', () => {
    const mail = wholesaleEnquiryMail('trade@shrinkless.example', {
      ...ENQUIRY,
      company: '<script>alert(1)</script>',
    });

    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });
});
