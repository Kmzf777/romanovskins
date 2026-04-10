import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from Steam CDN and other known image hosts
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'steamcommunity-a.akamaihd.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.steamstatic.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'owwvqqvrhhjswehkarse.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  // Security headers for all responses
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },

  // Suppress powered-by header
  poweredByHeader: false,
};

export default nextConfig;
