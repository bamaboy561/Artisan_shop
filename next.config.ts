import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "extravert.ru" },
      { protocol: "https", hostname: "swisskrono.ru" },
      { protocol: "https", hostname: "www.agtwood.ru" },
    ],
  },
};

export default nextConfig;
