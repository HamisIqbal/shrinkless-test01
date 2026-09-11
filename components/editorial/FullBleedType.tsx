import Link from 'next/link';
import { Reveal } from '@/components/ui/Reveal';

type Props = {
  lines: string[];
  support?: string;
  cta?: { href: string; label: string };
};

/**
 * The black band. Four hard-broken lines, one button, nothing else — the page
 * needs one moment where it stops selling and simply states the position.
 */
export function FullBleedType({ lines, support, cta }: Props) {
  return (
    <section className="band band--ink band--tall promise">
      <div className="wrap">
        <Reveal>
          <h2 className="display promise__head">
            {lines.map((line, index) => (
              <span key={line}>
                {line}
                {index < lines.length - 1 ? <br /> : null}
              </span>
            ))}
          </h2>
        </Reveal>

        {support ? (
          <Reveal index={1}>
            <p className="lede promise__support">{support}</p>
          </Reveal>
        ) : null}

        {cta ? (
          <Reveal index={2}>
            <Link href={cta.href} className="btn btn--light promise__cta">{cta.label}</Link>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}
