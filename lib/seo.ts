import type { Metadata } from "next";

import type {
  CatalogCategory,
  FeaturedProduct,
} from "@/features/catalog/types";
import {
  type CompanyBranch,
  companyBranches,
  companyContacts,
  companyName,
  primaryNavigation,
} from "@/lib/site-config";

export type JsonLdData = Record<string, unknown>;

const fallbackSiteUrl = "https://artisan.shop.kg";
const locale = "ru_KG";
const defaultOgImage = "/opengraph-image";
const localMarket = "Бишкеке";
const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

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

function truncateText(value: string, maxLength = 170) {
  const text = value.replace(/\s+/g, " ").trim();

  if (text.length <= maxLength) {
    return text;
  }

  const candidate = text.slice(0, maxLength - 1);
  const lastSpace = candidate.lastIndexOf(" ");
  const cutAt = lastSpace > maxLength * 0.62 ? lastSpace : candidate.length;

  return `${candidate.slice(0, cutAt).trim()}…`;
}

function sentencePreview(value: string, maxLength = 112) {
  const text = value.replace(/\s+/g, " ").trim();

  if (text.length <= maxLength) {
    return text;
  }

  const firstSentence = text.match(/^.{42,}?[.!?](?=\s|$)/u)?.[0];

  if (firstSentence && firstSentence.length <= maxLength) {
    return firstSentence;
  }

  return truncateText(text, maxLength);
}

function formatHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function openingHoursSpecification(branch: CompanyBranch) {
  return branch.schedule.map((schedule) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: schedule.days.map((day) => dayNames[day]),
    opens: formatHour(schedule.open),
    closes: formatHour(schedule.close),
  }));
}

export function organizationJsonLd(): JsonLdData {
  const branch = companyBranches[0];
  const logoUrl = absoluteUrl(defaultOgImage);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${getSiteUrl()}/#organization`,
        name: companyName,
        url: getSiteUrl(),
        logo: logoUrl,
        image: logoUrl,
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
        areaServed: [
          {
            "@type": "Country",
            name: "Кыргызстан",
          },
          {
            "@type": "City",
            name: "Бишкек",
          },
        ],
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
      ...companyBranches.map((companyBranch) => ({
        "@type": "HomeGoodsStore",
        "@id": `${getSiteUrl()}/#branch-${companyBranch.slug}`,
        name: `${companyName} — ${companyBranch.name}`,
        url: absoluteUrl("/contacts"),
        image: logoUrl,
        telephone: companyContacts.phone,
        email: companyContacts.email,
        priceRange: "KGS",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Бишкек",
          streetAddress: companyBranch.address,
          addressCountry: "KG",
        },
        openingHoursSpecification: openingHoursSpecification(companyBranch),
        hasMap: companyBranch.mapUrl,
        areaServed: {
          "@type": "City",
          name: "Бишкек",
        },
        parentOrganization: {
          "@id": `${getSiteUrl()}/#organization`,
        },
      })),
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
  const images = (
    product.gallery.length > 0 ? product.gallery : [product.image]
  )
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

export function categorySeoTitle(category: CatalogCategory) {
  return (
    category.seoTitle?.trim() ||
    `${category.name} в Бишкеке — каталог, наличие и распил`
  );
}

export function categorySeoDescription(category: CatalogCategory) {
  const description = category.seoDescription
    ? normalizeText(category.seoDescription, "")
    : `${categoryDescription(category)} Подбор, консультация, запрос цены и услуги распила в ${localMarket}.`;

  return truncateText(description);
}

export function productDescription(product: FeaturedProduct) {
  return normalizeText(
    product.seoDescription || product.summary || product.description,
    `${product.name} ${product.brand}: характеристики, формат, наличие и запрос цены в Artisan.`,
  );
}

export function productSeoTitle(product: FeaturedProduct) {
  if (product.seoTitle?.trim()) {
    return product.seoTitle;
  }

  const core = [product.name, product.brand, product.categoryName]
    .filter(Boolean)
    .join(" — ");

  return `${core} в ${localMarket}`;
}

export function productSeoDescription(product: FeaturedProduct) {
  if (product.seoDescription?.trim()) {
    return truncateText(product.seoDescription);
  }

  const base = normalizeText(
    product.summary || product.description,
    `${product.name} ${product.brand}: характеристики, формат и наличие.`,
  );
  const conciseBase = sentencePreview(base);
  const separator = /[.!?…]$/u.test(conciseBase) ? " " : ". ";
  const commercialTail =
    typeof product.price === "number"
      ? `Цена ${new Intl.NumberFormat("ru-RU").format(product.price)} сом. Консультация, заказ и распил в ${localMarket}.`
      : `Запрос цены, наличие, консультация и распил в ${localMarket}.`;

  return truncateText(`${conciseBase}${separator}${commercialTail}`);
}

type BrandSeoInput = {
  name: string;
  sectionName: string;
  headline: string;
  overview: string;
};

export function brandSeoTitle(brand: BrandSeoInput) {
  return `${brand.name}: ${brand.sectionName} в Бишкеке`;
}

export function brandSeoDescription(brand: BrandSeoInput) {
  return truncateText(
    `${brand.headline} ${brand.overview} Каталог, подбор, наличие и консультация Artisan в ${localMarket}.`,
  );
}
