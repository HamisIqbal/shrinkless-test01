import { describe, expect, it } from 'vitest';
import { parseEnquiryLines, wholesaleEnquirySchema } from '@/lib/validation/wholesale';

const VALID = {
  company: 'Northwood Supply Co',
  contactName: 'Alex Reyes',
  email: '  Buyer@Northwood.COM ',
  phone: '+1 555 0134',
  country: 'United States',
  message: 'Looking for a spring drop.',
  lines: [{ slug: 'wholesale-razor-tank', tier: 300 }],
};

describe('parseEnquiryLines', () => {
  it('reads the slug:tier pairs a form sends', () => {
    expect(parseEnquiryLines(['wholesale-crop-tee:450', 'wholesale-boy-tee:1200'])).toEqual([
      { slug: 'wholesale-crop-tee', tier: 450 },
      { slug: 'wholesale-boy-tee', tier: 1200 },
    ]);
  });

  it('keeps a malformed pair rather than dropping it, so validation can reject it', () => {
    const parsed = parseEnquiryLines(['wholesale-crop-tee:banana', 'nonsense']);

    expect(parsed).toHaveLength(2);
    expect(wholesaleEnquirySchema.safeParse({ ...VALID, lines: parsed }).success).toBe(false);
  });
});

describe('wholesaleEnquirySchema', () => {
  it('accepts a filled-in enquiry and normalises the address', () => {
    const parsed = wholesaleEnquirySchema.parse(VALID);

    expect(parsed.email).toBe('buyer@northwood.com');
    expect(parsed.company).toBe('Northwood Supply Co');
    expect(parsed.lines).toEqual([{ slug: 'wholesale-razor-tank', tier: 300 }]);
  });

  it('lets the optional fields go missing', () => {
    const bare: Record<string, unknown> = { ...VALID };
    delete bare.phone;
    delete bare.message;

    const parsed = wholesaleEnquirySchema.parse(bare);

    expect(parsed.phone).toBe('');
    expect(parsed.message).toBe('');
  });

  it.each([
    ['company', ''],
    ['contactName', ' '],
    ['country', ''],
    ['email', 'not-an-address'],
  ])('rejects a missing or malformed %s', (field, value) => {
    const result = wholesaleEnquirySchema.safeParse({ ...VALID, [field]: value });
    expect(result.success).toBe(false);
  });

  it('rejects an enquiry with no lines', () => {
    expect(wholesaleEnquirySchema.safeParse({ ...VALID, lines: [] }).success).toBe(false);
  });

  it('rejects a quantity that is not one of the five tiers', () => {
    const lines = [{ slug: 'wholesale-razor-tank', tier: 200 }];
    expect(wholesaleEnquirySchema.safeParse({ ...VALID, lines }).success).toBe(false);
  });

  it('rejects the same style twice', () => {
    const lines = [
      { slug: 'wholesale-razor-tank', tier: 150 },
      { slug: 'wholesale-razor-tank', tier: 600 },
    ];
    expect(wholesaleEnquirySchema.safeParse({ ...VALID, lines }).success).toBe(false);
  });

  it('carries no price: the server prices the enquiry itself', () => {
    const parsed = wholesaleEnquirySchema.parse({
      ...VALID,
      lines: [{ slug: 'wholesale-razor-tank', tier: 300, unitPriceCents: 1 }],
    });

    expect(parsed.lines[0]).not.toHaveProperty('unitPriceCents');
  });
});
