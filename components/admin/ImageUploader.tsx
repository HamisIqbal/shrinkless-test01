'use client';

import { useId, useState } from 'react';
import { createUploadSignatureAction } from '@/app/actions/admin/products';
import { uploadEndpoint } from '@/lib/cloudinary/config';
import { ImageCropField } from '@/components/admin/ImageCropField';
import { imageUrl } from '@/lib/images';
import { PRODUCT_RATIOS, ZOOM_MIN, type ViewRatios } from '@/lib/media/crop';
import type { ImageDTO } from '@/types/dto';

type Props = {
  images: ImageDTO[];
  onChange: (images: ImageDTO[]) => void;
  /**
   * The two shapes these photographs are actually seen in. Defaults to the
   * product gallery, which is what every caller wanted until the wholesale
   * line sheet — whose frame is one 2:3 thumbnail rather than a 4:5 gallery,
   * and whose crops would be rehearsed against the wrong shape without this.
   */
  ratios?: ViewRatios;
};

/** What Cloudinary hands back that this component actually reads. */
type Uploaded = { public_id: string; width: number; height: number };

/**
 * Sends one file straight to Cloudinary and returns what it became.
 *
 * The bytes go from this browser to Cloudinary; the server only ever mints a
 * signature, so a phone-sized photograph never travels through a serverless
 * function with a timeout on it.
 */
async function upload(file: File): Promise<Uploaded> {
  const signed = await createUploadSignatureAction();
  if (!signed.ok) throw new Error(signed.error);

  const body = new FormData();
  body.set('file', file);
  body.set('api_key', signed.apiKey);
  body.set('timestamp', String(signed.timestamp));
  body.set('folder', signed.folder);
  body.set('signature', signed.signature);

  const response = await fetch(uploadEndpoint(signed.cloudName), { method: 'POST', body });

  if (!response.ok) {
    // Cloudinary says why in the body, and "Cloudinary rejected the upload"
    // on its own leaves an admin with nothing to act on — a file over the
    // plan's size limit and an expired signature read identically.
    const detail = await response
      .json()
      .then((payload: { error?: { message?: string } }) => payload?.error?.message)
      .catch(() => undefined);

    throw new Error(detail ? `Cloudinary refused it: ${detail}` : 'Cloudinary rejected the upload.');
  }

  return (await response.json()) as Uploaded;
}

/**
 * How large a photograph at this address actually is.
 *
 * A pasted link carries no dimensions, and the product schema requires them —
 * so the browser loads the image and reads them off it. Loading it is also the
 * check that the address points at a picture at all, which is worth having
 * before it is saved onto a product page.
 */
function measure(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const probe = new window.Image();
    probe.onload = () => resolve({ width: probe.naturalWidth, height: probe.naturalHeight });
    probe.onerror = () => reject(new Error('Nothing loaded from that address.'));
    probe.src = src;
  });
}

/** A fresh frame, uncropped, with no alt text yet. */
function frameFrom(uploaded: Uploaded): ImageDTO {
  return {
    publicId: uploaded.public_id,
    width: uploaded.width,
    height: uploaded.height,
    alt: '',
    focus: '',
    zoom: ZOOM_MIN,
    mobileFocus: '',
  };
}

/**
 * A product's photography: add, replace, reorder, crop, describe.
 *
 * **Replacing is the thing that was missing.** The only way to change a
 * photograph was to remove it and add another, which threw away its crop, its
 * alt text and its place in the order — so correcting one frame of a
 * four-frame product meant redoing all of that by hand. Now a frame has its
 * own Replace, and the new file lands in the old one's position carrying the
 * old one's alt text; only the crop resets, because a crop is a decision about
 * a particular photograph and cannot survive a different one.
 *
 * Several files can be chosen at once and dropped onto the panel, which is how
 * photography actually arrives — a folder at a time, not a file at a time.
 *
 * An address can be pasted as well as a file uploaded, the same as the Media
 * tab, so photography that already lives somewhere does not have to be
 * downloaded and re-uploaded to be used. The browser measures it on the way
 * in, because the product schema wants real dimensions and a pasted link
 * carries none.
 *
 * Order is meaning: position one is the featured image everywhere in the
 * store — cards, cart lines, share previews — so moving an image is how that
 * choice is made.
 */
