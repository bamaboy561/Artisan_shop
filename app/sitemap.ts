import type { MetadataRoute } from "next";

import { absoluteUrl, canonicalUrl } from "@/lib/seo";
import { getBrandProfiles } from "@/features/brands/data";
import {
  getPublicCategories,
  getPublicProducts,
} from "@/lib/server/catalog-public";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products, brands] = await Promise.all([
    getPublicCategories().catch(() => []),
    getPublicProducts().catch(() => []),
    getBrandProfiles().catch(() => []),
  ]);
  const staticRoutes = [
    { path: "/", priority: 1, changeFrequency: "weekly" as const },
    { path: "/catalog", priority: 0.95, changeFrequency: "daily" as const },
    { path: "/calculator", priority: 0.9, changeFrequency: "monthly" as const },
    { path: "/services", priority: 0.88, changeFrequency: "monthly" as const },
    { path: "/brands", priority: 0.84, changeFrequency: "weekly" as const },
    { path: "/about", priority: 0.72, changeFrequency: "monthly" as const },
    { path: "/contacts", priority: 0.78, changeFrequency: "monthly" as const },
    { path: "/privacy", priority: 0.2, changeFrequency: "yearly" as const },
    { path: "/terms", priority: 0.2, changeFrequency: "yearly" as const },
  ];
  const now = new Date();

  return [
    ...staticRoutes.map((route) => ({
      url: canonicalUrl(route.path),
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...categories.map((category) => ({
      url: canonicalUrl(`/catalog/${category.slug}`),
      lastModified: category.updatedAt ?? now,
      changeFrequency: "daily" as const,
      priority: 0.9,
      images: category.coverImage ? [absoluteUrl(category.coverImage)] : undefined,
    })),
    ...products.map((product) => ({
      url: canonicalUrl(`/product/${product.slug}`),
      lastModified: product.updatedAt ?? now,
      changeFrequency: "weekly" as const,
      priority: 0.82,
      images: (product.gallery.length > 0 ? product.gallery : [product.image])
        .filter(Boolean)
        .slice(0, 4)
        .map((image) => absoluteUrl(image)),
    })),
    ...brands.map((brand) => ({
      url: canonicalUrl(`/brands/${brand.slug}`),
      lastModified: brand.updatedAt ?? now,
      changeFrequency:
        brand.contentStatus === "active" ? ("weekly" as const) : ("monthly" as const),
      priority: brand.contentStatus === "active" ? 0.76 : 0.48,
      images: brand.logoUrl ? [absoluteUrl(brand.logoUrl)] : undefined,
    })),
  ];
}
