/**
 * Product copy is one string in the database and one field in the admin, and
 * it stays that way — a shop owner writing about a tee should not have to fill
 * in three boxes to get a paragraph, a list and a closing line.
 *
 * The convention is the one people already type: blank lines separate blocks,
 * and a line opening with `-`, `*` or a bullet is a list item. Runs of list
 * items collect into one list wherever they appear, so the order of blocks is
 * whatever was written rather than a fixed template.
 */

export type StoryBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] };

const BULLET = /^\s*[-*•]\s+/;

export function parseStory(description: string | undefined): StoryBlock[] {
  if (!description) return [];

  const blocks: StoryBlock[] = [];
  let paragraph: string[] = [];
  let items: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };

  const flushList = () => {
    if (!items.length) return;
    blocks.push({ kind: 'list', items });
    items = [];
  };

  for (const raw of description.split(/\r?\n/)) {
    const line = raw.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (BULLET.test(line)) {
      // A list interrupts a paragraph; a paragraph does not interrupt a list
      // mid-item, because a wrapped bullet is still that bullet.
      flushParagraph();
      items.push(line.replace(BULLET, '').trim());
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}
