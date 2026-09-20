'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatCents } from '@/lib/money';
import { imageUrl } from '@/lib/images';
import { toColorways } from '@/lib/shop/colorways';
import { StarIcon } from '@/components/site/icons';
import type { ProductDTO } from '@/types/dto';
import { cropStyle } from '@/lib/media/crop';
import './shop.css';

type Props = {
  product: ProductDTO;
  /** Grid position, so the first row can skip lazy loading. */
  index?: number;
  /** Omitted where there is nothing to quick-view — the trade sheet has no
   *  cart, so its cards carry no strip. */
  onQuickView?: (product: ProductDTO) => void;
  /** Where the card points, when it is not a retail product page. */
  href?: string;
  /** Replaces the derived price, for a sheet that quotes a ladder rather
   *  than a single figure. */
  priceLabel?: string;
};

/** How far a mouse has to travel before a drag stops counting as a click. */
const DRAG_SLOP = 5;

/**
 * Image, then a ledger caption: name and price on one baseline, the colourway
 * and its swatches on the next.
 *
 * **The caption is the change.** It used to be four stacked blocks under the
 * frame — a title, a price paragraph, a row of dots in a list of its own — and
 * nothing said which photograph you were looking at. Now the two lines read
 * across, under one hairline, in the same mono the rest of the site states
 * facts in; and the colourway is named, because a grid of dots is not a label.
 *
 * Every card crops to the same 4:5, which is the shape the product page's
 * gallery is in — so a crop chosen once in the admin holds in both places. It
 * was 2:3 here and 4:5 there, and a photograph placed for the card moved the
 * moment somebody opened it.
 *
 * **The frames are a scroller, not a slideshow.** A phone swipes, a trackpad
 * scrolls sideways, and a mouse drags — all against one `overflow-x: auto` reel
 * with CSS scroll snapping, so the momentum, the snap and the rubber-band at
 * the ends are the platform's rather than something reimplemented in
 * JavaScript. Nothing on the card says so, because a row of photographs that
 * moves under your finger does not need a caption explaining that it moves
 * under your finger.
 *
 * Only the mouse drag needs code: a pointer press that travels more than
 * `DRAG_SLOP` scrolls the reel and then swallows the click, so pulling a card
 * sideways never lands on the product page by accident.
 *
 * One index still drives everything downstream. It is read back from the
 * reel's scroll position rather than owned by a button, and the colour dots
 * scroll the reel rather than setting it — but the price, the name, the link
 * and the picture still agree, because they are all still reading one number.
 */
