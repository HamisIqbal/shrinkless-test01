import Link from 'next/link';
import { NewsletterForm } from '@/components/site/NewsletterForm';
import { homeFonts } from '@/components/home/fonts';
import { HomeFooterMark, BackToTop } from '@/components/home/HomeFooterMotion';

const INSTAGRAM = 'https://www.instagram.com/shrinkless/';

type Row = { title: string; links: { href: string; label: string; external?: boolean }[] };

/** Same two-copy roll as the header's utilities, for a server component. */
function Roll({ children }: { children: string }) {
  return (
    <span className="hm-roll">
      <span className="hm-roll__a">{children}</span>
      <span className="hm-roll__b" aria-hidden="true">{children}</span>
    </span>
  );
}

/**
 * The colophon, on every page of the site.
 *
 * Four stacked things and nothing else: the signup, the index, the wordmark,
 * the legal line. It used to open on a display headline and set the index as
 * five columns with a paragraph of brand copy in the first — most of a screen
 * of footer under every page.
 *
 * The index is rows now rather than columns. A column heading over three links
 * is a heading that costs more height than the links it introduces, and the
 * grouping is the only thing it was carrying — so the group name moved to the
 * left of its own row, in the mono the rest of the small print is set in, and
 * the whole index is three lines deep instead of five columns tall.
 *
 * The wordmark stays. It is the one piece of size in here and the thing the
 * page is remembered by, and it is the only place the width axis still moves.
 */
export function HomeFooter({ storeEmail }: { storeEmail: string }) {
  const rows: Row[] = [
    {
      title: 'Shop',
      links: [
        { href: '/shop', label: 'All products' },
        { href: '/shop/men', label: 'Men' },
        { href: '/shop/women', label: 'Women' },
        { href: '/shop?sort=newest', label: 'New arrivals' },
        { href: '/wholesale', label: 'Wholesale' },
      ],
    },
    {
      title: 'Brand',
      links: [
        { href: '/our-story', label: 'Our story' },
        { href: '/why-shrinkless', label: 'Why Shrinkless' },
      ],
    },
    {
      title: 'Help',
      links: [
        { href: '/faq', label: 'FAQ' },
        { href: '/account', label: 'Your account' },
        { href: `mailto:${storeEmail}`, label: 'Contact', external: true },
        { href: INSTAGRAM, label: 'Instagram', external: true },
      ],
    },
  ];

  return (
    <footer className={`hm-foot ${homeFonts}`}>
      <div className="hm-foot__wrap">
        <div className="hm-foot__signup">
          <p className="hm-foot__label">Restocks and new releases. Nothing else.</p>
          <NewsletterForm />
        </div>

        <nav className="hm-foot__index" aria-label="Footer">
          {rows.map((row) => (
            <div key={row.title} className="hm-foot__row">
              <h2 className="hm-foot__rowlabel">{row.title}</h2>
              <ul className="hm-foot__links">
                {row.links.map((link) => (
                  <li key={`${row.title}-${link.href}`}>
                    {link.external ? (
                      <a
                        href={link.href}
                        className="hm-foot__link"
                        {...(link.href.startsWith('http')
                          ? { rel: 'me noreferrer', target: '_blank' }
                          : {})}
                      >
                        <Roll>{link.label}</Roll>
                      </a>
                    ) : (
                      <Link href={link.href} className="hm-foot__link">
                        <Roll>{link.label}</Roll>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <HomeFooterMark />

        <div className="hm-foot__base">
          <p className="tnum">&copy; {new Date().getFullYear()} Shrinkless — Made in USA</p>
          <BackToTop />
        </div>
      </div>
    </footer>
  );
}
