import { describe, expect, it } from 'vitest';
import { loadCloudinaryEnv, signParams, signatureBase } from '@/lib/cloudinary/signature';
import { cloudinaryUrl } from '@/lib/cloudinary/url';

describe('signatureBase', () => {
  it('sorts parameters by key and joins them as a query string', () => {
    expect(signatureBase({ timestamp: 1700000000, folder: 'shrinkless/products' }))
      .toBe('folder=shrinkless/products&timestamp=1700000000');
  });

  it('omits the parameters Cloudinary excludes from the signature', () => {
    expect(signatureBase({ timestamp: 1, api_key: 'k', file: 'x', resource_type: 'image' }))
      .toBe('timestamp=1');
  });

  it('omits empty values', () => {
    expect(signatureBase({ timestamp: 1, folder: '' })).toBe('timestamp=1');
  });
});

describe('signParams', () => {
  it('produces the SHA-1 of the base string plus the secret', () => {
    const signature = signParams(
      { folder: 'shrinkless/products', timestamp: 1700000000 },
      'test-secret',
    );
    expect(signature).toBe('deae93466bf86c21c0563633710ae4077d1183e1');
  });

  it('changes when the secret changes', () => {
    const params = { timestamp: 1700000000 };
    expect(signParams(params, 'a')).not.toBe(signParams(params, 'b'));
  });
});

describe('loadCloudinaryEnv', () => {
  it('reads the three variables', () => {
    expect(loadCloudinaryEnv({
      CLOUDINARY_CLOUD_NAME: 'shrinkless',
      CLOUDINARY_API_KEY: '123',
      CLOUDINARY_API_SECRET: 'secret',
    } as unknown as NodeJS.ProcessEnv)).toEqual({
      cloudName: 'shrinkless', apiKey: '123', apiSecret: 'secret',
    });
  });

  it('names the missing variables when one is absent', () => {
    expect(() => loadCloudinaryEnv(
      { CLOUDINARY_CLOUD_NAME: 'shrinkless' } as unknown as NodeJS.ProcessEnv,
    ))
      .toThrow(/CLOUDINARY_API_KEY/);
  });
});

describe('cloudinaryUrl', () => {
  it('builds a delivery url with a transform', () => {
    expect(cloudinaryUrl('shrinkless/field-tee', 'w_120,c_fill', 'demo'))
      .toBe('https://res.cloudinary.com/demo/image/upload/w_120,c_fill/shrinkless/field-tee');
  });

  it('omits the transform segment when none is given', () => {
    expect(cloudinaryUrl('shrinkless/field-tee', undefined, 'demo'))
      .toBe('https://res.cloudinary.com/demo/image/upload/shrinkless/field-tee');
  });
});
