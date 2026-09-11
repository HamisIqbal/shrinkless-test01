'use client';

import { useEffect } from 'react';
import { sectionRules, type SectionSetting } from '@/lib/media/colours';
import type { MediaLayerFrame, MediaLayerSection } from '@/lib/services/site-media';

/** What the admin's editor sends in, and what goes back. Same-origin messages,
 *  stamped so a stray postMessage from anything else is ignored. */
const CHANNEL = 'shrinkless-media';

export type MediaLayerProps = {
  /** Which page this is, so the editor knows what it opened. */
  page: string;
  /** The section heights and grounds saved for this page, already built by
   *  the server. */
  css: string;
  frames: MediaLayerFrame[];
  sections: MediaLayerSection[];
};

/** One photograph as the editor is holding it while nothing is published. */
type FrameDraft = { url: string; alt: string; focus: string; zoom: number };

/**
 * The address an image is really loading from.
 *
 * The site runs with Next's optimizer off, so `src` is the address the page
 * was given and the first branch is the one that fires. The second is there so
 * the editor still finds its frames if the optimizer is ever turned back on,
 * rather than silently offering a page with nothing on it to click.
 */
function sourceOf(image: HTMLImageElement): string {
  const src = image.getAttribute('src') ?? '';
  if (!src.includes('/_next/image')) return src;

  try {
    return decodeURIComponent(new URL(src, window.location.origin).searchParams.get('url') ?? src);
  } catch {
    return src;
  }
}

/**
 * The storefront's side of the Media tab.
 *
 * Two jobs, and the first one runs everywhere: it serves the section heights
 * and grounds the admin has published, as a stylesheet the browser applies
 * like any other. Nothing about it is client-side — the rules are rendered by
 * the server and are in the first paint.
 *
 * The second only wakes up inside the editor: with `?mdedit=1` and a parent
 * frame, the page starts answering — it says which photographs and sections it
 * found, highlights them under the cursor, reports what was clicked, and
 * redraws itself from the drafts the editor sends while nothing is published.
 * So the preview in the Media tab is not a drawing of the page; it is the page.
 *
 * Nothing here asks the storefront's components to carry editor markup: a
 * photograph is found by the address it was rendered from, and a section by
 * the class the layout already gives it.
 */
