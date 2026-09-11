import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db/connection';
import { ShippingMethod } from '@/lib/db/models/shipping-method';
import { getStoreSettings } from '@/lib/services/settings';
import type { ShippingMethodInput } from '@/lib/validation/shipping';
import type { SettingsDTO, ShippingMethodDTO, ShippingQuoteDTO } from '@/types/dto';

export class ShippingCodeTakenError extends Error {
  constructor(code: string) {
    super(`The code "${code}" is already used by another shipping method`);
    this.name = 'ShippingCodeTakenError';
  }
}

export class ShippingMethodNotFoundError extends Error {
  constructor(id: string) {
    super(`No shipping method with id ${id}`);
    this.name = 'ShippingMethodNotFoundError';
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toDTO(doc: any): ShippingMethodDTO {
  return {
    id: String(doc._id),
    name: doc.name,
    code: doc.code,
    description: doc.description ?? '',
    rateCents: doc.rateCents,
    freeOverCents: doc.freeOverCents ?? null,
    countries: doc.countries ?? [],
    states: doc.states ?? [],
    estimate: doc.estimate ?? '',
    active: Boolean(doc.active),
    sortOrder: doc.sortOrder ?? 0,
    archived: Boolean(doc.archivedAt),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function listShippingMethods(
  options: { includeArchived?: boolean } = {},
): Promise<ShippingMethodDTO[]> {
  await connectToDatabase();

  const query = options.includeArchived ? {} : { archivedAt: null };
  const docs = await ShippingMethod.find(query).sort({ sortOrder: 1, name: 1 }).lean();

  return docs.map(toDTO);
}

export async function getShippingMethod(id: string): Promise<ShippingMethodDTO | null> {
  if (!Types.ObjectId.isValid(id)) return null;

  await connectToDatabase();

  const doc = await ShippingMethod.findById(id).lean();
  return doc ? toDTO(doc) : null;
}

export async function saveShippingMethod(input: ShippingMethodInput): Promise<string> {
  await connectToDatabase();

  if (input.id && !Types.ObjectId.isValid(input.id)) {
    throw new ShippingMethodNotFoundError(input.id);
  }

  const clash = await ShippingMethod.findOne({ code: input.code }).select('_id').lean();
  if (clash && (!input.id || String(clash._id) !== input.id)) {
    throw new ShippingCodeTakenError(input.code);
  }

  const fields = {
    name: input.name,
    code: input.code,
    description: input.description,
    rateCents: input.rateCents,
    freeOverCents: input.freeOverCents,
    countries: input.countries,
    states: input.states,
    estimate: input.estimate,
    active: input.active,
    sortOrder: input.sortOrder,
  };

  if (!input.id) {
    const created = await ShippingMethod.create(fields);
    return String(created._id);
  }

  const updated = await ShippingMethod.findByIdAndUpdate(input.id, { $set: fields });
  if (!updated) throw new ShippingMethodNotFoundError(input.id);

  return input.id;
}

export async function archiveShippingMethod(id: string, archived: boolean): Promise<void> {
  if (!Types.ObjectId.isValid(id)) throw new ShippingMethodNotFoundError(id);

  await connectToDatabase();

  const updated = await ShippingMethod.findByIdAndUpdate(id, {
    $set: { archivedAt: archived ? new Date() : null, ...(archived ? { active: false } : {}) },
  });

  if (!updated) throw new ShippingMethodNotFoundError(id);
}

/** Empty lists mean "everywhere". Anything listed narrows the method. */
export function methodServes(
  method: Pick<ShippingMethodDTO, 'countries' | 'states'>,
  destination: { country?: string; state?: string },
): boolean {
  const country = (destination.country ?? '').trim().toUpperCase();
  const state = (destination.state ?? '').trim().toUpperCase();

  if (method.countries.length && (!country || !method.countries.includes(country))) return false;
  if (method.states.length && (!state || !method.states.includes(state))) return false;

  return true;
}

/** What a method costs for this order, after its own threshold and the
 *  store-wide free-shipping threshold. */
export function rateFor(
  method: Pick<ShippingMethodDTO, 'rateCents' | 'freeOverCents'>,
  subtotalCents: number,
  storeFreeOverCents: number | null,
): { rateCents: number; free: boolean } {
  const thresholds = [method.freeOverCents, storeFreeOverCents].filter(
    (value): value is number => typeof value === 'number',
  );

  const freed = thresholds.some((threshold) => subtotalCents >= threshold);

  if (freed && method.rateCents > 0) return { rateCents: 0, free: true };

  return { rateCents: method.rateCents, free: method.rateCents === 0 };
}

/**
 * Every shipping option for a destination and an order value.
 *
 * Falls back to the legacy `Settings.shippingZones` table when no method has
 * been configured, so a store that has never opened this screen still quotes
 * something rather than silently shipping for free. Quoting is server-side
 * only — nothing here is ever computed from a number the browser sent.
 */
export async function quoteShipping(input: {
  subtotalCents: number;
  country?: string;
  state?: string;
  settings?: SettingsDTO;
}): Promise<ShippingQuoteDTO[]> {
  const settings = input.settings ?? (await getStoreSettings());
  const methods = await listShippingMethods();

  const serving = methods.filter(
    (method) => method.active && methodServes(method, input),
  );

  if (serving.length) {
    return serving.map((method) => {
      const { rateCents, free } = rateFor(
        method,
        input.subtotalCents,
        settings.freeShippingThresholdCents,
      );

      return {
        code: method.code,
        name: method.name,
        description: method.description,
        estimate: method.estimate,
        rateCents,
        free,
      };
    });
  }

  return legacyZoneQuotes(input.subtotalCents, input.state, settings);
}

/** The pre-existing zone table, kept working. */
function legacyZoneQuotes(
  subtotalCents: number,
  state: string | undefined,
  settings: SettingsDTO,
): ShippingQuoteDTO[] {
  const code = (state ?? '').trim().toUpperCase();

  const zone =
    settings.shippingZones.find((candidate) => candidate.states.includes(code)) ??
    settings.shippingZones.find((candidate) => candidate.states.length === 0);

  if (!zone) return [];

  const threshold = settings.freeShippingThresholdCents;
  const free = threshold !== null && subtotalCents >= threshold;

  return [
    {
      code: 'ZONE',
      name: zone.name,
      description: '',
      estimate: '',
      rateCents: free ? 0 : zone.rateCents,
      free: free || zone.rateCents === 0,
    },
  ];
}

/** The option a checkout would pick with no choice made: the cheapest. */
export async function defaultShippingQuote(input: {
  subtotalCents: number;
  country?: string;
  state?: string;
  settings?: SettingsDTO;
}): Promise<ShippingQuoteDTO | null> {
  const quotes = await quoteShipping(input);
  if (!quotes.length) return null;

  return quotes.reduce((cheapest, quote) =>
    quote.rateCents < cheapest.rateCents ? quote : cheapest,
  );
}
