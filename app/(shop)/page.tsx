import {
  listFeaturedProducts,
  listNewArrivals,
  listProductsInCategory,
} from '@/lib/services/products';
import {
  categoryImage,
  getMediaLayer,
  getSiteMedia,
  type SiteMedia,
} from '@/lib/services/site-media';
import { MediaLayer } from '@/components/site/MediaLayer';
import { getContentLayer, getSiteContent, type SiteContent } from '@/lib/services/site-content';
import { ContentLayer } from '@/components/site/ContentLayer';
import { SHOPPABLE } from '@/lib/shop/navigation';
import type { HeroSlide } from '@/components/site/HeroSlider';
import type { Gateway } from '@/components/shop/CategoryGateway';
import type { Quote } from '@/components/editorial/QuoteRow';
import { HomeHero } from '@/components/home/HomeHero';
import { HomeGateway } from '@/components/home/HomeGateway';
import { HomeInstagram } from '@/components/home/HomeInstagram';
import { HomeShelf } from '@/components/home/HomeShelf';
import { HomeLookbook } from '@/components/home/HomeLookbook';
import { HomeStory, type Chapter } from '@/components/home/HomeStory';
import { HomePromise } from '@/components/home/HomePromise';
import { HomeReviews } from '@/components/home/HomeReviews';
import { HomeScrollSync } from '@/components/home/HomeScene';

/* The old statement band said this in type over an empty ground. The words and
   the photographs are both the admin's to change, so both are data here. */
const statement = ({ editorial }: SiteMedia, copy: SiteContent): Chapter[] => [
  {
    title: copy['home.story.1.title'],
    body: copy['home.story.1.body'],
    image: editorial.torso,
    href: '/why-shrinkless',
    label: 'Why Shrinkless',
  },
  {
    title: copy['home.story.2.title'],
    body: copy['home.story.2.body'],
    image: editorial.heather,
    href: '/our-story',
    label: 'Our story',
  },
];

// Placeholder copy until real reviews exist — spec §11.3. Editable on the
// Content tab, so replacing it is not a deploy.
const quotes = (copy: SiteContent): Quote[] => [
  { text: copy['home.reviews.1.text'], name: copy['home.reviews.1.name'] },
  { text: copy['home.reviews.2.text'], name: copy['home.reviews.2.name'] },
  { text: copy['home.reviews.3.text'], name: copy['home.reviews.3.name'] },
];

export default async function HomePage() {
  const [media, copy, layer, mediaLayer, newArrivals, featured, ...categories] = await Promise.all([
    getSiteMedia(),
    getSiteContent(),
    getContentLayer('home'),
    getMediaLayer('home'),
    listNewArrivals(6),
    listFeaturedProducts(3),
    ...SHOPPABLE.map(({ slug }) => listProductsInCategory(slug)),
  ]);

  // The frames are media and come from the database; nothing else rides with
  // them, so the hero is the photography and the two calls to action.
  const slides: HeroSlide[] = media.hero.map((image) => ({ image }));

  // Deliberately still the curated pair rather than every category in the
  // database: these are art-directed frames with their own photography, not a
  // menu. The navigation and /shop routes read the real category list.
  const gateways: Gateway[] = SHOPPABLE.map(({ slug, label }, index) => ({
    slug,
    label,
    count: categories[index]?.length ?? 0,
    image: categoryImage(media, slug),
  }));

  return (
    <>
      <HomeHero
        slides={slides}
        eyebrow={copy['home.hero.eyebrow']}
        headline={[copy['home.hero.headline1'], copy['home.hero.headline2']]}
        lede={copy['home.hero.lede']}
        primary={{ href: '/shop', label: copy['home.hero.primary'] }}
        secondary={{ href: '/why-shrinkless', label: copy['home.hero.secondary'] }}
      />

      {/* Shopping direction, immediately after the hero — before any story. */}
      <HomeGateway gateways={gateways} />

      {/* On the homepage the community band is not a footer ornament: the real
          account, high up, before the first grid of product cards. Every other
          shop page still gets it last, from
          app/(shop)/(instagram-last)/layout.tsx. */}
      <HomeInstagram />

      <HomeShelf
        headingId="new-heading"
        eyebrow={copy['home.new.eyebrow']}
        heading={copy['home.new.heading']}
        link={{ href: '/shop?sort=newest', label: copy['home.new.link'] }}
        products={newArrivals}
        layout="index"
        empty={
          <p className="hm-shelf__empty">
            The catalogue is empty. Seed it with <code>npm run seed:shrinkless</code>.
          </p>
        }
      />

      {/* Photography between two shelves of product cards, so the page does
          not read as three shops in a row: the reel, the two chapters and the
          promise run back to back. */}
      <HomeLookbook />

      <HomeStory chapters={statement(media, copy)} />

      <HomePromise
        image={media.editorial.promise}
        eyebrow={copy['home.promise.eyebrow']}
        headline={copy['home.promise.headline']}
        body={copy['home.promise.body']}
      />

      {featured.length ? (
        <HomeShelf
          headingId="featured-heading"
          eyebrow={copy['home.featured.eyebrow']}
          heading={copy['home.featured.heading']}
          link={{ href: '/shop', label: copy['home.featured.link'] }}
          products={featured}
          layout="spread"
        />
      ) : null}

      <HomeReviews
        eyebrow={copy['home.reviews.eyebrow']}
        heading={copy['home.reviews.heading']}
        quotes={quotes(copy)}
      />

      <ContentLayer {...layer} />

      <MediaLayer {...mediaLayer} />

      <HomeScrollSync />
    </>
  );
}
