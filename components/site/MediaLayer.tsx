export type MediaLayerProps = {
  /** Which page this is, so the tag says whose rules these are when somebody
   *  is reading the document. */
  page: string;
  /** The section heights and grounds saved for this page, already built by the
   *  server. */
  css: string;
};

/**
 * The layout overrides a page is serving, as a stylesheet.
 *
 * Nothing client-side and nothing to hydrate: the rules are built on the
 * server by `sectionSettingCss` and are in the first paint, so a band that has
 * been given a height or a ground is drawn that way before anything runs. They
 * are unlayered, which is what lets them outrank the storefront's own rule for
 * the same element without a specificity contest.
 *
 * This used to be the storefront's half of a visual editor as well — with
 * `?mdedit=1` the page would answer a parent frame, highlight what the cursor
 * was over and redraw itself from the admin's unpublished drafts. The Media
 * tab is a list now rather than the shop in a frame, so there is no parent to
 * answer and that half is gone. A photograph is still never asked to carry
 * editor markup; a section is still found by the class the layout already
 * gives it.
 */
export function MediaLayer({ page, css }: MediaLayerProps) {
  return css ? <style data-media-layer={page} dangerouslySetInnerHTML={{ __html: css }} /> : null;
}
