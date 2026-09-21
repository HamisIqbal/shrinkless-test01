'use client';

import { useState } from 'react';
import { createSiteUploadSignatureAction } from '@/app/actions/admin/media';
import { ImageCropField } from '@/components/admin/ImageCropField';
import { uploadEndpoint } from '@/lib/cloudinary/config';
import { cloudinaryUrl } from '@/lib/cloudinary/url';
import { sizedImageUrl } from '@/lib/images';
import { SLOT_MEDIA_ACCEPT, isVideoUrl } from '@/lib/media/video';
import { ZOOM_MIN, hasMobileCrop, ratioValue, type ViewRatios } from '@/lib/media/crop';

/**
 * One photograph as the list holds it while nothing has been published.
 *
 * Two placements, not one. The editor this replaced published a single crop
 * and blanked the phone's on the way out, because it was judging the crop
 * against a desktop-shaped preview and had nowhere to judge the other. A list
 * has room for both stages side by side, so the phone gets a decision of its
 * own — which is the whole reason `Crop` has carried the second pair all
 * along.
 */
export type Frame = {
  url: string;
  alt: string;
  focus: string;
  zoom: number;
  mobileFocus: string;
  mobileZoom?: number;
};

/** The size a row's thumbnail asks Cloudinary for. A scale and no crop: the
 *  holder is already the shape the frame is rendered at, so cutting the file
 *  to a square here would show a shape the site never draws. Small, because a
 *  thumbnail is there to say which photograph this is, not to be judged by. */
const THUMB = 'w_240,q_auto,f_auto';

export function sameFrames(a: Frame[], b: Frame[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (frame, i) =>
        frame.url === b[i].url &&
        frame.alt === b[i].alt &&
        frame.focus === b[i].focus &&
        frame.zoom === b[i].zoom &&
        frame.mobileFocus === b[i].mobileFocus &&
        frame.mobileZoom === b[i].mobileZoom,
    )
  );
}

/**
 * Sends one file to Cloudinary and returns its address.
 *
 * The bytes go straight from this browser to Cloudinary; the server only ever
 * hands out a signature, so a large photograph never travels through a
 * serverless function with a timeout on it. Resolved to a full address on the
 * way back so the row can show it immediately — the same thing the service
 * does when it reads a public id out of the database.
 */
async function upload(file: File): Promise<string> {
  const signed = await createSiteUploadSignatureAction();
  if (!signed.ok) throw new Error(signed.error);

  const body = new FormData();
  body.set('file', file);
  body.set('api_key', signed.apiKey);
  body.set('timestamp', String(signed.timestamp));
  body.set('folder', signed.folder);
  body.set('signature', signed.signature);

  /* `auto`, so a film is taken as readily as a photograph — Cloudinary files
     it under `/video/upload/`, and that address is how every page knows to
     play it. */
  const response = await fetch(uploadEndpoint(signed.cloudName, 'auto'), {
    method: 'POST',
    body,
  });

  if (!response.ok) {
    const detail = await response
      .json()
      .then((payload: { error?: { message?: string } }) => payload?.error?.message)
      .catch(() => undefined);

    throw new Error(detail ? `Cloudinary refused it: ${detail}` : 'Cloudinary rejected the upload.');
  }

  /* Cloudinary's own address for the file, not one rebuilt from the public id:
     rebuilding it here needs the cloud name baked into the browser bundle, and
     a deployment built without it produced `res.cloudinary.com//image/…`.
     The signature carries the name as a fallback for a response without one. */
  const uploaded = (await response.json()) as { public_id: string; secure_url?: string };
  return uploaded.secure_url || cloudinaryUrl(uploaded.public_id, undefined, signed.cloudName);
}

/* --------------------------------------------------------------------------
   One frame's controls
   -------------------------------------------------------------------------- */

/**
 * Where a photograph comes from, what it says, and how it sits — in that
 * order, because that is the order somebody replacing an image works in.
 *
 * The address and the file picker are the same field twice: one for a link
 * carried in from somewhere else, one for a photograph on the desk. Both end
 * up in `url`, so nothing downstream has to know which was used.
 */
