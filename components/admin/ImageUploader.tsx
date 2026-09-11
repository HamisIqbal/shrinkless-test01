'use client';

import { useState } from 'react';
import { createUploadSignatureAction } from '@/app/actions/admin/products';
import { uploadEndpoint } from '@/lib/cloudinary/config';
import { ImageCropField } from '@/components/admin/ImageCropField';
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

export function ImageUploader({ images, onChange, ratios = PRODUCT_RATIOS }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file: File) {
    setBusy(true);
    setError('');

    try {
      const signed = await createUploadSignatureAction();
      if (!signed.ok) throw new Error(signed.error);

      const body = new FormData();
      body.set('file', file);
      body.set('api_key', signed.apiKey);
      body.set('timestamp', String(signed.timestamp));
      body.set('folder', signed.folder);
      body.set('signature', signed.signature);

      const response = await fetch(uploadEndpoint(signed.cloudName), { method: 'POST', body });
      if (!response.ok) throw new Error('Cloudinary rejected the upload.');

      const uploaded = (await response.json()) as {
        public_id: string; width: number; height: number;
      };

      onChange([
        ...images,
        {
          publicId: uploaded.public_id,
          width: uploaded.width,
          height: uploaded.height,
          alt: '',
          focus: '',
          zoom: ZOOM_MIN,
          mobileFocus: '',
        },
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  /** Order is meaning here: position one is the featured image everywhere in
   *  the store, so moving an image is how that choice is made. */
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
            <li key={image.publicId} className="uploader__shot">
              <div className="uploader__head">
                <span className="uploader__index">
                  {index === 0 ? 'Featured' : `Image ${index + 1}`}
                </span>

                <div className="uploader__tools">
                  <button
                    type="button"
                    className="abtn abtn--quiet abtn--sm"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Move image earlier"
                  >
                    &larr;
                  </button>
                  <button
                    type="button"
                    className="abtn abtn--quiet abtn--sm"
                    onClick={() => move(index, 1)}
                    disabled={index === images.length - 1}
                    aria-label="Move image later"
                  >
                    &rarr;
                  </button>
                  <button
                    type="button"
                    className="abtn abtn--quiet abtn--sm"
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
                  placeholder="Alt text"
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
      ) : (
        <p className="aquiet" style={{ marginBottom: 'var(--ad-s-3)' }}>
          No photography yet. The first image you add becomes the featured one.
        </p>
      )}

      <label className="adfield">
        Add image
        <input
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = '';
          }}
        />
      </label>

      {busy ? <p className="anotice">Uploading</p> : null}
      {error ? <p role="alert" className="anotice anotice--error">{error}</p> : null}
    </div>
  );
}
