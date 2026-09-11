/**
 * The admin icon set.
 *
 * Drawn here rather than pulled from a library, and drawn to one specification:
 * a 20-unit box, 1.5 stroke, round caps and joins, no fills, no two-tone. That
 * consistency is most of what makes a rail of eleven glyphs read as a set
 * instead of a collection.
 *
 * They inherit `currentColor` and take their size from CSS, so the same glyph
 * serves the dark rail and a light button without a variant.
 */
type IconProps = { className?: string };

function base(className?: string) {
  return {
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    className,
  };
}

/** Dashboard: an asymmetric pane split, matching the dashboard's own layout. */
export function DashboardIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="2.75" y="2.75" width="6" height="6" rx="1.5" />
      <rect x="11.25" y="2.75" width="6" height="9.5" rx="1.5" />
      <rect x="2.75" y="11.25" width="6" height="6" rx="1.5" />
      <path d="M11.25 15.25h6" />
    </svg>
  );
}

/** Orders: a parcel. */
export function OrdersIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M10 2.6 17 6v8l-7 3.4L3 14V6l7-3.4Z" />
      <path d="M3 6l7 3.4L17 6" />
      <path d="M10 9.4v8" />
    </svg>
  );
}

/** Products: a tee, because this store sells one thing. */
export function ProductsIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M7.4 3 4 4.9l1.4 3 1.4-.8v9.4h6.4V7.1l1.4.8 1.4-3L12.6 3a2.7 2.7 0 0 1-5.2 0Z" />
    </svg>
  );
}

/** Wholesale: a folded line sheet — the document a trade buyer reads. */
export function WholesaleIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="4.25" y="2.75" width="11.5" height="14.5" rx="1.5" />
      <path d="M7 6.5h6" />
      <path d="M7 10h6" />
      <path d="M7 13.5h3.5" />
    </svg>
  );
}

/** Inventory: stacked shelves. */
export function InventoryIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="2.75" y="3.25" width="14.5" height="5" rx="1.5" />
      <rect x="2.75" y="11.75" width="14.5" height="5" rx="1.5" />
      <path d="M6.5 5.75h2M6.5 14.25h2" />
    </svg>
  );
}

/** Customers: two figures. */
export function CustomersIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="8" cy="7" r="2.75" />
      <path d="M2.75 16.5c.7-2.6 2.7-4 5.25-4s4.55 1.4 5.25 4" />
      <path d="M13.5 4.6a2.75 2.75 0 0 1 0 5.3" />
      <path d="M15.4 12.9c1 .7 1.7 1.9 2 3.6" />
    </svg>
  );
}

/** Categories: a set of labelled groups. */
export function CategoriesIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M2.75 5.5A1.75 1.75 0 0 1 4.5 3.75h3l1.6 2h6.4A1.75 1.75 0 0 1 17.25 7.5v7a1.75 1.75 0 0 1-1.75 1.75h-11A1.75 1.75 0 0 1 2.75 14.5Z" />
      <path d="M2.75 9.25h14.5" />
    </svg>
  );
}

/** Discounts: a tag with its eyelet. */
export function DiscountsIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M9.6 2.75H16a1.25 1.25 0 0 1 1.25 1.25v6.4a1.5 1.5 0 0 1-.44 1.06l-5.6 5.6a1.5 1.5 0 0 1-2.12 0l-5.4-5.4a1.5 1.5 0 0 1 0-2.12l5.6-5.6a1.5 1.5 0 0 1 1.06-.44Z" />
      <circle cx="13.4" cy="6.6" r="1.1" />
    </svg>
  );
}

/** Shipping: a van. */
export function ShippingIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M2.75 5.75A1 1 0 0 1 3.75 4.75h7v9.5h-8Z" />
      <path d="M10.75 8.25h3.1l3.4 3v3h-6.5Z" />
      <circle cx="6.25" cy="14.25" r="1.6" />
      <circle cx="14" cy="14.25" r="1.6" />
    </svg>
  );
}

/** Payments: a card. */
export function PaymentsIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="2.75" y="4.75" width="14.5" height="10.5" rx="2" />
      <path d="M2.75 8.5h14.5" />
      <path d="M5.75 12.5h2.5" />
    </svg>
  );
}

/** Settings: a slider bank, not the overused cog. */
export function SettingsIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3.25 6.25h13.5M3.25 13.75h13.5" />
      <circle cx="7.75" cy="6.25" r="1.9" />
      <circle cx="12.75" cy="13.75" r="1.9" />
    </svg>
  );
}

/** Media: a picture — a frame with a horizon and a sun. */
/** Words on a page: a sheet with lines of type on it. Distinct from
 *  MediaIcon so "the writing" and "the photography" never read as one tab. */
export function ContentIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="4" y="3" width="12" height="14" rx="1.5" />
      <path d="M6.75 7h6.5M6.75 10h6.5M6.75 13h4" />
    </svg>
  );
}

export function MediaIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="4.75" width="14" height="10.5" rx="1.5" />
      <circle cx="7.75" cy="8.5" r="1.25" />
      <path d="M3.5 13.25 7.5 9.75l3 2.5 2.5-2 3.5 3" />
    </svg>
  );
}

/** The storefront: an awning over a doorway. Distinct from ExitIcon so
 *  "view the shop" and "leave the session" never read as the same act. */
export function StorefrontIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3.25 7.25h13.5l-1 2a2.1 2.1 0 0 1-3.75 0 2.1 2.1 0 0 1-3.75 0 2.1 2.1 0 0 1-3.75 0Z" />
      <path d="M3.25 7.25 4.5 4.25h11l1.25 3" />
      <path d="M4.75 10.75v5.5h10.5v-5.5" />
      <path d="M8.5 16.25v-3.5h3v3.5" />
    </svg>
  );
}

/** Signing out: out through the door. */
export function ExitIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M8.25 3.75H5a1.25 1.25 0 0 0-1.25 1.25v10A1.25 1.25 0 0 0 5 16.25h3.25" />
      <path d="M12 6.5 15.5 10 12 13.5" />
      <path d="M15.5 10h-8" />
    </svg>
  );
}

/* --------------------------------------------------------------------------
   The three widths

   Drawn as one family: the same rounded screen at three proportions, so the
   row reads as one control rather than three unrelated objects. The laptop
   carries a base line, which is the only thing that tells it from the tablet
   at 20 units.
   -------------------------------------------------------------------------- */

export function LaptopIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="4.5" width="14" height="9" rx="1.5" />
      <path d="M1.75 16.25h16.5" />
    </svg>
  );
}

export function TabletIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="5" y="2.75" width="10" height="14.5" rx="1.75" />
      <path d="M8.75 14.75h2.5" />
    </svg>
  );
}

export function PhoneIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="6.5" y="2.75" width="7" height="14.5" rx="1.75" />
      <path d="M9 14.75h2" />
    </svg>
  );
}
