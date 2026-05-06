import type { MetadataRoute } from "next";

// TODO: Replace with your production domain
const BASE_URL = "https://artisan.kg";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "",
    "/catalog",
    "/calculator",
    "/services",
    "/brands",
    "/about",
    "/contacts",
    "/privacy",
    "/terms",
  ];

  return staticRoutes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1.0 : route === "/catalog" ? 0.9 : 0.7,
  }));
}
