'use client';

import { useEffect, useRef } from 'react';
import {
  MOBILE_MAX,
  WIDE_MIN,
  styleDeclarations,
  type ContentLayerField,
  type ContentStyleSet,
} from '@/lib/content/style';

/** What the admin panel sends in, and what goes back. Same-origin messages,
 *  stamped so a stray postMessage from anything else is ignored. */
const CHANNEL = 'shrinkless-content';

export type ContentLayerProps = {
  /** Which page this is, so the editor knows what it opened. */
  page: string;
  /** The rules saved for this page's fields, already built by the server. */
  css: string;
  fields: ContentLayerField[];
};

type Draft = { value: string; style: ContentStyleSet };

/** Whitespace is a rendering detail; two spaces in the source and one on the
 *  page are the same sentence. */
function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * A selector for one element, built out of what the page already gives it.
 *
 * Classes first, position among its own kind only where it is needed, and no
 * deeper than it has to go to be the only thing it matches. Nothing is
 * invented: the storefront's markup is not touched to make this work, which is
 * what lets the editor run over pages that know nothing about it.
 */
function selectorFor(element: Element): string | undefined {
  const parts: string[] = [];
  let node: Element | null = element;

  while (node && node !== document.body && parts.length < 8) {
    const classes = [...node.classList]
      .filter((name) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name))
      .slice(0, 3);

    let part = node.tagName.toLowerCase() + classes.map((name) => `.${name}`).join('');

    const parent: HTMLElement | null = node.parentElement;

    if (parent) {
      const kin = [...parent.children].filter((child) => child.tagName === node!.tagName);
      if (kin.length > 1) part += `:nth-of-type(${kin.indexOf(node) + 1})`;
    }

    parts.unshift(part);

    const selector = parts.join(' > ');
    const found = document.querySelectorAll(selector);
    if (found.length === 1 && found[0] === element) return selector;

    node = parent;
  }

  const selector = parts.join(' > ');
  return selector && document.querySelector(selector) === element ? selector : undefined;
}

/**
 * Which element on the page is showing a given field.
 *
 * By the words themselves: the storefront renders the copy this component was
 * handed, so the deepest element whose text is exactly that string is the one
 * that field controls. Matching on text rather than on markers is what keeps
 * every page free of editor scaffolding — and the deepest match is the right
 * one, because every ancestor also contains the sentence.
 */
function resolve(fields: ContentLayerField[]): Map<string, HTMLElement> {
  const found = new Map<string, HTMLElement>();
  const taken = new Set<HTMLElement>();

  const candidates = [...document.body.querySelectorAll<HTMLElement>('*')].filter(
    (element) => !element.closest('[data-content-editor]'),
  );

  for (const field of fields) {
    const wanted = normalise(field.value);
    if (!wanted) continue;

    let best: HTMLElement | undefined;

    for (const element of candidates) {
      if (taken.has(element)) continue;
      if (normalise(element.textContent ?? '') !== wanted) continue;
      // Deeper beats shallower: an ancestor holding only this sentence is
      // still holding the sentence, but the element setting it is the last one.
      if (!best || best.contains(element)) best = element;
    }

    if (!best) continue;

    taken.add(best);
    best.dataset.ck = field.key;
    found.set(field.key, best);
  }

  return found;
}

/**
 * The storefront's side of the Content tab.
 *
 * Two jobs, and the first one runs everywhere: it serves the type settings the
 * admin has saved for this page, as a stylesheet the browser applies like any
 * other. Nothing about it is client-side — the rules are rendered by the
 * server and are in the first paint.
 *
 * The second job only wakes up inside the admin's editor: with `?ckedit=1` and
 * a parent frame, the page starts answering — it says which fields it found
 * and where, highlights them under the cursor, reports what was clicked, and
 * redraws itself from the drafts the panel sends while nothing is saved. So
 * the preview in the Content tab is not a drawing of the page; it is the page.
 */
export function ContentLayer({ page, css, fields }: ContentLayerProps) {
  const elements = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('ckedit') !== '1' || window.parent === window) return;

    const doc = document;
    const preview = doc.createElement('style');
    preview.dataset.contentEditor = 'preview';
    doc.head.append(preview);

    const chrome = doc.createElement('style');
    chrome.dataset.contentEditor = 'chrome';
    chrome.textContent = `
      [data-ck] { cursor: pointer; }
      [data-ck]:hover { outline: 2px dashed rgba(0,0,0,0.35); outline-offset: 3px; }
      [data-ck].ck-selected { outline: 2px solid #2f6fed; outline-offset: 3px; }
      [data-ck]::selection { background: rgba(47,111,237,0.25); }
    `;
    doc.head.append(chrome);

    elements.current = resolve(fields);

    function post(message: Record<string, unknown>) {
      window.parent.postMessage({ channel: CHANNEL, page, ...message }, window.location.origin);
    }

    const selectors: Record<string, string> = {};
    for (const [key, element] of elements.current) {
      const selector = selectorFor(element);
      if (selector) selectors[key] = selector;
    }

    post({ type: 'ready', keys: [...elements.current.keys()], selectors });

    /** Draws the drafts the panel is holding: the words as typed, and the
     *  settings as a stylesheet keyed the same way the saved one is, so what
     *  is on screen now is what the site will serve after Save. */
    function apply(drafts: Record<string, Draft>) {
      const blocks: string[] = [];

      for (const [key, draft] of Object.entries(drafts)) {
        const element = elements.current.get(key);
        if (element && normalise(element.textContent ?? '') !== normalise(draft.value)) {
          element.textContent = draft.value;
        }

        const wide = styleDeclarations(draft.style?.desktop);
        const narrow = styleDeclarations(draft.style?.mobile);
        const target = `[data-ck="${key}"]`;

        if (wide) blocks.push(`@media (min-width: ${WIDE_MIN}) { ${target} { ${wide} } }`);
        if (narrow) blocks.push(`@media (max-width: ${MOBILE_MAX}) { ${target} { ${narrow} } }`);
      }

      preview.textContent = blocks.join('\n');
    }

    function select(key: string | null) {
      for (const [candidate, element] of elements.current) {
        element.classList.toggle('ck-selected', candidate === key);
      }
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;

      const data = event.data as {
        channel?: string;
        type?: string;
        [key: string]: unknown;
      };
      if (data?.channel !== CHANNEL) return;

      if (data.type === 'apply') apply((data.drafts ?? {}) as Record<string, Draft>);
      if (data.type === 'select') select((data.key as string) ?? null);
    }

    /** A click in the editor picks a line; it does not go shopping. Links and
     *  buttons are stopped, everything else — opening an answer, say — is left
     *  alone so the page still works while it is being edited. */
    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const hit = target?.closest<HTMLElement>('[data-ck]');

      if (target?.closest('a, button')) {
        event.preventDefault();
        event.stopPropagation();
      }

      if (!hit?.dataset.ck) return;

      select(hit.dataset.ck);
      post({ type: 'select', key: hit.dataset.ck });
    }

    window.addEventListener('message', onMessage);
    doc.addEventListener('click', onClick, true);

    return () => {
      window.removeEventListener('message', onMessage);
      doc.removeEventListener('click', onClick, true);
      preview.remove();
      chrome.remove();
    };
  }, [page, fields]);

  return css ? <style data-content-layer={page} dangerouslySetInnerHTML={{ __html: css }} /> : null;
}
