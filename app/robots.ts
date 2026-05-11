import type { MetadataRoute } from "next";

import { canonicalUrl, getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/account/",
          "/api/",
          "/login",
          "/register",
          "/cart",
          "/checkout",
        ],
      },
    ],
    sitemap: canonicalUrl("/sitemap.xml"),
    host: getSiteUrl(),
  };
}
