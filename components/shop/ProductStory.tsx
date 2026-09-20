import { parseStory } from '@/lib/shop/story';
import './shop.css';

/**
 * The description, directly under the price: a paragraph on what the tee is, a
 * list of the things a shopper checks before buying one, and a short line to
 * close. Set small — this is the copy you read after the picture has already
 * done the work, so it wants to be dense and quiet rather than loud.
 */
export function ProductStory({ description }: { description?: string }) {
  const blocks = parseStory(description);
  if (!blocks.length) return null;

  return (
    <div className="sh-story">
      {blocks.map((block, index) =>
        block.kind === 'paragraph' ? (
          <p key={index} className="sh-story__para">{block.text}</p>
        ) : (
          <ul key={index} className="sh-story__list">
            {block.items.map((item) => (
              <li key={item} className="sh-story__item">{item}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
