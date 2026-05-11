import type { Metadata } from "next";

import type { CatalogCategory, FeaturedProduct } from "@/features/catalog/types";
import {
  companyBranches,
  companyContacts,
  companyName,
  primaryNavigation,
} from "@/lib/site-config";

export type JsonLdData = Record<string, unknown>;

const fallbackSiteUrl = "https://artisan-shop-vercel.vercel.app";
const locale = "ru_KG";
const defaultOgImage = "/opengraph-image";

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const rawUrl = configuredUrl || fallbackSiteUrl;
  const withProtocol = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  return stripTrailingSlash(withProtocol);
}

export function absoluteUrl(path = "/") {
  try {
    return new URL(path).toString();
  } catch {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return new URL(normalizedPath, `${getSiteUrl()}/`).toString();
  }
}

export function canonicalPath(path = "/") {
  if (!path || path === "/") return "/";
  return `/${path.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

export function canonicalUrl(path = "/") {
  return absoluteUrl(canonicalPath(path));
}

export const indexRobots: Metadata["robots"] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
};

export const noIndexRobots: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
  },
};

type SeoMetadataInput = {
  title: string;
  description: string;
  path: string;
  images?: string[];
  robots?: Metadata["robots"];
};

export function createSeoMetadata({
  title,
  description,
  path,
  images = [defaultOgImage],
  robots = indexRobots,
}: SeoMetadataInput): Metadata {
  const canonical = canonicalPath(path);
  const imageUrls = images.filter(Boolean).map((image) => absoluteUrl(image));

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    robots,
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: companyName,
      locale,
      type: "website",
      images: imageUrls.map((url) => ({
        url,
        width: 1200,
        height: 630,
        alt: `${companyName} — ${title}`,
      })),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrls,
    },
  };
}

function normalizeText(value: string | null | undefined, fallback: string) {
  const text = value?.replace(/\s+/g, " ").trim();
  return text && text.length > 0 ? text : fallback;
}

export function organizationJsonLd(): JsonLdData {
  const branch = companyBranches[0];

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${getSiteUrl()}/#organization`,
        name: companyName,
        url: getSiteUrl(),
        email: companyContacts.email,
        telephone: companyContacts.phone,
        address: {
          "@type": "PostalAddress",
          addressLocality: "Бишкек",
          streetAddress: branch?.address ?? companyContacts.address,
          addressCountry: "KG",
        },
        contactPoint: {
          "@type": "ContactPoint",
          telephone: companyContacts.phone,
          contactType: "sales",
          areaServed: "KG",
          availableLanguage: ["ru"],
        },
      },
      {
        "@type": "WebSite",
        "@id": `${getSiteUrl()}/#website`,
        name: companyName,
        url: getSiteUrl(),
        publisher: {
          "@id": `${getSiteUrl()}/#organization`,
        },
        inLanguage: "ru",
        potentialAction: {
          "@type": "SearchAction",
          target: `${getSiteUrl()}/catalog?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "SiteNavigationElement",
        "@id": `${getSiteUrl()}/#navigation`,
        name: primaryNavigation.map((item) => item.label),
        url: primaryNavigation.map((item) => absoluteUrl(item.href)),
      },
    ],
  };
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; href: string }>,
): JsonLdData {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.href),
    })),
  };
}

export function productJsonLd(product: FeaturedProduct): JsonLdData {
  const description = normalizeText(
    product.description || product.summary,
    `${product.name} ${product.brand}`.trim(),
  );
  const images = (product.gallery.length > 0 ? product.gallery : [product.image])
    .filter(Boolean)
    .map((image) => absoluteUrl(image));
  const data: JsonLdData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": canonicalUrl(`/product/${product.slug}`),
    name: product.name,
    description,
    sku: product.sku,
    image: images,
    url: canonicalUrl(`/product/${product.slug}`),
    category: product.categoryName,
    brand: product.brand
      ? {
          "@type": "Brand",
          name: product.brand,
        }
      : undefined,
  };

  if (typeof product.price === "number") {
    data.offers = {
      "@type": "Offer",
      url: canonicalUrl(`/product/${product.slug}`),
      priceCurrency: "KGS",
      price: product.price,
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/PreOrder",
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@id": `${getSiteUrl()}/#organization`,
      },
    };
  }

  return data;
}

export function collectionJsonLd({
  name,
  description,
  path,
  products,
}: {
  name: string;
  description: string;
  path: string;
  products: FeaturedProduct[];
}): JsonLdData {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    description,
    url: canonicalUrl(path),
    numberOfItems: products.length,
    itemListElement: products.slice(0, 24).map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: canonicalUrl(`/product/${product.slug}`),
      name: product.name,
      image: product.image ? absoluteUrl(product.image) : undefined,
    })),
  };
}

export function categoryDescription(category: CatalogCategory) {
  return normalizeText(
    category.seoDescription || category.summary || category.description,
    `${category.name}: материалы Artisan, подбор, наличие и запрос цены.`,
  );
}

export function productDescription(product: FeaturedProduct) {
  return normalizeText(
    product.seoDescription || product.summary || product.description,
    `${product.name} ${product.brand}: характеристики, формат, наличие и запрос цены в Artisan.`,
  );
}
