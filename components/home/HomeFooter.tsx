import Link from 'next/link';
import { NewsletterForm } from '@/components/site/NewsletterForm';
import { homeFonts } from '@/components/home/fonts';
import { HomeFooterMark, BackToTop } from '@/components/home/HomeFooterMotion';

const INSTAGRAM = 'https://www.instagram.com/shrinkless/';

type Column = { title: string; links: { href: string; label: string; external?: boolean }[] };

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
 * The homepage colophon. Same destinations, same signup and the same words as
 * the shop footer, rebuilt as an ink page of its own: the signup as the
 * headline, the link columns as a quiet index, and the wordmark set edge to
 * edge along the foot, widening into place as the page lifts off it.
 */
export function HomeFooter({ storeEmail }: { storeEmail: string }) {
  const columns: Column[] = [
    {
      title: 'Shop',
      links: [
        { href: '/shop', label: 'All Products' },
        { href: '/shop/men', label: 'Men' },
        { href: '/shop/women', label: 'Women' },
        { href: '/shop?sort=newest', label: 'New Arrivals' },
      ],
    },
    {
      title: 'About',
      links: [
        { href: '/our-story', label: 'Our Story' },
        { href: '/why-shrinkless', label: 'Why Shrinkless' },
      ],
    },
    {
      title: 'Help',
      links: [
        { href: '/faq', label: 'FAQ' },
        { href: `mailto:${storeEmail}`, label: 'Contact', external: true },
      ],
    },
    {
      title: 'Follow',
      links: [{ href: INSTAGRAM, label: 'Instagram', external: true }],
    },
  ];

  return (
    <footer className={`hm-foot ${homeFonts}`}>
      <div className="hm-foot__wrap">
        <div className="hm-foot__top">
          <h2 className="hm-foot__head">
            <span className="hm-foot__serif">Get the</span> good stuff.
          </h2>

          <div className="hm-foot__signup">
            <p className="hm-foot__label">Restocks, new releases and Shrinkless news.</p>
            <NewsletterForm />
          </div>
        </div>

        <div className="hm-foot__index">
          <div className="hm-foot__brand">
            <p className="hm-foot__label">Made in USA</p>
            <p className="hm-foot__bio">
              Garment dyed organic cotton tees, cut and sewn in the United States
              and built to hold their shape wash after wash.
            </p>
          </div>

          {columns.map((column) => (
            <nav key={column.title} className="hm-foot__col" aria-label={column.title}>
              <h3 className="hm-foot__label">{column.title}</h3>
              <ul className="hm-foot__links">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.href}`}>
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
            </nav>
          ))}
        </div>

        <HomeFooterMark />

        <div className="hm-foot__base">
          <p className="tnum">&copy; {new Date().getFullYear()} Shrinkless. Made in USA.</p>
          <BackToTop />
        </div>
      </div>
    </footer>
  );
}
