'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { imageUrl } from '@/lib/images';
import { cropStyle } from '@/lib/media/crop';
import type { ImageDTO } from '@/types/dto';

type Props = {
  images: ImageDTO[];
  /** Alt text of last resort, and the label the dialog answers to. */
  title: string;
  /** The page's own gallery container class, so the layout is unchanged. */
  wrapClassName: string;
  /** The page's own frame class, ditto. */
  frameClassName: string;
  sizes: string;
  /** Cloudinary transform for the in-page frames. */
  transform?: string;
  /** Rendered in place of the frames when the product has no photography. */
  empty?: ReactNode;
};

/** Full-bleed source for the viewer: no crop, and no meaningful downscale. */
const FULL = 'w_2000,q_auto,f_auto';

/**
 * The product photography, and a way to look at it properly.
 *
 * The frames are the ones the pages already drew — same classes, same crop
 * custom properties, same `sizes` — wrapped in a button so a click opens the
 * viewer and a keyboard can too. The viewer shows the uncropped photograph
 * `contain`ed, steps through the rest of the gallery, and lets a pointer or a
 * finger magnify one spot at a time. No new image data: the same `ImageDTO`s
 * the page already had, asked of Cloudinary at a larger width.
 */
export function ProductGallery({
  images,
  title,
  wrapClassName,
  frameClassName,
  sizes,
  transform,
  empty,
}: Props) {
  const [open, setOpen] = useState<number | null>(null);

  const close = useCallback(() => setOpen(null), []);

  const step = useCallback(
    (delta: number) =>
      setOpen((current) =>
        current === null ? current : (current + delta + images.length) % images.length,
      ),
    [images.length],
  );

  if (!images.length) {
    return <div className={wrapClassName}>{empty}</div>;
  }

  return (
    <>
      <div className={wrapClassName}>
        {images.map((image, index) => (
          <button
            key={image.publicId}
            type="button"
            className={`${frameClassName} zoomshot`}
            onClick={() => setOpen(index)}
            aria-label={`View ${image.alt || title} larger`}
          >
            <Image
              src={imageUrl(image.publicId, transform)}
              alt={image.alt || title}
              fill
              priority={index === 0}
              loading={index === 0 ? undefined : 'lazy'}
              sizes={sizes}
              style={cropStyle(image)}
            />
            <span className="zoomshot__hint" aria-hidden="true">
              <MagnifierMark />
            </span>
          </button>
        ))}
      </div>

      {open !== null
        ? createPortal(
            <Lightbox
              images={images}
              title={title}
              index={open}
              onClose={close}
              onStep={step}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function MagnifierMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M15.4 15.4 21 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M10.5 7.6v5.8M7.6 10.5h5.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

type BoxProps = {
  images: ImageDTO[];
  title: string;
  index: number;
  onClose: () => void;
  onStep: (delta: number) => void;
};

function Lightbox({ images, title, index, onClose, onStep }: BoxProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  /* A touch that swiped is followed by a synthetic click on the same element.
     Without this the swipe stepped to the next photograph and then the click
     magnified it, so every swipe landed on a picture already zoomed into
     whatever corner the finger happened to lift from. */
  const swallowClick = useRef(false);

  // Magnified, and about which point. Cleared on every change of frame, so a
  // 2.5x view of one photograph is not inherited by the next.
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');

  const many = images.length > 1;
  const image = images[index];

  /** Stepping always lands on the next photograph whole, not at 2.5x on
   *  whatever corner the last one was being read at. */
  const go = useCallback(
    (delta: number) => {
      setZoomed(false);
      setOrigin('50% 50%');
      onStep(delta);
    },
    [onStep],
  );

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (!many) return;
      if (event.key === 'ArrowRight') go(1);
      if (event.key === 'ArrowLeft') go(-1);
    }

    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [many, onClose, go]);

  /**
   * Where the pointer is, as a percentage of the photograph.
   *
   * Of the photograph, not of the stage: a contained image is letterboxed
   * inside it, and a `transform-origin` measured against the stage magnifies a
   * point some way off the one that was clicked. `offsetWidth`/`offsetHeight`
   * are the image's layout box, which the zoom transform does not touch — so
   * the same arithmetic holds while panning at 2.5x as it does on the first
   * click.
   */
  function point(event: { clientX: number; clientY: number }) {
    const box = stageRef.current?.getBoundingClientRect();
    const shot = imageRef.current;
    if (!box || !shot) return '50% 50%';

    const width = shot.offsetWidth;
    const height = shot.offsetHeight;
    if (!width || !height) return '50% 50%';

    // Centred by the stage, so its unscaled edges sit at these two offsets.
    const left = box.left + (box.width - width) / 2;
    const top = box.top + (box.height - height) / 2;

    const x = Math.min(100, Math.max(0, ((event.clientX - left) / width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - top) / height) * 100));
    return `${x.toFixed(1)}% ${y.toFixed(1)}%`;
  }

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — image ${index + 1} of ${images.length}`}
    >
      <button
        type="button"
        className="lightbox__scrim"
        aria-label="Close image viewer"
        onClick={onClose}
      />

      <button ref={closeRef} type="button" className="lightbox__close" onClick={onClose}>
        <span className="visually-hidden">Close image viewer</span>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {many ? (
        <>
          <button
            type="button"
            className="lightbox__step lightbox__step--prev"
            onClick={() => go(-1)}
          >
            <span className="visually-hidden">Previous image</span>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
              <path
                d="M15 4 7 12l8 8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            type="button"
            className="lightbox__step lightbox__step--next"
            onClick={() => go(1)}
          >
            <span className="visually-hidden">Next image</span>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
              <path
                d="m9 4 8 8-8 8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </>
      ) : null}

      <div
        ref={stageRef}
        className={`lightbox__stage${zoomed ? ' lightbox__stage--zoomed' : ''}`}
        onClick={(event) => {
          if (swallowClick.current) {
            swallowClick.current = false;
            return;
          }

          setOrigin(point(event));
          setZoomed((on) => !on);
        }}
        onMouseMove={(event) => {
          if (zoomed) setOrigin(point(event));
        }}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          swipe.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(event) => {
          const start = swipe.current;
          swipe.current = null;
          if (!start || !many || zoomed) return;

          const touch = event.changedTouches[0];
          const dx = touch.clientX - start.x;
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(touch.clientY - start.y)) {
            swallowClick.current = true;
            go(dx < 0 ? 1 : -1);
          }
        }}
      >
        {/* Not next/image: this is one full-size photograph, already sized by
            the transform, and `fill` inside a contain box fights the zoom
            transform-origin the viewer sets. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={image.publicId}
          ref={imageRef}
          className="lightbox__image"
          src={imageUrl(image.publicId, FULL)}
          alt={image.alt || title}
          style={{ transformOrigin: origin }}
          draggable={false}
        />
      </div>

      <p className="lightbox__meta">
        {many ? <span className="tnum">{`${index + 1} / ${images.length}`}</span> : null}
        <span className="lightbox__tip">
          {zoomed ? 'Tap the image to zoom out' : 'Tap the image to magnify'}
        </span>
      </p>
    </div>
  );
}
