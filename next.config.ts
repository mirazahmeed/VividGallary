import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow Next.js Image to optimize local stream URLs
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    // Cache optimized images for 1 hour
    minimumCacheTTL: 3600,
    // Responsive breakpoints
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [128, 256, 384],
    // Use webp for best compression
    formats: ["image/webp"],
  },
};

export default nextConfig;
