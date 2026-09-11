'use client';

import { useCallback, useRef, useState } from 'react';
import { sizedImageUrl } from '@/lib/images';
import {
  CENTRE,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  desktopView,
  focusToPair,
  hasMobileCrop,
  mobileView,
  pairToFocus,
  ratioValue,
  viewStyle,
  type Crop,
  type CropView,
  type Ratio,
  type ViewRatios,
} from '@/lib/media/crop';

type Props = {
  url: string;
  alt: string;
  crop: Crop;
  /** The two shapes this photograph is actually seen in — one stage each. */
  ratios: ViewRatios;
  /** Which viewport to hand over. The media builder shows one at a time,
   *  because the canvas behind it is already showing that one; everywhere
   *  else both stages stand together. Either way the two placements stay
   *  independent — a stage that is not on screen is not written to. */
  only?: 'desktop' | 'mobile';
  onChange: (crop: Crop) => void;
};

/** How much one arrow key press moves the photograph, as a fraction of the
 *  overflow. Small enough to place a face, large enough to cross the frame. */
const NUDGE = 0.02;

/** What a stage asks Cloudinary for. A scale, never a crop: the whole
 *  photograph has to be here for there to be anything to drag. Applies to a
 *  pasted Cloudinary link as much as to an upload, so neither hands a phone's
 *  full-resolution original to a holder a few hundred pixels wide. Frames from
 *  anywhere else are left exactly as they are. */
const STAGE = 'w_1200,q_auto,f_auto';

/* --------------------------------------------------------------------------
   One view, croppable
   -------------------------------------------------------------------------- */

