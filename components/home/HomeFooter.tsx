import Link from 'next/link';
import { NewsletterForm } from '@/components/site/NewsletterForm';
import { homeFonts } from '@/components/home/fonts';
import { BackToTop } from '@/components/home/HomeFooterMotion';

const INSTAGRAM = 'https://www.instagram.com/shrinkless/';

type Group = { title: string; links: { href: string; label: string; external?: boolean }[] };

/**
 * The footer, on every page of the site — the shop layout renders this one
 * component under every storefront route, so there is exactly one design.
 *
 * Two bands and a legal line. The top band pairs the brand and the signup on
 * the left with the index on the right: four short, headed columns that scan
 * down rather than across. The legal line closes it with the copyright and
 * the way back up.
 *
 * It stays short on purpose. On a desk it is pinned under the page
 * (components/site/FooterReveal), so all of it has to fit a laptop window.
 */
export function HomeFooter({ storeEmail }: { storeEmail: string }) {
  const groups: Group[] = [
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
        { href: INSTAGRAM, label: 'Instagram', external: true },
      ],
    },
    {
      title: 'Help',
      links: [
        { href: '/faq', label: 'FAQ' },
        { href: '/account', label: 'Your account' },
        { href: `mailto:${storeEmail}`, label: 'Contact', external: true },
      ],
    },
    {
      title: 'Policies',
      links: [
        { href: '/terms', label: 'Terms & Conditions' },
        { href: '/refund-policy', label: 'Refund Policy' },
        { href: '/shipping-returns', label: 'Shipping & Returns' },
        { href: '/privacy-policy', label: 'Privacy Policy' },
      ],
    },
  ];

  return (
    <footer className={`hm-foot ${homeFonts}`}>
      <div className="hm-foot__wrap">
        <div className="hm-foot__top">
          <div className="hm-foot__brand">
            <Link href="/" className="hm-foot__logo">
              Shrinkless
            </Link>
            <p className="hm-foot__tagline">
              Organic tees that hold their size, wash after wash.
            </p>

            <div className="hm-foot__news">
              <h2 className="hm-foot__newstitle">Join the list</h2>
              <p className="hm-foot__newscopy">Restocks and new releases. Nothing else.</p>
              <NewsletterForm />
            </div>
          </div>

          <nav className="hm-foot__index" aria-label="Footer">
            {groups.map((group) => (
              <div key={group.title} className="hm-foot__group">
                <h2 className="hm-foot__heading">{group.title}</h2>
                <ul className="hm-foot__links">
                  {group.links.map((link) => (
                    <li key={`${group.title}-${link.href}`}>
                      {link.external ? (
                        <a
                          href={link.href}
                          className="hm-foot__link"
                          {...(link.href.startsWith('http')
                            ? { rel: 'me noreferrer', target: '_blank' }
                            : {})}
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link href={link.href} className="hm-foot__link">
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="hm-foot__base">
          <p className="tnum">&copy; {new Date().getFullYear()} Shrinkless. Made in USA.</p>
          <BackToTop />
        </div>
      </div>
    </footer>
  );
}
