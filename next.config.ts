import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/admin/products/photo-catalog": [
      "./public/fonts/NotoSans-Regular.ttf",
      "./public/fonts/NotoSans-Bold.ttf",
      "./public/**/*",
    ],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
    ];
  },
  experimental: {
    proxyClientMaxBodySize: "500mb",
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2_592_000,
    remotePatterns: [
      { protocol: "https", hostname: "amix-tk.ru" },
      { protocol: "https", hostname: "avatars.mds.yandex.net" },
      { protocol: "https", hostname: "emaks.com.tr" },
      { protocol: "https", hostname: "extravert.ru" },
      { protocol: "https", hostname: "hru-site-media.storage.yandexcloud.net" },
      { protocol: "https", hostname: "i.pinimg.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "kitchen.slotex.com" },
      { protocol: "https", hostname: "mebelshik.biz" },
      { protocol: "https", hostname: "nt73.ru", pathname: "/userfiles/**" },
      { protocol: "https", hostname: "nuomi-us.oss-us-west-1.aliyuncs.com" },
      { protocol: "https", hostname: "nuomishop.ru" },
      { protocol: "https", hostname: "pan-invest.com" },
      { protocol: "https", hostname: "princip96.ru" },
      { protocol: "https", hostname: "sc04.alicdn.com" },
      { protocol: "https", hostname: "swisskrono.ru" },
      { protocol: "https", hostname: "www.agtwood.ru" },
      { protocol: "https", hostname: "agtwood.ru" },
      { protocol: "https", hostname: "www.agtwood.com" },
      { protocol: "https", hostname: "agtwood.com" },
      { protocol: "https", hostname: "nuomihome.com" },
      { protocol: "https", hostname: "www.nuomihome.com" },
      { protocol: "https", hostname: "shop.hettich.com" },
      { protocol: "https", hostname: "img.edilportale.com" },
      { protocol: "https", hostname: "cheapollo.ru" },
      { protocol: "https", hostname: "www.cheapollo.ru" },
      { protocol: "https", hostname: "smart812.ru" },
      { protocol: "https", hostname: "tdmspb.ru" },
      { protocol: "https", hostname: "th.bing.com" },
      { protocol: "https", hostname: "tse1.explicit.bing.net" },
      { protocol: "https", hostname: "tse3.mm.bing.net" },
      { protocol: "https", hostname: "w230203-807.cdn.webasyst.cloud" },
      { protocol: "https", hostname: "www.italianaferramenta.it" },
      { protocol: "https", hostname: "italianaferramenta.it" },
      { protocol: "https", hostname: "www.liamax.com" },
      { protocol: "https", hostname: "www.shkaffcity.ru" },
      { protocol: "https", hostname: "www.tdserver.ru" },
      { protocol: "https", hostname: "www.yapikatalogu.com" },
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
