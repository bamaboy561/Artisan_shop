import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/account/", "/login", "/register", "/checkout/"],
      },
    ],
    sitemap: "https://artisan.kg/sitemap.xml",
  };
}
