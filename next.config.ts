import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.MARSBANK_NEXT_DIST_DIR || ".next",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
