import { getSiteMedia } from '@/lib/services/site-media';
import { frames } from '@/components/site/LookbookRail';
import { HomeLookbookReel } from '@/components/home/HomeLookbookReel';

/** Reads the gallery frames on the server; the gallery showing them is client-side. */
export async function HomeLookbook() {
  return <HomeLookbookReel frames={frames(await getSiteMedia())} />;
}