export function ProductCard({
  product,
  index = 0,
  onQuickView,
  href: hrefOverride,
  priceLabel,
}: Props) {
  const colorways = useMemo(() => toColorways(product), [product]);
  const reelRef = useRef<HTMLDivElement>(null);

  const [shot, setShot] = useState(0);

  // Drag bookkeeping. Refs rather than state: none of it should paint.
  const origin = useRef({ x: 0, scroll: 0 });
  const dragging = useRef(false);
  const travelled = useRef(false);

  const frames = product.images;
  const hasFrames = frames.length > 0;
  const many = frames.length > 1;

  const safeShot = Math.min(shot, Math.max(frames.length - 1, 0));
  const colorIndex = Math.min(safeShot, colorways.length - 1);
  const colorway = colorways[colorIndex] ?? colorways[0];

  // A product with no colourways has no stock to read, which is not the same
  // as being out of it.
  const soldOut = colorways.length > 0 && colorways.every((option) => !option.inStock);
  const href =
    hrefOverride ??
    (colorway
      ? `/product/${product.slug}?color=${encodeURIComponent(colorway.color)}`
      : `/product/${product.slug}`);

  const show = useCallback((target: number) => {
    const reel = reelRef.current;
    if (!reel) return;

    reel.scrollTo({ left: target * reel.clientWidth, behavior: 'smooth' });
  }, []);

  // The reel is the source of truth for which frame is showing, whichever of
  // the four ways of moving it got us here.
  function onScroll(event: React.UIEvent<HTMLDivElement>) {
    const reel = event.currentTarget;
    if (reel.clientWidth === 0) return;

    setShot(Math.round(reel.scrollLeft / reel.clientWidth));
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // Touch and pen already drag natively, and hijacking them would replace a
    // scroller that has momentum with one that does not.
    if (event.pointerType !== 'mouse') return;

    const reel = event.currentTarget;
    dragging.current = true;
    travelled.current = false;
    origin.current = { x: event.clientX, scroll: reel.scrollLeft };

    // Toggled on the node rather than through state: scroll snapping has to be
    // off before the first `scrollLeft` write of the drag, and a re-render is
    // both a frame too late and a repaint the drag does not need.
    reel.classList.add('sh-card__reel--drag');
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;

    const reel = event.currentTarget;
    const distance = event.clientX - origin.current.x;

    // Capture is claimed here rather than on pointerdown, and only once the
    // pointer has actually travelled. While capture is set the browser retargets
    // the click to the capturing element, so capturing on press meant every
    // plain click landed on the reel instead of the card's link — the card
    // simply would not open on a mouse. A drag still captures, and a drag's
    // click is swallowed below anyway.
    if (!travelled.current && Math.abs(distance) > DRAG_SLOP) {
      travelled.current = true;
      reel.setPointerCapture(event.pointerId);
    }

    if (!travelled.current) return;

    reel.scrollLeft = origin.current.scroll - distance;
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;

    const reel = event.currentTarget;
    dragging.current = false;

    reel.classList.remove('sh-card__reel--drag');
    if (reel.hasPointerCapture(event.pointerId)) reel.releasePointerCapture(event.pointerId);

    // Snapping is switched off during the drag, so nothing fights the pointer.
    // Landing it is this component's job.
    if (travelled.current && reel.clientWidth > 0) {
      show(Math.round(reel.scrollLeft / reel.clientWidth));
    }
  }

  // Capture is what normally guarantees a pointerup, and it is not claimed
  // until the drag has actually started — so a press that leaves the card
  // before travelling has to be closed out by hand.
  function onPointerLeave(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) return;

    onPointerUp(event);
  }

  // A drag that ends over a photograph would otherwise navigate on release.
  function onClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (!travelled.current) return;

    event.preventDefault();
    event.stopPropagation();
    travelled.current = false;
  }

  return (
    <article className="sh-card">
      <div className="sh-card__media">
        <div
          ref={reelRef}
          className="sh-card__reel"
          role="group"
          aria-label={`${product.title}, ${frames.length} ${frames.length === 1 ? 'photograph' : 'photographs'}`}
          tabIndex={many ? 0 : -1}
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerLeave}
          onClickCapture={onClickCapture}
        >
          {hasFrames ? (
            frames.map((frame, position) => (
              /* Untabbable on purpose: the title below is the card's one
                 accessible route to the product, and N frames × M products
                 would otherwise bury the grid in tab stops. The reel itself
                 takes the focus, and arrow keys scroll it.

                 A link rather than the whole card being one: an overlay across
                 the card would sit on top of the reel and swallow the swipe
                 that makes the frames worth having. */
              <Link
                key={frame.publicId}
                href={href}
                className="sh-card__frame"
                tabIndex={-1}
                aria-hidden="true"
                draggable={false}
              >
                <Image
                  /* A scale, not a fill: the crop belongs to the image and is
                     applied in CSS, so a server-side centre crop here would
                     silently overrule what the admin chose. */
                  src={imageUrl(frame.publicId, 'w_1200,q_auto,f_auto')}
                  alt=""
                  fill
                  loading={index < 2 && position === 0 ? undefined : 'lazy'}
                  priority={index < 2 && position === 0}
                  sizes="(min-width: 62rem) 33vw, 50vw"
                  draggable={false}
                  style={cropStyle(frame)}
                />
              </Link>
            ))
          ) : (
            <span className="sh-card__frame" aria-hidden="true" />
          )}
        </div>

        {/* One flag at a time, and sold out outranks new: a shopper who cannot
            buy it needs to know that before they need to know it is recent. */}
        {soldOut ? (
          <p className="sh-card__flag sh-card__flag--sold">Sold out</p>
        ) : product.badge === 'new' ? (
          <p className="sh-card__flag">New</p>
        ) : null}

        {product.rating > 0 ? (
          <p className="sh-card__rating">
            <StarIcon className="sh-card__star" />
            <span className="tnum">{product.rating.toFixed(1).replace(/\.0$/, '')}</span>
            <span className="visually-hidden"> out of 5</span>
          </p>
        ) : null}

        {many ? (
          <ol className="sh-card__ticks" aria-hidden="true">
            {frames.map((frame, i) => (
              <li
                key={frame.publicId}
                className={`sh-card__tick${i === safeShot ? ' sh-card__tick--on' : ''}`}
              />
            ))}
          </ol>
        ) : null}

        {/* Desktop only — CSS hides it where there is no hover to reveal it
            with. On a phone the photograph is the whole screen and tapping it
            goes to the real product page, which is better than a miniature of
            it. */}
        {onQuickView ? (
          <button
            type="button"
            className="sh-card__preview"
            onClick={() => onQuickView(product)}
          >
            Quick view
            <span className="visually-hidden">: {product.title}</span>
          </button>
        ) : null}
      </div>

      <div className="sh-card__foot">
        <div className="sh-card__line">
          <h3 className="sh-card__title">
            <Link href={href} className="sh-card__link">
              {product.title}
            </Link>
          </h3>

          <p className="sh-card__price tnum">
            {priceLabel ?? formatCents(colorway?.priceCents ?? product.minPriceCents)}
          </p>
        </div>

        {colorway ? (
          <div className="sh-card__line">
            <p className="sh-card__colorway">{colorway.color}</p>

            {colorways.length > 1 ? (
              <ul className="sh-card__colors">
                {colorways.map((option, optionIndex) => (
                  <li key={option.color}>
                    <button
                      type="button"
                      className={`swatchdot dot--${option.color}${
                        optionIndex === colorIndex ? ' swatchdot--on' : ''
                      }`}
                      aria-pressed={optionIndex === colorIndex}
                      onFocus={() => show(optionIndex)}
                      onClick={() => show(optionIndex)}
                    >
                      <span className="visually-hidden">Show {option.color}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
