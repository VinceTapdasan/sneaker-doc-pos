import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Add image domains and other config as needed
  transpilePackages: ['@react-pdf/renderer'],

  // Prevent CDN (Google Frontend) from caching HTML pages.
  // Without this, s-maxage=31536000 causes stale HTML to be served
  // after deploys — the CDN serves old HTML referencing old JS chunks.
  headers: async () => [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'private, no-cache, no-store, max-age=0, must-revalidate',
        },
      ],
    },
  ],
};

export default nextConfig;
