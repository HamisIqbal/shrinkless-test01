import { z } from 'zod';

/**
 * What the browser is allowed to send at checkout.
 *
 * Notably absent: any amount. Line prices come from the variant, shipping from
 * the method, and the total is computed server-side — a request that named its
 * own price would simply have that field ignored, because there is no field.
 *
 * The address arrives from Stripe's Address Element, which has already
 * validated and normalised it, but it is re-validated here anyway: the element
 * runs in the browser, and the browser is not a trusted source.
 */
const usState = z
  .string()
  .trim()
  .toUpperCase()
  .length(2, 'Use the two-letter state code');

export const shippingAddressSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  line1: z.string().trim().min(1, 'Street address is required').max(200),
  line2: z.string().trim().max(200).default(''),
  city: z.string().trim().min(1, 'City is required').max(100),
  state: usState,
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, 'Use a five-digit ZIP code'),
  // The store ships to the United States only. Anything else is refused here
  // rather than at the warehouse.
  country: z.literal('US', { message: 'We currently ship within the US only' }),
  phone: z.string().trim().max(40).default(''),
});

export const checkoutInputSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address')),
  shippingAddress: shippingAddressSchema,
});

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;
export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;
