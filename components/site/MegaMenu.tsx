'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ShopMenu } from '@/lib/shop/navigation';

type Props = {
  menu: ShopMenu;
  open: boolean;
  id: string;
  onNavigate: () => void;
};

/**
 * The desktop shop menu: a full-width editorial panel, not a dropdown.
 *
 * It stays mounted so both directions animate, and is `inert` while closed so
 * the fifteen-odd links inside cannot be tabbed into from the collapsed state.
 * Hover and focus handling lives in the header, which owns the open state —
 * this component only draws.
 */
export function MegaMenu({ menu, open, id, onNavigate }: Props) {
  return (
    <div
      id={id}
      className={`mega${open ? ' mega--open' : ''}`}
      inert={!open}
      aria-label="Shop"
    >
      <div className="mega__inner wrap">
        <div className="mega__columns">
          {menu.columns.map((column) => (
            <nav key={column.title} className="mega__col" aria-label={column.title}>
              {column.href ? (
                <Link href={column.href} className="mega__coltitle" onClick={onNavigate}>
                  {column.title}
                </Link>
              ) : (
                <p className="mega__coltitle">{column.title}</p>
              )}

              <ul className="mega__links">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.href}-${link.label}`}>
                    <Link href={link.href} className="mega__link" onClick={onNavigate}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mega__features">
          {menu.features.map((feature) => (
            <Link
              key={feature.href}
              href={feature.href}
              className="mega__feature"
              onClick={onNavigate}
            >
              <div className="frame frame--45 mega__frame">
                <Image
                  src={feature.image.url}
                  alt={feature.image.alt}
                  fill
                  loading="lazy"
                  sizes="(min-width: 62rem) 20vw, 0px"
                />
              </div>

              <span className="mega__featurefoot">
                <span className="mega__featurelabel">{feature.label}</span>
                <span className="meta">{feature.caption}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
