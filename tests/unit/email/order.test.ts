import { describe, expect, it } from 'vitest';
import { orderConfirmationMail, orderShippedMail } from '@/lib/email/order';
import type { OrderDTO } from '@/types/dto';

const order = {
  orderNumber: 'SL-260924-ABCD',
  email: 'buyer@example.com',
  items: [
    { title: '<b>Tee</b>', size: 'm', color: 'ink', sku: 'T-M', unitPriceCents: 4500, quantity: 2, imagePublicId: '' },
  ],
  shippingAddress: {
    name: '<script>alert(1)</script>', line1: '1 Main St', line2: '', city: 'Austin',
    state: 'TX', postalCode: '78701', country: 'US', phone: '',
  },
  subtotalCents: 9000,
  shippingCents: 0,
  taxCents: 0,
  totalCents: 9000,
  trackingNumber: '1Z999',
} as unknown as OrderDTO;

describe('order mail', () => {
  it('confirms the order to the address it was placed with', () => {
    const mail = orderConfirmationMail(order);

    expect(mail.to).toBe('buyer@example.com');
    expect(mail.subject).toContain('SL-260924-ABCD');
    expect(mail.text).toContain('$90.00');
  });

  it('escapes everything a shopper typed before it reaches the HTML', () => {
    const html = orderConfirmationMail(order).html ?? '';

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>Tee</b>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('carries the tracking number when there is one', () => {
    expect(orderShippedMail(order).text).toContain('1Z999');
    expect(orderShippedMail({ ...order, trackingNumber: '' }).text).not.toContain('Tracking');
  });
});