export function MediaLayer({ page, css, frames, sections }: MediaLayerProps) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mdedit') !== '1' || window.parent === window) return;

    const doc = document;

    const preview = doc.createElement('style');
    preview.dataset.mediaEditor = 'preview';
    doc.head.append(preview);

    const chrome = doc.createElement('style');
    chrome.dataset.mediaEditor = 'chrome';
    chrome.textContent = `
      [data-mk] { cursor: pointer; }
      [data-mk].mk-hover { outline: 3px solid #2f6fed; outline-offset: -3px; }
      [data-mk].mk-on { outline: 3px solid #efff65; outline-offset: -3px; }
      [data-msec].msec-hover { outline: 2px dashed rgba(47,111,237,0.75); outline-offset: -2px; }
      [data-msec].msec-on { outline: 2px solid #2f6fed; outline-offset: -2px; }
      .mk-badge {
        position: fixed;
        z-index: 2147483647;
        pointer-events: none;
        padding: 0.25rem 0.5rem;
        border-radius: 999px;
        background: #171919;
        color: #fff;
        font: 500 11px/1 ui-sans-serif, system-ui, sans-serif;
        letter-spacing: 0.04em;
        white-space: nowrap;
        opacity: 0;
        transition: opacity 90ms linear;
      }
      .mk-badge--on { opacity: 1; }
    `;
    doc.head.append(chrome);

    const badge = doc.createElement('div');
    badge.className = 'mk-badge';
    doc.body.append(badge);

    /* Every element showing a frame, by key. A photograph used twice on one
       page — the story tile and the lookbook tile are cut from one frame — is
       one key standing in two places, exactly as the storefront renders it. */
    const byKey = new Map<string, HTMLElement[]>();
    const images = [...doc.images];

    for (const frame of frames) {
      /* An element already claimed is left alone. Two slots can hold the same
         photograph — a category with no art of its own reads the stand-in —
         and the first one named on the page is the one that owns the element,
         rather than the two of them overwriting each other. */
      const hits = images.filter(
        (image) => !image.dataset.mk && sourceOf(image) === frame.url,
      );
      if (!hits.length) continue;

      for (const hit of hits) {
        hit.dataset.mk = frame.key;
        hit.dataset.mkLabel = frame.label;
      }

      byKey.set(frame.key, hits);
    }

    const sectionNodes = new Map<string, HTMLElement>();

    for (const section of sections) {
      const node = doc.querySelector<HTMLElement>(section.selector);
      if (!node) continue;

      node.dataset.msec = section.id;
      node.dataset.msecLabel = section.label;
      sectionNodes.set(section.id, node);
    }

    function post(message: Record<string, unknown>) {
      window.parent.postMessage({ channel: CHANNEL, page, ...message }, window.location.origin);
    }

    post({
      type: 'ready',
      frames: [...byKey.keys()],
      sections: [...sectionNodes.keys()],
    });

    /* --- What the cursor is over ----------------------------------------- */

    let hovered: HTMLElement | null = null;

    function showBadge(node: HTMLElement | null, label: string) {
      if (!node) {
        badge.classList.remove('mk-badge--on');
        return;
      }

      const box = node.getBoundingClientRect();
      badge.textContent = label;
      badge.style.left = `${Math.max(6, box.left + 8)}px`;
      badge.style.top = `${Math.max(6, box.top + 8)}px`;
      badge.classList.add('mk-badge--on');
    }

    function clearHover() {
      if (!hovered) return;
      hovered.classList.remove('mk-hover', 'msec-hover');
      hovered = null;
      showBadge(null, '');
    }

    /**
     * A photograph if the cursor is over one, otherwise the band it is in.
     *
     * Read from the whole stack under the pointer rather than from the event's
     * own target, because the storefront lays a scrim over most of its
     * photography — the hero's, the category tiles' — and the element the
     * mouse actually lands on is that scrim rather than the picture beneath
     * it. The media wins because it is the smaller target inside the larger.
     */
    function targetFor(event: MouseEvent): HTMLElement | null {
      const stack = doc.elementsFromPoint(event.clientX, event.clientY) as HTMLElement[];
      const media = stack.find((element) => element.dataset?.mk);
      if (media) return media;

      return (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-msec]') ?? null;
    }

    function onMove(event: MouseEvent) {
      const hit = targetFor(event);
      if (hit === hovered) {
        if (hit) showBadge(hit, hit.dataset.mkLabel ?? hit.dataset.msecLabel ?? '');
        return;
      }

      clearHover();
      if (!hit) return;

      hovered = hit;
      hit.classList.add(hit.dataset.mk ? 'mk-hover' : 'msec-hover');
      showBadge(hit, hit.dataset.mkLabel ?? hit.dataset.msecLabel ?? '');
    }

    /** A click in the editor picks something; it does not go shopping. */
    function onClick(event: MouseEvent) {
      const node = event.target as HTMLElement | null;

      if (node?.closest('a, button')) {
        event.preventDefault();
        event.stopPropagation();
      }

      const hit = targetFor(event);
      if (!hit) return;

      const key = hit.dataset.mk;
      select(key ? `media:${key}` : `section:${hit.dataset.msec}`);
      post({ type: 'select', id: key ? `media:${key}` : `section:${hit.dataset.msec}` });
    }

    function select(id: string | null) {
      for (const nodes of byKey.values()) {
        for (const node of nodes) node.classList.toggle('mk-on', id === `media:${node.dataset.mk}`);
      }

      for (const [sectionId, node] of sectionNodes) {
        node.classList.toggle('msec-on', id === `section:${sectionId}`);
      }
    }

    /* --- What the editor is holding --------------------------------------- */

    /**
     * Draws the drafts, so what is on screen is what the site will serve after
     * Publish.
     *
     * A crop is written to both the desktop and the phone custom properties
     * rather than only to the one the preview happens to be showing: a media
     * change made in any device view is meant to land in all of them, which is
     * the rule the editor publishes under too.
     */
    function apply(
      media: Record<string, FrameDraft>,
      settings: Record<string, SectionSetting>,
    ) {
      for (const [key, draft] of Object.entries(media)) {
        for (const node of byKey.get(key) ?? []) {
          const image = node as HTMLImageElement;

          if (draft.url && sourceOf(image) !== draft.url) {
            image.removeAttribute('srcset');
            image.src = draft.url;
          }

          // Decorative uses pass alt="" at the call site; a description typed
          // into the panel must not put words back into one of those.
          if (image.alt) image.alt = draft.alt;

          for (const property of ['--crop-pos', '--crop-pos-m']) {
            if (draft.focus) image.style.setProperty(property, draft.focus);
            else image.style.removeProperty(property);
          }

          for (const property of ['--crop-zoom', '--crop-zoom-m']) {
            if (draft.zoom > 1) image.style.setProperty(property, String(draft.zoom));
            else image.style.removeProperty(property);
          }
        }
      }

      /* Built by the same function the published stylesheet is built by, so a
         height or a ground being tried here is drawn exactly as it will be
         served — see `sectionRules`. */
      const blocks: string[] = [];

      for (const section of sections) {
        const rules = sectionRules(section.selector, settings[section.id] ?? {}, section.fixed);
        if (rules) blocks.push(rules);
      }

      preview.textContent = blocks.join('\n');
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;

      const data = event.data as { channel?: string; type?: string; [key: string]: unknown };
      if (data?.channel !== CHANNEL) return;

      if (data.type === 'apply') {
        apply(
          (data.media ?? {}) as Record<string, FrameDraft>,
          (data.sections ?? {}) as Record<string, SectionSetting>,
        );
      }

      if (data.type === 'select') select((data.id as string) ?? null);
    }

    window.addEventListener('message', onMessage);
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('mousemove', onMove, true);
    doc.addEventListener('mouseleave', clearHover, true);
    window.addEventListener('scroll', clearHover, true);

    return () => {
      window.removeEventListener('message', onMessage);
      doc.removeEventListener('click', onClick, true);
      doc.removeEventListener('mousemove', onMove, true);
      doc.removeEventListener('mouseleave', clearHover, true);
      window.removeEventListener('scroll', clearHover, true);
      preview.remove();
      chrome.remove();
      badge.remove();
    };
  }, [page, frames, sections]);

  return css ? <style data-media-layer={page} dangerouslySetInnerHTML={{ __html: css }} /> : null;
}
