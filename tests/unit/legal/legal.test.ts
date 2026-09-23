import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEGAL_PAGES, POLICIES_EFFECTIVE } from '@/lib/legal/pages';
import { POLICY_TEXT } from '@/lib/legal/policy-text';
import { fillLine, fillParagraphs, policyTokens } from '@/lib/legal/tokens';
import {
  CONTENT_KEYS,
  LONG_MAX,
  POLICY_CLAUSES,
  SHORT_MAX,
  defaultContent,
  hasPlaceholder,
} from '@/lib/services/site-content';

/*
 * The guarantees the legal audit of 2026-09-24 put in place. If one of these
 * fails, the change that broke it is putting something in front of customers
 * that the business could be held to — read docs/compliance.md first.
 */

const SHOP = join(process.cwd(), 'app', '(shop)', '(instagram-last)');
const FOOTER = readFileSync(join(process.cwd(), 'components/home/HomeFooter.tsx'), 'utf8');

describe('legal pages', () => {
  it.each(LEGAL_PAGES.map((page) => [page.href]))('%s has a route', (href) => {
    expect(existsSync(join(SHOP, href.slice(1), 'page.tsx'))).toBe(true);
  });

  it('are all linked from the footer, through the shared list', () => {
    expect(FOOTER).toContain('LEGAL_PAGES');
  });

  it('each have wording, and the clause counts follow it', () => {
    for (const page of LEGAL_PAGES) {
      expect(POLICY_TEXT[page.id].clauses.length).toBeGreaterThan(0);
      expect(POLICY_CLAUSES[page.id]).toBe(POLICY_TEXT[page.id].clauses.length);
    }
  });

  it('carry a real effective date', () => {
    expect(Number.isNaN(new Date(POLICIES_EFFECTIVE).getTime())).toBe(false);
  });

  it('fit the lengths the Content tab will accept, so they stay editable', () => {
    for (const page of LEGAL_PAGES) {
      for (const clause of POLICY_TEXT[page.id].clauses) {
        expect(clause.heading.length).toBeLessThanOrEqual(SHORT_MAX);
        expect(clause.body.length).toBeLessThanOrEqual(LONG_MAX);
      }
    }
  });

  it('only use tokens the renderer knows how to fill', () => {
    const known = Object.keys(
      policyTokens({ legalName: '', address: '', phone: '', governingState: '', email: '' }),
    );

    for (const page of LEGAL_PAGES) {
      const text = JSON.stringify(POLICY_TEXT[page.id]);
      for (const match of text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
        expect(known).toContain(match[1]);
      }
    }
  });
});

describe('shipped copy', () => {
  it('contains no placeholder anywhere a customer can see it', () => {
    const offenders = CONTENT_KEYS.filter((key) => hasPlaceholder(defaultContent(key)));
    expect(offenders).toEqual([]);
  });

  it('makes no unsubstantiated origin or organic claim by default', () => {
    // Put back only once the owner can document them — see docs/compliance.md.
    const offenders = CONTENT_KEYS.filter((key) =>
      /made in (the )?usa|made in the united states|organic/i.test(defaultContent(key)),
    );
    expect(offenders).toEqual([]);
  });

  it('ships no testimonials: the reviews band starts empty', () => {
    for (const n of [1, 2, 3]) {
      expect(defaultContent(`home.reviews.${n}.text`)).toBe('');
      expect(defaultContent(`home.reviews.${n}.name`)).toBe('');
    }
  });
});

describe('policy tokens', () => {
  const tokens = policyTokens({
    legalName: '',
    address: '',
    phone: '555-0100',
    governingState: 'Texas',
    email: 'orders@example.com',
  });

  it('falls back to the brand when no legal name is set', () => {
    expect(fillLine('Run by {{legalName}}.', tokens)).toBe('Run by Shrinkless.');
  });

  it('drops a paragraph whose detail is blank rather than printing a gap', () => {
    const out = fillParagraphs(
      'Write to {{email}}.\n\nOur address is {{address}}.\n\nLaw of {{state}}.',
      tokens,
    );
    expect(out).toEqual(['Write to orders@example.com.', 'Law of Texas.']);
  });
});

describe('placeholder detection', () => {
  it.each(['[TBC]', '[ tbc ]', '[TBD] days', '[TODO]', 'Lorem ipsum'])('catches %s', (text) => {
    expect(hasPlaceholder(text)).toBe(true);
  });

  it('leaves ordinary copy alone', () => {
    expect(hasPlaceholder('Returns within 30 days [of delivery].')).toBe(false);
  });
});
