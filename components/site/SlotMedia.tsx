import Image, { type ImageProps } from 'next/image';
import type { CSSProperties } from 'react';
import { isVideoUrl } from '@/lib/media/video';

type Props = Omit<ImageProps, 'src'> & { src: string };

/** What `fill` gives an image, so a film dropped into the same frame covers
 *  it the same way and every class written for the photograph still lands. */
const FILL: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
};

/**
 * A Media slot's frame — a photograph, or a film where the admin gave it one.
 *
 * A drop-in for `next/image` at every place a slot is drawn: same props, same
 * class, same crop style. The crop is custom properties read by the class, so
 * a video placed with the admin's crop sits exactly where the photograph did.
 *
 * Films play the way the Our Story opener always played its: muted, looped,
 * inline, and on their own — a browser will only autoplay a muted video, and a
 * frame with sound in the middle of a page is not what anybody scrolled to.
 */
export function SlotMedia(props: Props) {
  const { src, alt, fill, priority, className, style } = props;

  if (!isVideoUrl(src)) return <Image {...props} alt={alt} />;

  return (
    <video
      src={src}
      className={className}
      style={{ ...(fill ? FILL : {}), objectFit: 'cover', ...style }}
      autoPlay
      loop
      muted
      playsInline
      preload={priority ? 'auto' : 'metadata'}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    />
  );
}
