import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'loremflickr.com',
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry org and project — set via SENTRY_ORG and SENTRY_PROJECT env vars
  org: process.env.SENTRY_ORG ?? '',
  project: process.env.SENTRY_PROJECT ?? '',

  // Suppress build-time Sentry output for cleaner CI logs
  silent: true,

  // Prevent source map leakage to public bundle
  hideSourceMaps: true,

  // Remove Sentry logger from bundle when not configured (smaller bundle)
  disableLogger: true,
});