export function ImageUploader({ images, onChange, ratios = PRODUCT_RATIOS }: Props) {
  const dropId = useId();

  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const [address, setAddress] = useState('');

  async function addFiles(files: File[]) {
    const pictures = files.filter((file) => file.type.startsWith('image/'));
    if (!pictures.length) return;

    setError('');

    try {
      const added: ImageDTO[] = [];

      // One at a time rather than `Promise.all`: each upload needs its own
      // signature, and a dozen at once is a dozen concurrent actions racing
      // one Cloudinary rate limit.
      for (const [index, file] of pictures.entries()) {
        setBusy(`Uploading ${index + 1} of ${pictures.length}…`);
        added.push(frameFrom(await upload(file)));
      }

      onChange([...images, ...added]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upload failed.');
    } finally {
      setBusy('');
    }
  }

  /** The new file takes the old one's place and its alt text. */
  async function replace(index: number, file: File) {
    setBusy('Replacing…');
    setError('');

    try {
      const uploaded = await upload(file);

      onChange(
        images.map((current, i) =>
          i === index
            ? { ...frameFrom(uploaded), alt: current.alt }
            : current,
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upload failed.');
    } finally {
      setBusy('');
    }
  }

  async function addAddress() {
    const value = address.trim();
    if (!value) return;

    setBusy('Checking that address…');
    setError('');

    try {
      const { width, height } = await measure(imageUrl(value));
      onChange([...images, frameFrom({ public_id: value, width, height })]);
      setAddress('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That address did not load.');
    } finally {
      setBusy('');
    }
  }

  function move(index: number, by: number) {
    const target = index + by;
    if (target < 0 || target >= images.length) return;

    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="uploader">
      {images.length ? (
        <ul className="uploader__grid">
          {images.map((image, index) => (
            <li key={`${image.publicId}-${index}`} className="uploader__shot">
              <div className="uploader__head">
                <span className="uploader__index">
                  {index === 0 ? 'Featured' : `Image ${index + 1}`}
                </span>

                <div className="uploader__tools">
                  <button
                    type="button"
                    className="abtn abtn--quiet abtn--sm"
                    onClick={() => move(index, -1)}
                    disabled={index === 0 || Boolean(busy)}
                    aria-label="Move image earlier"
                  >
                    &larr;
                  </button>
                  <button
                    type="button"
                    className="abtn abtn--quiet abtn--sm"
                    onClick={() => move(index, 1)}
                    disabled={index === images.length - 1 || Boolean(busy)}
                    aria-label="Move image later"
                  >
                    &rarr;
                  </button>

                  {/* A label rather than a button, because the control that
                      has to be clicked is the file input inside it. */}
                  <label className="abtn abtn--quiet abtn--sm uploader__replace">
                    Replace
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={Boolean(busy)}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void replace(index, file);
                        event.target.value = '';
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    className="abtn abtn--quiet abtn--sm"
                    disabled={Boolean(busy)}
                    onClick={() => onChange(images.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="uploader__item">
                <ImageCropField
                  url={image.publicId}
                  alt={image.alt}
                  crop={image}
                  ratios={ratios}
                  onChange={(crop) =>
                    onChange(
                      images.map((current, i) =>
                        i === index
                          ? {
                              ...current,
                              focus: crop.focus ?? '',
                              zoom: crop.zoom ?? ZOOM_MIN,
                              mobileFocus: crop.mobileFocus ?? '',
                              mobileZoom: crop.mobileZoom,
                            }
                          : current,
                      ),
                    )
                  }
                />
              </div>

              <label className="adfield uploader__alt">
                Alt text
                <input
                  value={image.alt}
                  placeholder="Describe what is in the picture"
                  onChange={(event) =>
                    onChange(
                      images.map((current, i) =>
                        i === index ? { ...current, alt: event.target.value } : current,
                      ),
                    )
                  }
                />
              </label>
            </li>
          ))}
        </ul>
      ) : null}

      {/* The drop zone is also the file picker and also the empty state, so
          there is one place to add photography rather than three. */}
      <label
        htmlFor={dropId}
        className={`uploader__drop${over ? ' uploader__drop--over' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          void addFiles([...event.dataTransfer.files]);
        }}
      >
        <span className="uploader__dropline">
          {images.length
            ? 'Drop more photographs here, or choose files'
            : 'Drop photographs here, or choose files'}
        </span>
        <span className="uploader__drophint">
          {images.length
            ? 'They are added after the ones above. Drag with the arrows to reorder.'
            : 'The first one becomes the featured image.'}
        </span>
        <input
          id={dropId}
          type="file"
          accept="image/*"
          multiple
          hidden
          disabled={Boolean(busy)}
          onChange={(event) => {
            void addFiles([...(event.target.files ?? [])]);
            event.target.value = '';
          }}
        />
      </label>

      <div className="uploader__address">
        <label className="adfield">
          Or paste an image address
          <input
            value={address}
            placeholder="https://… or a Cloudinary id"
            spellCheck={false}
            disabled={Boolean(busy)}
            onChange={(event) => setAddress(event.target.value)}
            onKeyDown={(event) => {
              // The uploader sits inside the product form, and Enter in a bare
              // text field would submit the whole product instead.
              if (event.key !== 'Enter') return;
              event.preventDefault();
              void addAddress();
            }}
          />
          <small>Loaded once to read its size before it is added.</small>
        </label>

        <button
          type="button"
          className="abtn abtn--ghost abtn--sm"
          disabled={Boolean(busy) || address.trim() === ''}
          onClick={() => void addAddress()}
        >
          Add
        </button>
      </div>

      {busy ? <p className="anotice">{busy}</p> : null}
      {error ? <p role="alert" className="anotice anotice--error">{error}</p> : null}
    </div>
  );
}
