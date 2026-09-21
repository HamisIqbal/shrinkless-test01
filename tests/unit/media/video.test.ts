import { describe, expect, it } from 'vitest';
import { isVideoUrl } from '@/lib/media/video';
import { uploadEndpoint } from '@/lib/cloudinary/config';

describe('isVideoUrl', () => {
  it('knows a Cloudinary video by where Cloudinary files it', () => {
    expect(isVideoUrl('https://res.cloudinary.com/demo/video/upload/v1/shrinkless/site/film')).toBe(true);
    expect(isVideoUrl('https://res.cloudinary.com/demo/image/upload/v1/shrinkless/site/a.jpg')).toBe(false);
  });

  it('knows a pasted film by its extension, query string or not', () => {
    expect(isVideoUrl('https://example.com/clip.mp4')).toBe(true);
    expect(isVideoUrl('https://example.com/clip.webm?t=3')).toBe(true);
    expect(isVideoUrl('https://example.com/clip.MOV')).toBe(true);
  });

  it('leaves photographs, public ids and nothing alone', () => {
    expect(isVideoUrl('https://images.unsplash.com/photo-1?auto=format&w=1200')).toBe(false);
    expect(isVideoUrl('shrinkless/site/a')).toBe(false);
    expect(isVideoUrl('https://example.com/mp4-guide.jpg')).toBe(false);
    expect(isVideoUrl('')).toBe(false);
    expect(isVideoUrl(undefined)).toBe(false);
  });
});

describe('uploadEndpoint', () => {
  it('sends product photography to image and slot media to auto', () => {
    expect(uploadEndpoint('demo')).toBe('https://api.cloudinary.com/v1_1/demo/image/upload');
    expect(uploadEndpoint('demo', 'auto')).toBe('https://api.cloudinary.com/v1_1/demo/auto/upload');
  });
});
