import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'api.familysearch.org' },
      { protocol: 'https', hostname: 'www.wikitree.com' },
    ],
  },
};

export default nextConfig;
