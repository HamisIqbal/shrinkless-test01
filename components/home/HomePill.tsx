import Link from 'next/link';
import { ArrowIcon } from '@/components/site/icons';

type Props = {
  href: string;
  children: string;
  /** `light` on a photograph, `ghost` on ink, `outline` on paper. */
  tone?: 'light' | 'ghost' | 'outline';
  external?: boolean;
};

/**
 * The homepage's call to action: a pill with its arrow in a disc. On hover the
 * disc floods outward until it fills the pill and the label inverts — the fill
 * starts where the arrow is, so the control reads as moving in the direction
 * it sends you.
 *
 * The label is a single text node on purpose: the Content tab finds editable
 * copy by matching an element's whole text, so the words cannot be split up.
 */
export function HomePill({ href, children, tone = 'outline', external = false }: Props) {
  const className = `hm-pill hm-pill--${tone}`;

  const inner = (
    <>
      <span className="hm-pill__label">{children}</span>
      <span className="hm-pill__icon" aria-hidden="true">
        <ArrowIcon />
      </span>
    </>
  );

  return external ? (
    <a href={href} className={className} rel="me noreferrer" target="_blank">
      {inner}
    </a>
  ) : (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

/**
 * A sentence as one span per word, separated by real spaces.
 *
 * The element's text stays exactly the sentence — which is what lets the
 * Content tab still find it — while each word can rise through its own mask.
 */
export function Words({ text, className = 'hm-word' }: { text: string; className?: string }) {
  const words = text.trim().split(/\s+/);

  return (
    <>
      {words.map((word, index) => (
        <span key={index}>
          {index > 0 ? ' ' : null}
          <span className={`${className}mask`}>
            <span className={className} style={{ '--w': index } as React.CSSProperties}>
              {word}
            </span>
          </span>
        </span>
      ))}
    </>
  );
}
