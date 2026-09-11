import { Reveal } from '@/components/ui/Reveal';

export type Quote = {
  text: string;
  name: string;
};

type Props = {
  eyebrow?: string;
  heading?: string;
  quotes: Quote[];
};

/**
 * Three quotes on an ink band.
 *
 * The previous version set an oversized serif quotation mark behind each quote,
 * which collided with the text at every width that mattered — a decoration
 * fighting the thing it was decorating. There is no mark now: the band's
 * contrast, a hairline and a numbered attribution do the same job without
 * anything overlapping anything.
 *
 * Placeholder copy until real reviews exist (spec §11.3).
 */
export function QuoteRow({ eyebrow, heading, quotes }: Props) {
  return (
    <section className="band band--ink quotes" aria-labelledby="quotes-heading">
      <div className="wrap">
        <Reveal>
          <div className="quotes__head">
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 id="quotes-heading" className="head quotes__title">
              {heading ?? 'What people say'}
            </h2>
          </div>
        </Reveal>

        <ul className="quotes__row">
          {quotes.map((quote, index) => (
            <li key={`${quote.name}-${index}`} className="quotes__item">
              <Reveal index={index}>
                <figure className="quotes__figure">
                  <p className="quotes__index tnum" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </p>
                  <blockquote className="quotes__text">{quote.text}</blockquote>
                  <figcaption className="meta quotes__name">{quote.name}</figcaption>
                </figure>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
