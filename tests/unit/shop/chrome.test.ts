import { describe, expect, it } from 'vitest';
import { chromeFor } from '@/lib/shop/chrome';

describe('chromeFor', () => {
  /* The masthead starts transparent with white type. That is only readable
     over a full-bleed photograph or film — anywhere else it is white on white. */
  it('lets the masthead start transparent on the pages that open on media', () => {
    expect(chromeFor('/').over).toBe(true);
    expect(chromeFor('/our-story').over).toBe(true);
    expect(chromeFor('/why-shrinkless').over).toBe(true);
  });

  it('keeps the masthead on paper everywhere else', () => {
    for (const path of ['/shop', '/shop/men', '/shop/women', '/wholesale', '/cart', '/checkout', '/faq']) {
      expect(chromeFor(path).over).toBe(false);
    }
  });

  it('is not fooled by a trailing slash or a query the router leaves on', () => {
    expect(chromeFor('/our-story/').over).toBe(true);
    expect(chromeFor('/shop/men/').over).toBe(false);
  });

  /* A style's own page is not the collection's page. */
  it('treats a deeper path as its own page rather than inheriting', () => {
    expect(chromeFor('/why-shrinkless/anything').over).toBe(false);
    expect(chromeFor('/product/heavyweight-tee').over).toBe(false);
  });
});
