import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from merchant URLs (hosted externally)
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "**" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
