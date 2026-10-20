import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.MARSBANK_NEXT_DIST_DIR || ".next",
  // Demos are often opened via the LAN address; without this, next dev blocks
  // its JS chunks for that origin and the page never hydrates.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
