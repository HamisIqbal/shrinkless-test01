'use server';

import { revalidatePath } from 'next/cache';
import { adminAction } from '@/lib/admin/action';
import { NotAuthorizedError, requirePermission } from '@/lib/auth/guards';
import { SITE_UPLOAD_FOLDER } from '@/lib/cloudinary/config';
import { loadCloudinaryEnv, signParams } from '@/lib/cloudinary/signature';
import {
  HERO_SLOT,
  resetMediaSlot,
  saveHeroFrames,
  saveMediaSlot,
  saveSectionSettings,
} from '@/lib/services/site-media';
import {
  heroFramesInputSchema,
  mediaPublishSchema,
  mediaSlotIdSchema,
  mediaSlotInputSchema,
} from '@/lib/validation/media';

/**
 * Site media reaches the storefront through pages, not through the layout, so
 * every route is revalidated rather than just the shell — the hero is on the
 * home page, the editorial frames are spread across three, and the footer
 * backdrop is in the layout. One sweep is simpler than a list that would rot.
 */
function revalidateStorefront(): void {
  revalidatePath('/admin/media');
  revalidatePath('/', 'layout');
}

export const saveMediaSlotAction = adminAction(
  {
    permission: 'media:write',
    schema: mediaSlotInputSchema,
    genericError: 'Could not save that image.',
  },
  async ({ slotId, frame }) => {
    await saveMediaSlot(slotId, frame);
    revalidateStorefront();

    return undefined;
  },
);

export const saveHeroFramesAction = adminAction(
  {
    permission: 'media:write',
    schema: heroFramesInputSchema,
    genericError: 'Could not save the carousel.',
  },
  async ({ frames }) => {
    await saveHeroFrames(frames);
    revalidateStorefront();

    return undefined;
  },
);

export const resetMediaSlotAction = adminAction(
  {
    permission: 'media:write',
    schema: mediaSlotIdSchema,
    genericError: 'Could not restore that image.',
  },
  async ({ slotId }) => {
    await resetMediaSlot(slotId);
    revalidateStorefront();

    return undefined;
  },
);

/**
 * Everything the admin changed in the visual editor, in one action.
 *
 * The editor keeps its changes in the browser until Publish is pressed — that
 * is the whole bargain of it, that a photograph can be tried in four crops
 * without the shop seeing any of them. So the write is a session at a time,
 * and each slot still goes through the same service the single-slot save uses,
 * which is what keeps the carousel's rules and the slot registry in one place.
 */
export const publishMediaAction = adminAction(
  {
    permission: 'media:write',
    schema: mediaPublishSchema,
    genericError: 'Could not publish those changes.',
  },
  async ({ slots, sections }) => {
    for (const slot of slots) {
      if (slot.slotId === HERO_SLOT) {
        await saveHeroFrames(slot.frames);
      } else {
        await saveMediaSlot(slot.slotId, slot.frames[0]);
      }
    }

    await saveSectionSettings(sections);

    revalidateStorefront();

    return undefined;
  },
);

export type SiteUploadSignature =
  | {
      ok: true;
      cloudName: string;
      apiKey: string;
      timestamp: number;
      folder: string;
      signature: string;
    }
  | { ok: false; error: string };

/**
 * A one-shot signature for an upload into the site folder.
 *
 * The same shape the product uploader gets, and for the same reason: the
 * secret is used here and never leaves the server, so image bytes travel
 * straight from the browser to Cloudinary without passing through this app.
 */
export async function createSiteUploadSignatureAction(): Promise<SiteUploadSignature> {
  try {
    await requirePermission('media:write');
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

  return {
    ok: true,
    cloudName: env.cloudName,
    apiKey: env.apiKey,
    timestamp,
    folder: SITE_UPLOAD_FOLDER,
    signature: signParams({ folder: SITE_UPLOAD_FOLDER, timestamp }, env.apiSecret),
  };
}
