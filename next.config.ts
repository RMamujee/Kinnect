import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    domains: ['api.familysearch.org', 'www.wikitree.com'],
  },
  experimental: {
    serverComponentsExternalPackages: [],
  },
};

export default nextConfig;
