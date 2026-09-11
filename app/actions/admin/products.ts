'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { NotAuthorizedError, requireAdminActor, requirePermission } from '@/lib/auth/guards';
import { adminAction, type AdminResult } from '@/lib/admin/action';
import {
  ProductNotFoundError,
  SkuTakenError,
  SlugTakenError,
  archiveProduct,
  duplicateProduct,
  saveProduct,
  setProductStatus,
} from '@/lib/services/products';
import { productInputSchema } from '@/lib/validation/product';
import { UPLOAD_FOLDER } from '@/lib/cloudinary/config';
import { loadCloudinaryEnv, signParams } from '@/lib/cloudinary/signature';

/** Refreshes every surface a product change can be seen on. */
function revalidateProduct(slug?: string): void {
  revalidatePath('/admin/products');
  revalidatePath('/admin');
  revalidatePath('/shop');
  revalidatePath('/', 'layout');
  if (slug) revalidatePath(`/product/${slug}`);
}

/** Known, human-readable failures. Anything else stays generic. */
function translateProductError(error: unknown): string | null {
  if (error instanceof SlugTakenError) return error.message;
  if (error instanceof SkuTakenError) return error.message;
  if (error instanceof ProductNotFoundError) return 'That product no longer exists.';
  return null;
}

const saveSchema = productInputSchema.extend({ id: z.string().min(1).optional() });

export type SaveProductResult = AdminResult<{ id: string }>;

export const saveProductAction = adminAction(
  {
    permission: 'products:write',
    schema: saveSchema,
    translate: translateProductError,
    genericError: 'Could not save the product.',
  },
  async (input, actor) => {
    const id = await saveProduct(input, { id: actor.id, email: actor.email });
    revalidateProduct(input.slug);
    return { id };
  },
);

export const archiveProductAction = adminAction(
  {
    permission: 'products:write',
    schema: z.object({ id: z.string().min(1), archived: z.boolean() }),
    translate: translateProductError,
    genericError: 'Could not archive the product.',
  },
  async (input) => {
    await archiveProduct(input.id, input.archived);
    revalidateProduct();
    return undefined;
  },
);

export type DuplicateProductResult = AdminResult<{ id: string }>;

export const duplicateProductAction = adminAction(
  {
    permission: 'products:write',
    schema: z.object({ id: z.string().min(1) }),
    translate: translateProductError,
    genericError: 'Could not duplicate the product.',
  },
  async (input) => {
    const id = await duplicateProduct(input.id);
    revalidateProduct();
    return { id };
  },
);

export const setProductStatusAction = adminAction(
  {
    permission: 'products:write',
    schema: z.object({ id: z.string().min(1), status: z.enum(['draft', 'published']) }),
    translate: translateProductError,
    genericError: 'Could not change the product status.',
  },
  async (input) => {
    await setProductStatus(input.id, input.status);
    revalidateProduct();
    return undefined;
  },
);

export type UploadSignature = {
  ok: true;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
};

/**
 * Signs one direct-to-Cloudinary upload.
 *
 * Kept off the generic wrapper because its success shape predates it and the
 * uploader in the browser reads those fields by name. The authorization check
 * is the same one the wrapper would apply.
 */
export async function createUploadSignatureAction(): Promise<
  UploadSignature | { ok: false; error: string }
> {
  try {
    await requirePermission('products:write');
  } catch (error) {
    if (error instanceof NotAuthorizedError) return { ok: false, error: 'Not authorised.' };
    throw error;
  }

  let env;
  try {
    env = loadCloudinaryEnv();
  } catch {
    return { ok: false, error: 'Cloudinary is not configured on this environment.' };
  }

  const timestamp = Math.floor(Date.now() / 1000);

  // The secret is used here and never leaves the server; the browser receives
  // only the signature, so image bytes go straight to Cloudinary.
  return {
    ok: true,
    cloudName: env.cloudName,
    apiKey: env.apiKey,
    timestamp,
    folder: UPLOAD_FOLDER,
    signature: signParams({ folder: UPLOAD_FOLDER, timestamp }, env.apiSecret),
  };
}

/** Kept so callers that only need "am I still an admin" do not import a guard
 *  directly from a client boundary. */
export async function assertAdminAction(): Promise<AdminResult> {
  try {
    await requireAdminActor();
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: 'Not authorised.' };
  }
}
