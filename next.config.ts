import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "extravert.ru" },
      { protocol: "https", hostname: "swisskrono.ru" },
      { protocol: "https", hostname: "www.agtwood.ru" },
      { protocol: "https", hostname: "agtwood.ru" },
      { protocol: "https", hostname: "www.agtwood.com" },
      { protocol: "https", hostname: "agtwood.com" },
      { protocol: "https", hostname: "nuomihome.com" },
      { protocol: "https", hostname: "www.nuomihome.com" },
      { protocol: "https", hostname: "cheapollo.ru" },
      { protocol: "https", hostname: "www.cheapollo.ru" },
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
