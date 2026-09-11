import { z } from 'zod';

import { LONG_MAX, isKnownContentKey } from '@/lib/services/site-content';

/**
 * A content field's key.
 *
 * Checked against the registry here as well as in the service, so a request
 * naming a field the site does not have is turned away at the edge with a
 * message a person can read, rather than reaching the database.
 */
const key = z
  .string()
  .trim()
  .min(1, 'A field is required')
  .refine(isKnownContentKey, 'That is not a field this site has');

/**
 * The wording itself.
 *
 * Bounded at the longest any field takes; the service applies the tighter
 * limit a heading or a button actually has, because that one depends on which
 * field this is and the schema does not know yet. Empty is refused outright:
 * a blank heading is a hole in the page, and "remove this wording" is
 * `resetContentFieldAction`, which puts back what the site shipped with.
 */
const value = z
  .string()
  .trim()
  .min(1, 'This cannot be empty')
  .max(LONG_MAX, `That is longer than ${LONG_MAX} characters`);

export const contentFieldInputSchema = z.object({ key, value });

export const contentKeySchema = z.object({ key });

export type ContentFieldInput = z.infer<typeof contentFieldInputSchema>;

/**
 * How a field is set, at one width.
 *
 * Deliberately loose here and strict in the service: `cleanStyle` owns the
 * ranges and the vocabulary, and repeating them in a schema would be a second
 * copy to keep in step. What this stage is for is shape — an object of
 * primitives, small enough to be worth writing down — so that nothing
 * unbounded reaches the database even if the service later grows a property.
 */
const style = z
  .record(z.string(), z.union([z.string().max(40), z.number(), z.boolean()]))
  .optional();

const styleSet = z
  .object({ desktop: style, mobile: style })
  .optional();

/**
 * One field as the visual editor hands it back.
 *
 * The selector is derived from the live page by the editor, never typed, and
 * is checked again in the service before any of it becomes a CSS rule.
 */
const fieldEdit = z.object({
  key,
  value,
  style: styleSet,
  selector: z.string().trim().max(400).optional(),
});

/**
 * A page's worth of edits, saved together.
 *
 * The editor holds everything as a draft until Save, so what arrives is every
 * line the admin touched while they were on that page. Bounded at 200, which
 * is more fields than any page has.
 */
export const contentPageInputSchema = z.object({
  entries: z.array(fieldEdit).min(1, 'There is nothing to save').max(200),
});

export type ContentPageInput = z.infer<typeof contentPageInputSchema>;
