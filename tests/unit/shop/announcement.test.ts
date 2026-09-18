import { describe, expect, it } from 'vitest';
import {
  ANNOUNCE_COOKIE,
  ANNOUNCE_MAX_AGE,
  announcementTag,
  isDismissed,
  resolveAnnouncement,
} from '@/lib/shop/announcement';

describe('resolveAnnouncement', () => {
  it('uses the store\'s message when there is one', () => {
    expect(resolveAnnouncement('  Free shipping over $100  ')).toBe('Free shipping over $100');
  });

  it('falls back to the placeholder when the store has set nothing', () => {
    expect(resolveAnnouncement(undefined)).toBe(resolveAnnouncement(''));
    expect(resolveAnnouncement('   ')).toBe(resolveAnnouncement(undefined));
    expect(resolveAnnouncement(undefined).length).toBeGreaterThan(0);
  });
});

describe('announcementTag', () => {
  it('is stable for the same message', () => {
    expect(announcementTag('Restocked: the heavyweight tee')).toBe(
      announcementTag('Restocked: the heavyweight tee'),
    );
  });

  it('differs when the message differs', () => {
    expect(announcementTag('One')).not.toBe(announcementTag('Two'));
  });

  it('is short enough and safe enough to be a cookie value', () => {
    const tag = announcementTag('Free shipping over $100 — this week only');
    expect(tag).toMatch(/^[a-z0-9]{1,13}$/);
  });
});

describe('isDismissed', () => {
  it('shows the bar when no cookie has been set', () => {
    expect(isDismissed('Free shipping', undefined)).toBe(false);
  });

  it('hides the bar when the cookie matches this message', () => {
    const message = 'Free shipping';
    expect(isDismissed(message, announcementTag(message))).toBe(true);
  });

  /* The whole reason the cookie is a hash rather than a boolean: an admin
     publishes something new and everyone who dismissed the old one sees it. */
  it('shows the bar again when the message has changed since it was dismissed', () => {
    expect(isDismissed('The new announcement', announcementTag('The old one'))).toBe(false);
  });

  it('dismisses the placeholder by the text it actually renders', () => {
    const shown = resolveAnnouncement(undefined);
    expect(isDismissed(undefined, announcementTag(shown))).toBe(true);
  });

  it('ignores a cookie holding something that is not a tag', () => {
    expect(isDismissed('Free shipping', 'true')).toBe(false);
  });
});

describe('the cookie itself', () => {
  it('is named and aged as the design says', () => {
    expect(ANNOUNCE_COOKIE).toBe('sl_announce');
    expect(ANNOUNCE_MAX_AGE).toBe(60 * 60 * 24 * 180);
  });
});
