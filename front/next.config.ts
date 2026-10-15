import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000/api';

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      {
        source: '/api/ws',
        destination: `${backendUrl}/api/ws`,
      },
    ];
  },
};

export default nextConfig;
