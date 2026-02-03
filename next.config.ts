import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },

  // Bundle optimization settings
  experimental: {
    // Tree-shake barrel file imports for smaller bundles
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "date-fns",
      "@radix-ui/react-icons",
      "recharts",
    ],
  },

  // Webpack optimizations for production builds
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Reduce bundle size by excluding server-only modules from client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    return config;
  },

  // Image optimization configuration
  images: {
    // Enable modern image formats for better compression
    formats: ["image/avif", "image/webp"],
    // Allow external image sources (Clerk user avatars)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "images.clerk.dev",
      },
    ],
    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    // Image sizes for the `sizes` attribute
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Minimum cache TTL for optimized images (1 week)
    minimumCacheTTL: 604800,
  },

  // Configure caching headers for static assets and security headers
  async headers() {
    return [
      {
        // Security headers for all routes
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.dev https://cdn.sentry-cdn.com https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' https: data: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.convex.cloud https://*.clerk.accounts.dev https://*.clerk.dev https://api.clerk.dev wss://*.convex.cloud",
              "frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.dev https://challenges.cloudflare.com",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
            ].join("; "),
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Static assets (fonts, images in _next/static)
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Public folder assets (SVGs, favicons, etc.)
        source: "/(.*).(svg|ico|png|jpg|jpeg|gif|webp|avif)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Font files
        source: "/(.*).(woff|woff2|ttf|otf|eot)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "ribo-e-business",
  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  tunnelRoute: "/monitoring",

  // Source maps configuration
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
