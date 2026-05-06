import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "extravert.ru" },
      { protocol: "https", hostname: "swisskrono.ru" },
      { protocol: "https", hostname: "www.agtwood.ru" },
    ],
  },
};

export default nextConfig;
