import Link from 'next/link';
import { NewsletterForm } from '@/components/site/NewsletterForm';

const INSTAGRAM = 'https://www.instagram.com/shrinkless/';

type Column = { title: string; links: { href: string; label: string; external?: boolean }[] };

export function Footer({ storeEmail }: { storeEmail: string }) {
  // Help links point at the FAQ anchors that exist rather than at pages that
  // do not. A footer full of dead routes is worse than a short footer.
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
    <footer className="band band--ink colophon">
      <div className="wrap">
        <div className="colophon__signup">
          <h2 className="head">Get the good stuff.</h2>
          <NewsletterForm />
        </div>

        <div className="colophon__grid">
          <div className="colophon__brand">
            <p className="colophon__mark">Shrinkless</p>
            <p className="lede colophon__bio">
              Garment dyed organic cotton tees, cut and sewn in the United States
              and built to hold their shape wash after wash.
            </p>
          </div>

          <div className="colophon__cols">
            {columns.map((column) => (
              <nav key={column.title} className="colophon__col" aria-label={column.title}>
                <h3 className="eyebrow">{column.title}</h3>
                <ul className="colophon__links">
                  {column.links.map((link) => (
                    <li key={`${column.title}-${link.href}`}>
                      {link.external ? (
                        <a
                          href={link.href}
                          className="ulink"
                          {...(link.href.startsWith('http')
                            ? { rel: 'me noreferrer', target: '_blank' }
                            : {})}
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link href={link.href} className="ulink">{link.label}</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <p className="meta colophon__legal tnum">
          &copy; {new Date().getFullYear()} Shrinkless. Made in USA.
        </p>
      </div>
    </footer>
  );
}
