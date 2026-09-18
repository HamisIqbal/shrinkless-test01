import { homeFonts } from '@/components/home/fonts';
import { HomeScene } from '@/components/home/HomeScene';
import './pages.css';

/**
 * A row of short facts, ruled like a care label.
 *
 * The cheapest section in the vocabulary — no photographs, no measurement —
 * and the one that carries the small-print voice onto pages that would
 * otherwise only have headings and running copy.
 */
export function SpecStrip({ items, label }: { items: string[]; label: string }) {
  return (
    <HomeScene className={`pg-spec ${homeFonts}`} aria-label={label}>
      <ul className="hm-wrap pg-spec__row">
        {items.map((item, index) => (
          <li key={item} className="pg-spec__item" data-hm-fade data-hm-delay={`${index * 0.08}`}>
            {item}
          </li>
        ))}
      </ul>
    </HomeScene>
  );
}
