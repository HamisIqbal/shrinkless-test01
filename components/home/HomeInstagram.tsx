import { InstagramRail } from '@/components/site/InstagramRail';
import { INSTAGRAM_URL, fetchInstagramPosts } from '@/lib/brand/instagram';
import { homeFonts } from '@/components/home/fonts';
import { HomeScene } from '@/components/home/HomeScene';

/**
 * The homepage's Instagram band. Same posts, same rail — the drag, swipe and
 * drift all belong to `InstagramRail`, which is used as it stands — under a
 * head that is now one line: Follow us on Instagram, bold and centred, and
 * nothing else. No handle, no eyebrow, no instruction and no second button;
 * the whole line is the link.
 *
 * Keeps the `iglane` class so the Media tab's section settings still land.
 */
export async function HomeInstagram() {
  const posts = await fetchInstagramPosts(24);

  return (
    <HomeScene className={`iglane hm-ig ${homeFonts}`} aria-labelledby="ig-heading">
      <div className="hm-wrap hm-ig__head">
        <h2 id="ig-heading" className="hm-ig__title">
          <a
            href={INSTAGRAM_URL}
            rel="me noreferrer"
            target="_blank"
            className="hm-ig__follow"
            data-hm-fade
          >
            Follow us on Instagram
          </a>
        </h2>
      </div>

      {posts.length ? (
        <div className="hm-ig__rail" data-hm-fade data-hm-delay="0.15">
          <InstagramRail posts={posts} />
        </div>
      ) : null}
    </HomeScene>
  );
}
