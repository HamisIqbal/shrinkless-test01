import { InstagramRail } from '@/components/site/InstagramRail';
import { INSTAGRAM_HANDLE, INSTAGRAM_URL, fetchInstagramPosts } from '@/lib/brand/instagram';
import { homeFonts } from '@/components/home/fonts';
import { HomePill } from '@/components/home/HomePill';
import { HomeScene } from '@/components/home/HomeScene';

/**
 * The homepage's Instagram band. Same posts, same rail — the drag, swipe and
 * drift all belong to `InstagramRail`, which is used as it stands — under a
 * new head: the handle set as the headline, the follow action beside it.
 *
 * Keeps the `iglane` class so the Media tab's section settings still land.
 */
export async function HomeInstagram() {
  const posts = await fetchInstagramPosts(24);

  return (
    <HomeScene className={`iglane hm-ig ${homeFonts}`} aria-labelledby="ig-heading">
      <div className="hm-wrap hm-ig__head">
        <div className="hm-ig__titles">
          <div className="hm-mask">
            <p className="hm-eyebrow" data-hm-rise>Community</p>
          </div>
          <h2 id="ig-heading" className="hm-ig__title">
            <a href={INSTAGRAM_URL} rel="me noreferrer" target="_blank" className="hm-ig__handle" data-hm-widen>
              <span className="hm-ig__at">@</span>
              {INSTAGRAM_HANDLE}
            </a>
          </h2>
        </div>

        <div className="hm-ig__aside" data-hm-fade>
          <p className="hm-ig__note">
            {posts.length ? 'Drag the rail — tap a post to open it on Instagram' : 'Follow along'}
          </p>
          <HomePill href={INSTAGRAM_URL} tone="outline" external>Follow on Instagram</HomePill>
        </div>
      </div>

      {posts.length ? (
        <div className="hm-ig__rail" data-hm-fade data-hm-delay="0.15">
          <InstagramRail posts={posts} />
        </div>
      ) : (
        <div className="hm-wrap">
          <p className="hm-ig__empty" data-hm-fade>
            New drops, fit pictures and the odd studio day, posted at @{INSTAGRAM_HANDLE}.
          </p>
        </div>
      )}
    </HomeScene>
  );
}