function CropStage({
  url,
  label,
  ratio,
  view,
  onChange,
}: {
  url: string;
  label: string;
  ratio: Ratio;
  view: CropView;
  onChange: (view: CropView) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  /**
   * How far the photograph can travel inside this frame, in pixels, per axis.
   *
   * `cover` scales the source until it covers the frame; the zoom scales it
   * again. What is left over on each axis is the whole range a drag has to
   * work with — and dividing by it is what makes the photograph keep pace with
   * the pointer instead of sliding faster or slower than it.
   */
  const overflow = useCallback((): [number, number] => {
    const frame = stage.current?.getBoundingClientRect();
    const img = image.current;

    if (!frame || !img?.naturalWidth || !img.naturalHeight) return [0, 0];

    const cover = Math.max(frame.width / img.naturalWidth, frame.height / img.naturalHeight);

    return [
      img.naturalWidth * cover * view.zoom - frame.width,
      img.naturalHeight * cover * view.zoom - frame.height,
    ];
  }, [view.zoom]);

  const nudge = useCallback(
    (dx: number, dy: number) => {
      const [overflowX, overflowY] = overflow();
      const [x, y] = focusToPair(view.focus);

      onChange({
        focus: pairToFocus(
          overflowX > 0 ? x - dx / overflowX : x,
          overflowY > 0 ? y - dy / overflowY : y,
        ),
        zoom: view.zoom,
      });
    },
    [onChange, overflow, view.focus, view.zoom],
  );

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    drag.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;

    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;

    // Only bank the movement that was actually applied, so a drag against a
    // stop does not accumulate a debt that has to be dragged back out.
    drag.current = { x: event.clientX, y: event.clientY };
    nudge(dx, dy);
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;

    drag.current = null;
    setDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const [overflowX, overflowY] = overflow();

    const step: Record<string, [number, number]> = {
      ArrowLeft: [overflowX * NUDGE, 0],
      ArrowRight: [-overflowX * NUDGE, 0],
      ArrowUp: [0, overflowY * NUDGE],
      ArrowDown: [0, -overflowY * NUDGE],
    };

    const move = step[event.key];
    if (!move) return;

    event.preventDefault();
    nudge(move[0], move[1]);
  }

  return (
    /* The height a holder may stand is capped in the stylesheet; the width
       follows from this frame's own shape, so a tall phone frame stays a usable
       size instead of taking the whole column. It is set here rather than on
       the holder so the label and the zoom row are the same width as the
       photograph they belong to. */
    <div
      className="cropview"
      style={{ maxWidth: `calc(${(ratio.w / ratio.h).toFixed(4)} * var(--crop-max-h))` }}
    >
      <div className="cropview__head">
        <span className="cropview__label">{label}</span>
        <span className="cropview__ratio">
          {ratio.w}:{ratio.h}
        </span>
      </div>

      <div
        ref={stage}
        className={`cropstage${dragging ? ' cropstage--drag' : ''}`}
        style={{ aspectRatio: ratioValue(ratio) }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="group"
        aria-label={`${label} crop. Drag the photograph, or use the arrow keys, to choose what this frame keeps.`}
      >
        {/* Not next/image: the source changes as the admin types or uploads,
            and this is a rehearsal of a crop rather than a rendered page. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={image}
          src={sizedImageUrl(url, STAGE)}
          alt=""
          style={viewStyle(view)}
          draggable={false}
        />

        {/* Thirds. The holder is the frame, so the guides are for placing a
            subject inside it, not for showing where it ends. */}
        <span className="cropstage__guides" aria-hidden="true" />
      </div>

      <label className="cropview__zoom">
        <span>Zoom</span>
        <input
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={ZOOM_STEP}
          value={view.zoom}
          onChange={(event) =>
            onChange({ focus: view.focus, zoom: Number(event.target.value) })
          }
          aria-label={`${label} zoom`}
        />
        <span className="cropview__zoomvalue">{view.zoom.toFixed(2)}×</span>
      </label>
    </div>
  );
}

/* --------------------------------------------------------------------------
   The field
   -------------------------------------------------------------------------- */

/**
 * The two frames a photograph is seen in, each croppable on its own.
 *
 * These were one crop stage plus two previews, and the previews were the wrong
 * shape of thing: the reason to look at a wide crop beside a tall one is that
 * the tall one usually needs a different decision, and a preview is exactly
 * the control that cannot make it. So both are stages now.
 *
 * The phone follows the desk until somebody moves it, and the field says which
 * it is doing. That default is what keeps the common case — one photograph,
 * one placement, two shapes it happens to survive — from being two jobs.
 *
 * Neither stage cuts the file. Each writes an `object-position` and a scale;
 * `storefront.css` picks between the pair at the same breakpoint the layouts
 * turn at. See `lib/media/crop.ts`.
 */
export function ImageCropField({ url, alt, crop, ratios, only, onChange }: Props) {
  const separate = hasMobileCrop(crop);
  const untouched =
    !separate && (!crop.focus || crop.focus === CENTRE) && (crop.zoom ?? ZOOM_MIN) === ZOOM_MIN;

  if (!url) {
    return (
      <div className="cropfield cropfield--empty">
        <div
          className="cropframe"
          style={{ aspectRatio: ratioValue(only ? ratios[only] : ratios.desktop) }}
        >
          <span className="cropframe__empty">No image yet</span>
        </div>
        <p className="cropfield__note">
          Add a photograph and its crop holders appear here, in the shapes this
          frame is actually seen in.
        </p>
      </div>
    );
  }

  return (
    <div className="cropfield">
      <div className="cropfield__head">
        <span className="cropfield__label">Crop</span>
        <span className="cropfield__hint">
          {only ? 'Drag the photograph. Arrow keys nudge.' : 'Drag either frame. Arrow keys nudge.'}{' '}
          {separate
            ? 'The phone has a crop of its own.'
            : 'The phone follows the desktop until you move it.'}
        </span>
      </div>

      <div className="cropviews">
        {only === 'mobile' ? null : (
        <CropStage
          url={url}
          label="Desktop"
          ratio={ratios.desktop}
          view={desktopView(crop)}
          onChange={(view) => onChange({ ...crop, focus: view.focus, zoom: view.zoom })}
        />
        )}

        {only === 'desktop' ? null : (
        <CropStage
          url={url}
          label="Mobile"
          ratio={ratios.mobile}
          /* Shows the desktop placement until it is given one of its own, so
             what is on screen before the first drag is what the phone will
             actually render. */
          view={mobileView(crop)}
          onChange={(view) =>
            onChange({ ...crop, mobileFocus: view.focus, mobileZoom: view.zoom })
          }
        />
        )}
      </div>

      <div className="cropfield__controls">
        <span className="cropfield__alt">{alt ? `“${alt}”` : 'No alt text yet'}</span>

        <span className="cropfield__buttons">
          <button
            type="button"
            className="abtn abtn--quiet abtn--sm"
            onClick={() => onChange({ ...crop, mobileFocus: '', mobileZoom: undefined })}
            disabled={!separate}
          >
            Match desktop
          </button>

          <button
            type="button"
            className="abtn abtn--quiet abtn--sm"
            onClick={() =>
              onChange({ focus: CENTRE, zoom: ZOOM_MIN, mobileFocus: '', mobileZoom: undefined })
            }
            disabled={untouched}
          >
            Reset crop
          </button>
        </span>
      </div>
    </div>
  );
}
