import { getContentLayer, getSiteContent } from '@/lib/services/site-content';
import { ContentLayer } from '@/components/site/ContentLayer';
import { getMediaLayer } from '@/lib/services/site-media';
import { MediaLayer } from '@/components/site/MediaLayer';

export const metadata = {
  title: 'Our Story',
  description: 'Why Shrinkless makes one tee, and makes it in the United States.',
};

const VIDEO_SRC =
  'https://res.cloudinary.com/dcsewsmhd/video/upload/v1788450220/There_s_a_lot_of_work_that_goes_into_making_our_t-shirts_special._Cutting_sewing_dyeing_washi_u85ovb.mp4';

/* A hero, so no `.wrap` — the film runs edge to edge and the copy carries its
   own gutters. Over the video on desktop, under it on a tablet or phone.
   No <InstagramStrip /> here — app/(shop)/(instagram-last)/layout.tsx already
   renders it after every page's content, right where the brief wants it. */
export default async function OurStoryPage() {
  const [copy, layer, mediaLayer] = await Promise.all([
    getSiteContent(),
    getContentLayer('our-story'),
    getMediaLayer('our-story'),
  ]);

  return (
    <>
      <ContentLayer {...layer} />

      <MediaLayer {...mediaLayer} />

      <section className="band band--ink storyfilm">
        <div className="storyfilm__stage">
          <video
            className="storyfilm__video"
            src={VIDEO_SRC}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-label="Cutting, sewing, dyeing and washing a Shrinkless tee"
          />

          <div className="storyfilm__copy">
            <div className="storyfilm__column">
              <h1 className="storyfilm__title">{copy['story.title']}</h1>
              <p className="storyfilm__body">{copy['story.body']}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
