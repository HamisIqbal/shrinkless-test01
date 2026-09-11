/**
 * Line icons, drawn to one spec: 20x20 box, 1.25 stroke, round caps, no fill.
 *
 * Inline SVG rather than an icon font or a package — there are five of them,
 * they inherit `currentColor`, and shipping a dependency to draw five paths
 * would cost more than the paths do.
 */

type IconProps = { className?: string };

const base = {
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.25,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="8.75" cy="8.75" r="5.25" />
      <path d="M12.6 12.6 16.5 16.5" />
    </svg>
  );
}

export function AccountIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="10" cy="6.75" r="3.25" />
      <path d="M3.75 16.5c0-2.9 2.8-4.75 6.25-4.75s6.25 1.85 6.25 4.75" />
    </svg>
  );
}

export function CartIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4.25 6.25h11.5l-1 9.5a1 1 0 0 1-1 .9H6.25a1 1 0 0 1-1-.9z" />
      <path d="M7.25 8.25v-2a2.75 2.75 0 0 1 5.5 0v2" />
    </svg>
  );
}

export function ArrowIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 10h12" />
      <path d="M11.25 5.25 16 10l-4.75 4.75" />
    </svg>
  );
}

export function EyeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M1.75 10S4.75 4.75 10 4.75 18.25 10 18.25 10 15.25 15.25 10 15.25 1.75 10 1.75 10Z" />
      <circle cx="10" cy="10" r="2.5" />
    </svg>
  );
}

/* Filled, unlike the rest of the set. A rating is a mark rather than a
   control, and a hairline outline star at 11px reads as noise. */
export function StarIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      stroke="none"
      aria-hidden
      focusable={false}
      className={className}
    >
      <path d="M10 2.5l2.32 4.7 5.18.76-3.75 3.65.885 5.16L10 14.33l-4.635 2.44.885-5.16L2.5 7.96l5.18-.76z" />
    </svg>
  );
}

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="3.5" width="13" height="13" rx="3.75" />
      <circle cx="10" cy="10" r="3.25" />
      <circle cx="13.9" cy="6.1" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}
