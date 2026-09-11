import type { z } from 'zod';
import { NotAuthorizedError, requirePermission, type AdminActor } from '@/lib/auth/guards';
import type { Permission } from '@/lib/auth/permissions';

/**
 * One response shape for every admin mutation.
 *
 * A caller should never have to guess whether a failure arrives as a thrown
 * error, a null, or a string. `ok` discriminates; `error` is always safe to
 * show a human; `fieldErrors` is there when a form can point at the offending
 * input instead of just complaining.
 */
export type AdminResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok(): AdminResult<undefined>;
export function ok<T>(data: T): AdminResult<T>;
export function ok<T>(data?: T): AdminResult<T | undefined> {
  return { ok: true, data };
}

export function fail<T = undefined>(
  error: string,
  fieldErrors?: Record<string, string>,
): AdminResult<T> {
  return { ok: false, error, ...(fieldErrors ? { fieldErrors } : {}) };
}

/** Zod issues, flattened to one message per field, for a form to render. */
function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_';
    errors[path] ??= issue.message;
  }

  return errors;
}

/**
 * Errors a service raises deliberately, meant to be read by a person. Anything
 * else is a bug or a database fault and must not have its message forwarded —
 * a stack trace or a connection string in a toast is a leak.
 */
export class AdminOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminOperationError';
  }
}

export type ErrorTranslator = (error: unknown) => string | null;

/**
 * Wraps an admin mutation with the four things every one of them needs:
 * an authorization check, input validation, a stable result shape, and a
 * failure path that never leaks internals.
 *
 * The permission check runs *first* and always — before validation, before
 * any database read — so an unauthorized caller learns nothing about the
 * shape of the input or the state of the data.
 */
export function adminAction<Schema extends z.ZodType, T>(
  config: {
    permission: Permission;
    schema: Schema;
    /** Maps known service errors to a message worth showing. Return null to
     *  fall through to the generic message. */
    translate?: ErrorTranslator;
    /** Shown when nothing more specific is known. */
    genericError?: string;
  },
  handler: (input: z.infer<Schema>, actor: AdminActor) => Promise<T>,
): (raw: unknown) => Promise<AdminResult<T>> {
  const generic = config.genericError ?? 'Could not complete that. Try again.';

  return async function run(raw: unknown): Promise<AdminResult<T>> {
    let actor: AdminActor;

    try {
      actor = await requirePermission(config.permission);
    } catch (error) {
      if (error instanceof NotAuthorizedError) return fail('Not authorised.');
      throw error;
    }

    const parsed = config.schema.safeParse(raw);
    if (!parsed.success) {
      return fail(
        parsed.error.issues[0]?.message ?? 'Check the details and try again.',
        fieldErrorsFrom(parsed.error),
      );
    }

    try {
      return ok(await handler(parsed.data, actor));
    } catch (error) {
      if (error instanceof AdminOperationError) return fail(error.message);

      const translated = config.translate?.(error);
      if (translated) return fail(translated);

      // Logged server-side so a real fault is diagnosable; the caller gets
      // nothing but the generic line.
      console.error(`admin action failed [${config.permission}]`, error);
      return fail(generic);
    }
  };
}
