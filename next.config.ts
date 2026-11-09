import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  reactStrictMode: true,
  // (the dev badge sits on "Reduce motion" in the page's corner)
  devIndicators: false,
};

export default nextConfig;
