import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Product uploads come from Cloudinary. Editorial and placeholder
    // photography comes from Unsplash until real Shrinkless shots exist —
    // see lib/brand/images.ts. Nothing else is an allowed remote source.
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      // Instagram serves post media from a rotating pool of edge hosts —
      // scontent-lhr8-1.cdninstagram.com and the like — so the subdomain
      // cannot be pinned. See lib/brand/instagram.ts.
      { protocol: "https", hostname: "**.cdninstagram.com", pathname: "/**" },
      { protocol: "https", hostname: "**.fbcdn.net", pathname: "/**" },
    ],

    // Next's optimizer is off on purpose, and this is the fix for the hero
    // frames that used to take twenty seconds or render blank.
    //
    // Both remote sources are transforming CDNs, and every URL this app builds
    // already carries its own size, crop and quality instructions —
    // `frame()` in lib/brand/images.ts and `imageUrl()` in lib/images.ts. So
    // /_next/image was fetching an already-correct rendition, decoding it and
    // re-encoding it for no gain.
    //
    // The cost was severe rather than merely wasteful. A cold Unsplash
    // transform of one of these originals takes 10-35 seconds; Next allows an
    // upstream 7, so the optimizer returned a 500 and the frame stayed blank
    // until Unsplash happened to have that rendition cached. Serving the CDN
    // URL directly hands the wait to the CDN, which streams progressively and
    // caches at the edge, instead of to a serverless function with a stopwatch
    // on it.
    unoptimized: true,
  },
};

export default nextConfig;
