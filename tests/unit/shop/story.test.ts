import { describe, expect, it } from 'vitest';
import { parseStory } from '@/lib/shop/story';

describe('parseStory', () => {
  it('returns nothing for empty copy', () => {
    expect(parseStory(undefined)).toEqual([]);
    expect(parseStory('')).toEqual([]);
    expect(parseStory('   \n  \n')).toEqual([]);
  });

  it('reads a lone paragraph', () => {
    expect(parseStory('A tee.')).toEqual([{ kind: 'paragraph', text: 'A tee.' }]);
  });

  it('joins wrapped lines into one paragraph', () => {
    expect(parseStory('A tee\nthat fits.')).toEqual([
      { kind: 'paragraph', text: 'A tee that fits.' },
    ]);
  });

  it('reads paragraph, list, paragraph in the order written', () => {
    const blocks = parseStory(
      ['Lead copy.', '', '- One', '- Two', '', 'Closing copy.'].join('\n'),
    );

    expect(blocks).toEqual([
      { kind: 'paragraph', text: 'Lead copy.' },
      { kind: 'list', items: ['One', 'Two'] },
      { kind: 'paragraph', text: 'Closing copy.' },
    ]);
  });

  it('takes any of the three bullet marks', () => {
    expect(parseStory('- One\n* Two\n• Three')).toEqual([
      { kind: 'list', items: ['One', 'Two', 'Three'] },
    ]);
  });

  it('starts a list without needing a blank line before it', () => {
    expect(parseStory('Lead.\n- One')).toEqual([
      { kind: 'paragraph', text: 'Lead.' },
      { kind: 'list', items: ['One'] },
    ]);
  });

  it('ends a list when prose resumes', () => {
    expect(parseStory('- One\nClosing.')).toEqual([
      { kind: 'list', items: ['One'] },
      { kind: 'paragraph', text: 'Closing.' },
    ]);
  });
});
