import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from any HTTPS host — needed because raffle image_url is
  // admin-entered and can point to Steam CDN, Reddit, Imgur, Supabase, etc.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
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
