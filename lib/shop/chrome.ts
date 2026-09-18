/* --------------------------------------------------------------------------
   What the masthead should do on a given route.

   The shop layout draws one header for every page in the group and cannot know
   which page it is drawing, so the pathname decides. This replaced a component
   that asked whether the path was exactly `/`: the homepage is no longer the
   only page that opens on full-bleed media, and it is no longer the only page
   with the homepage's chrome.
   -------------------------------------------------------------------------- */

export type ChromeOptions = {
  /**
   * Whether the masthead may start transparent, in white, over the top of the
   * page. True only where the page opens on a full-bleed photograph or film:
   * anywhere else it is white type on a white page.
   */
  over: boolean;
};

/** The pages that open on media. One list, so a new one is one line here. */
const OVER_MEDIA = new Set(['/', '/our-story', '/why-shrinkless']);

export function chromeFor(pathname: string): ChromeOptions {
  // The router can hand over a trailing slash; `/our-story/` is the same page.
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  return { over: OVER_MEDIA.has(path || '/') };
}
