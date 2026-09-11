import { InstagramIcon } from '@/components/site/icons';
import { InstagramRail } from '@/components/site/InstagramRail';
import {
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  fetchInstagramPosts,
} from '@/lib/brand/instagram';

/**
 * The real Instagram grid, in a large horizontal band. Where it sits is the
 * caller's business: app/(shop)/page.tsx places it above New arrivals, and
 * app/(shop)/(instagram-last)/layout.tsx puts it last on every other page.
 *
 * The tiles used to be brand photography of tees — the same pictures already
 * on the product cards — dressed up as posts. They are gone: that rail now
 * lives on the homepage as what it always was, a lookbook. What is here is
 * either the account's actual posts or an honest invitation to go and look at
 * them.
 *
 * This component fetches; `InstagramRail` moves. The split is the client
 * boundary: the posts are read on the server, and only the scrolling — which
 * needs pointers, a frame loop and the reduced-motion query — ships as
 * JavaScript.
 */
export async function InstagramStrip() {
  /* Two dozen, out of a grid a hundred deep. The number is a compromise the
     rail forces: every post is rendered three times for the endless loop, so
     this is already 72 tiles of markup. Meta will hand over a hundred in one
     request — ask for them and the band becomes a page of its own. */
  const posts = await fetchInstagramPosts(24);

  return (
    <section className="iglane" aria-labelledby="ig-heading">
      <div className="wrap iglane__head">
        <div>
          <p className="eyebrow">Community</p>
          <h2 id="ig-heading" className="head iglane__title">
            <a href={INSTAGRAM_URL} rel="me noreferrer" target="_blank" className="iglane__handle">
              <InstagramIcon className="iglane__icon" />
              @{INSTAGRAM_HANDLE}
            </a>
          </h2>
        </div>

        <p className="meta iglane__note">
          {posts.length ? 'Scroll the rail — tap a post to open it on Instagram' : 'Follow along'}
        </p>
      </div>

      {posts.length ? (
        <InstagramRail posts={posts} />
      ) : (
        /* No token, or Meta said no. Say so plainly rather than filling the
           band with stock photography captioned as posts. */
        <div className="wrap iglane__empty">
          <p className="lede iglane__emptylede">
            New drops, fit pictures and the odd studio day, posted at
            @{INSTAGRAM_HANDLE}.
          </p>
          <a href={INSTAGRAM_URL} rel="me noreferrer" target="_blank" className="btn btn--lg">
            Follow on Instagram
          </a>
        </div>
      )}
    </section>
  );
}