function FrameFields({
  frame,
  ratios,
  onChange,
}: {
  frame: Frame;
  ratios: ViewRatios;
  onChange: (change: Partial<Frame>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file: File | undefined) {
    if (!file) return;

    setBusy(true);
    setError('');

    try {
      onChange({ url: await upload(file) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mediaslot__body">
      <div className="mediaslot__preview">
        {/* Both stages, always. The phone follows the desk until it is
            dragged; `ImageCropField` says which it is doing and carries the
            way back. */}
        <ImageCropField
          url={frame.url}
          alt={frame.alt}
          crop={frame}
          ratios={ratios}
          onChange={(crop) =>
            onChange({
              focus: crop.focus ?? '',
              zoom: crop.zoom ?? ZOOM_MIN,
              mobileFocus: crop.mobileFocus ?? '',
              mobileZoom: crop.mobileZoom,
            })
          }
        />
      </div>

      <div className="mediaslot__fields">
        <label className="adfield">
          Image or video address
          <input
            value={frame.url}
            onChange={(event) => onChange({ url: event.target.value })}
            placeholder="https://… or a Cloudinary id"
            spellCheck={false}
          />
          <small>
            Paste a link, or upload a file from this machine. A video (.mp4, .webm, .mov) plays
            muted and on a loop.
          </small>
        </label>

        <label className="abtn abtn--ghost abtn--sm mediaslot__upload">
          {busy ? 'Uploading…' : 'Upload a file'}
          <input
            type="file"
            accept={SLOT_MEDIA_ACCEPT}
            hidden
            disabled={busy}
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </label>

        <label className="adfield">
          Alt text
          <input
            value={frame.alt}
            onChange={(event) => onChange({ alt: event.target.value })}
            maxLength={200}
            required
          />
          <small>Describe what is in the picture. Screen readers read this.</small>
        </label>

        {error ? <p className="anotice anotice--error">{error}</p> : null}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   One slot
   -------------------------------------------------------------------------- */

export type SlotRowProps = {
  label: string;
  where: string;
  ratios: ViewRatios;
  frames: Frame[];
  savedFrames: Frame[];
  /** False while the slot is still showing what the site shipped with. */
  overridden: boolean;
  open: boolean;
  onToggle: () => void;
  onChange: (frames: Frame[]) => void;
};

/**
 * A photograph in the list: what it is, where it is seen, and whether it has
 * been changed — with its controls folded away until they are wanted.
 *
 * Closed is the resting state because the list is a register of what the site
 * is using, and a register of twelve open forms is not readable. The thumbnail
 * is what identifies the row; the crop stages inside are what the decisions
 * are made against.
 *
 * The carousel is the one slot holding several photographs, so it opens to one
 * set of controls per frame rather than to a special case.
 */
export function MediaSlotRow({
  label,
  where,
  ratios,
  frames,
  savedFrames,
  overridden,
  open,
  onToggle,
  onChange,
}: SlotRowProps) {
  const edited = !sameFrames(frames, savedFrames);
  const many = frames.length > 1;

  /* A slot always ships with at least one frame, so this is a guard against a
     future that has none rather than a state the registry can reach today. */
  if (!frames.length) return null;

  function patch(index: number, change: Partial<Frame>) {
    onChange(frames.map((frame, i) => (i === index ? { ...frame, ...change } : frame)));
  }

  return (
    <li className={`mediarow${open ? ' mediarow--open' : ''}`}>
      <div className="mediarow__head">
        <button
          type="button"
          className="mediarow__toggle"
          onClick={onToggle}
          aria-expanded={open}
        >
          <span className="mediarow__thumbs">
            {frames.slice(0, 3).map((frame, index) => (
              <span
                className="mediarow__thumb"
                key={`${frame.url}-${index}`}
                style={{ aspectRatio: ratioValue(ratios.desktop) }}
              >
                {frame.url && isVideoUrl(frame.url) ? (
                  /* The film's first frame, still — a row is a label, and a
                     dozen of them playing at once is not. */
                  <video src={frame.url} muted playsInline preload="metadata" aria-hidden="true" />
                ) : frame.url ? (
                  /* Not next/image: the address changes as an admin types or
                     uploads, and this is a label rather than a rendered page. */
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={sizedImageUrl(frame.url, THUMB)} alt="" draggable={false} />
                ) : null}
              </span>
            ))}
          </span>

          <span className="mediarow__titles">
            <span className="mediaslot__title">
              {label}
              {many ? ` — ${frames.length} frames` : ''}
            </span>
            <span className="mediaslot__where">{where}</span>
          </span>
        </button>

        <div className="mediarow__marks">
          {edited ? <span className="mediarow__dirty">Not published</span> : null}

          <span className={`mediaslot__state${overridden ? ' mediaslot__state--on' : ''}`}>
            {overridden ? 'Changed' : 'Original'}
          </span>

          <button type="button" className="abtn abtn--quiet abtn--sm" onClick={onToggle}>
            {open ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>

      {open ? (
        <div className="mediarow__panel">
          {many ? (
            <ol className="mediaslot__frames">
              {frames.map((frame, index) => (
                <li className="mediaslot__frame" key={index}>
                  <div className="mediaslot__framehead">
                    <span className="mediaslot__index">
                      Frame {index + 1} of {frames.length}
                    </span>
                    {hasMobileCrop(frame) ? (
                      <span className="mediaslot__index">Phone cropped separately</span>
                    ) : null}
                  </div>

                  <FrameFields
                    frame={frame}
                    ratios={ratios}
                    onChange={(change) => patch(index, change)}
                  />
                </li>
              ))}
            </ol>
          ) : (
            <FrameFields
              frame={frames[0]}
              ratios={ratios}
              onChange={(change) => patch(0, change)}
            />
          )}

          <div className="mediaslot__foot">
            <button
              type="button"
              className="abtn abtn--quiet abtn--sm"
              onClick={() => onChange(savedFrames)}
              disabled={!edited}
            >
              Undo my changes
            </button>

            <p className="mediarow__note">
              Nothing here reaches the shop until Publish.
            </p>
          </div>
        </div>
      ) : null}
    </li>
  );
}
