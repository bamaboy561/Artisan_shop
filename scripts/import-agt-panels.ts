import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUTPUT_ROOT = path.resolve(
  process.cwd(),
  "data",
  "imports",
  "agt-panels",
);
const IMAGE_ROOT = path.join(OUTPUT_ROOT, "images");
const BRAND_NAME = "AGT";
const CATEGORY_NAME = "Декоративные мебельные панели";
const REQUEST_DELAY_MS = 160;

const COLLECTIONS = [
  {
    slug: "trendy-panel",
    sourceUrl: "https://www.agtwood.ru/products/panel/panel/trendy-panel",
    collectionName: "Trendy Panel",
  },
  {
    slug: "supramat-panel",
    sourceUrl: "https://www.agtwood.ru/products/panel/panel/supramat-panel",
    collectionName: "Supramat Panel",
  },
] as const;

type CliOptions = {
  limit?: number;
  downloadImages: boolean;
};

type ImportedImage = {
  sourceUrl: string;
  localPath: string | null;
};

type ImportedCollection = {
  slug: string;
  name: string;
  title: string;
  sourceUrl: string;
  previewImageUrl: string | null;
  totalDiscoveredProducts: number;
  totalExportedProducts: number;
};

type ImportedProduct = {
  slug: string;
  sourceUrl: string;
  sourceCollectionUrl: string;
  brandName: string;
  categoryName: string;
  collectionSlug: string;
  collectionName: string;
  collectionTitle: string;
  title: string;
  name: string;
  sku: string;
  description: string;
  tags: string[];
  previewImageUrl: string | null;
  images: ImportedImage[];
};

type ImportResult = {
  generatedAt: string;
  totalExportedProducts: number;
  collections: ImportedCollection[];
  products: ImportedProduct[];
};

type CollectionDefinition = (typeof COLLECTIONS)[number];

type ParsedCollection = {
  slug: string;
  sourceUrl: string;
  collectionName: string;
  collectionTitle: string;
  previewImageUrl: string | null;
  productUrls: string[];
};

async function main() {
  const options = parseArgs(process.argv.slice(2));

  await mkdir(OUTPUT_ROOT, { recursive: true });
  await mkdir(IMAGE_ROOT, { recursive: true });

  const parsedCollections: ParsedCollection[] = [];

  for (const collection of COLLECTIONS) {
    console.log(`Fetching collection: ${collection.sourceUrl}`);
    const html = await fetchText(collection.sourceUrl);

    parsedCollections.push(parseCollectionPage(collection, html));
    await delay(REQUEST_DELAY_MS);
  }

  const discoveredProducts = parsedCollections.flatMap((collection) =>
    collection.productUrls.map((productUrl) => ({
      collection,
      productUrl,
    })),
  );
  const targetProducts =
    typeof options.limit === "number"
      ? discoveredProducts.slice(0, options.limit)
      : discoveredProducts;

  console.log(
    `Found ${discoveredProducts.length} AGT panel products. Processing ${targetProducts.length}.`,
  );

  const products: ImportedProduct[] = [];

  for (const [index, item] of targetProducts.entries()) {
    console.log(
      `[${index + 1}/${targetProducts.length}] ${item.collection.collectionName}: ${item.productUrl}`,
    );

    const html = await fetchText(item.productUrl);
    const product = await parseProductPage({
      collection: item.collection,
      html,
      productUrl: item.productUrl,
      downloadImages: options.downloadImages,
    });

    products.push(product);
    await delay(REQUEST_DELAY_MS);
  }

  const collections: ImportedCollection[] = parsedCollections.map(
    (collection) => ({
      slug: collection.slug,
      name: collection.collectionName,
      title: collection.collectionTitle,
      sourceUrl: collection.sourceUrl,
      previewImageUrl: collection.previewImageUrl,
      totalDiscoveredProducts: collection.productUrls.length,
      totalExportedProducts: products.filter(
        (product) => product.collectionSlug === collection.slug,
      ).length,
    }),
  );

  const result: ImportResult = {
    generatedAt: new Date().toISOString(),
    totalExportedProducts: products.length,
    collections,
    products,
  };

  const catalogPath = path.join(OUTPUT_ROOT, "catalog.json");
  await writeFile(catalogPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  console.log(`Saved AGT export: ${catalogPath}`);
  console.log(
    `Image downloads: ${options.downloadImages ? "enabled" : "disabled"}`,
  );
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    downloadImages: true,
  };

  for (const arg of args) {
    if (arg.startsWith("--limit=")) {
      const rawValue = arg.split("=")[1];
      const parsedValue = Number.parseInt(rawValue ?? "", 10);

      if (!Number.isNaN(parsedValue) && parsedValue > 0) {
        options.limit = parsedValue;
      }
    }

    if (arg === "--no-images") {
      options.downloadImages = false;
    }
  }

  return options;
}

function parseCollectionPage(
  collection: CollectionDefinition,
  html: string,
): ParsedCollection {
  const collectionTitle = normalizeWhitespace(
    stripTags(extractMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) ?? ""),
  );
  const previewImageUrl =
    toAbsoluteUrl(extractMetaContent(html, "og:image")) ?? null;

  const productPathExpression = new RegExp(
    `/products/panel/panel/${escapeRegExp(collection.slug)}/[^"\\s<>]+`,
    "gi",
  );
  const productUrls = Array.from(
    new Set(
      [...html.matchAll(productPathExpression)]
        .map((match) => toAbsoluteUrl(match[0]))
        .filter((url): url is string => Boolean(url)),
    ),
  );

  return {
    slug: collection.slug,
    sourceUrl: collection.sourceUrl,
    collectionName: collection.collectionName,
    collectionTitle,
    previewImageUrl,
    productUrls,
  };
}

async function parseProductPage(options: {
  collection: ParsedCollection;
  html: string;
  productUrl: string;
  downloadImages: boolean;
}): Promise<ImportedProduct> {
  const { collection, html, productUrl, downloadImages } = options;
  const slug = getSlugFromUrl(productUrl);
  const title = normalizeWhitespace(
    stripTags(extractMatch(html, /<title>([\s\S]*?)<\/title>/i) ?? ""),
  ).replace(/\s+\|\s+AGT$/i, "");
  const heading = normalizeWhitespace(
    stripTags(extractMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) ?? ""),
  );
  const sku =
    heading.match(/(\d{3,6})(?!.*\d)/)?.[1] ??
    title.match(/(\d{3,6})(?!.*\d)/)?.[1] ??
    "";
  const name = title.trim();
  const description = normalizeWhitespace(
    stripTags(
      extractMatch(
        html,
        /<div class="mt-3 text-s full-text">([\s\S]*?)<\/div><div class=mb-5>/i,
      ) ??
        extractMatch(
          html,
          /<div class="mt-3 text-s short-text">([\s\S]*?)<\/div>/i,
        ) ??
        "",
    ),
  );
  const tags = extractTags(html);
  const previewImageUrl =
    toAbsoluteUrl(extractMetaContent(html, "og:image")) ?? null;
  const galleryUrls = extractGalleryUrls(html);
  const imageUrls = uniqueStrings(
    [previewImageUrl, ...galleryUrls].filter((imageUrl): imageUrl is string =>
      Boolean(imageUrl),
    ),
  );
  const images: ImportedImage[] = [];

  for (const [index, imageUrl] of imageUrls.entries()) {
    let localPath: string | null = null;

    if (downloadImages) {
      try {
        localPath = await downloadImage(imageUrl, slug, index);
        await delay(REQUEST_DELAY_MS);
      } catch (error) {
        console.warn(
          `Skipping image download for ${productUrl}: ${imageUrl} (${String(
            error,
          )})`,
        );
      }
    }

    images.push({
      sourceUrl: imageUrl,
      localPath,
    });
  }

  return {
    slug: `agt-${collection.slug}-${slug}`,
    sourceUrl: productUrl,
    sourceCollectionUrl: collection.sourceUrl,
    brandName: BRAND_NAME,
    categoryName: CATEGORY_NAME,
    collectionSlug: collection.slug,
    collectionName: collection.collectionName,
    collectionTitle: collection.collectionTitle,
    title: `${collection.collectionName} ${name}`.trim(),
    name,
    sku,
    description,
    tags,
    previewImageUrl,
    images,
  };
}

function extractTags(html: string) {
  const tagsBlock =
    extractMatch(
      html,
      /<div class="tags my-3">([\s\S]*?)<\/div>\s*<div class="page-content/i,
    ) ?? "";

  return [...tagsBlock.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi)]
    .map((match) => normalizeWhitespace(stripTags(match[1] ?? "")))
    .filter(Boolean);
}

function extractGalleryUrls(html: string) {
  const productDetailSection =
    extractMatch(
      html,
      /<div class="product-detail-hero-slider swiper d-none d-lg-block"><div class=swiper-wrapper>([\s\S]*?)<div class=product-detail-hero-eye>/i,
    ) ?? "";

  return uniqueStrings(
    [...productDetailSection.matchAll(/<img[^>]*src=([^\s>]+)[^>]*>/gi)]
      .map((match) => match[1]?.replace(/['"]/g, "") ?? "")
      .filter((src) => src.includes("/Product/Image/"))
      .map((src) => toAbsoluteUrl(src))
      .filter((url): url is string => Boolean(url))
      .filter(isValidProductImageUrl)
      .filter((url) => !url.endsWith("/Product/Image/")),
  );
}

function extractMetaContent(html: string, property: string) {
  const expression = new RegExp(
    `<meta[^>]+property=(?:"|')?${escapeRegExp(property)}(?:"|')?[^>]+content=(?:"|')?([^"'>\\s]+)(?:"|')?`,
    "i",
  );

  return extractMatch(html, expression);
}

async function downloadImage(
  imageUrl: string,
  productSlug: string,
  imageIndex: number,
) {
  const extension = getFileExtension(imageUrl);
  const productImageDir = path.join(IMAGE_ROOT, productSlug);
  const fileName = `${String(imageIndex + 1).padStart(2, "0")}${extension}`;
  const absoluteFilePath = path.join(productImageDir, fileName);
  const relativeFilePath = path
    .relative(OUTPUT_ROOT, absoluteFilePath)
    .replaceAll(path.sep, "/");

  await mkdir(productImageDir, { recursive: true });

  const response = await fetch(imageUrl, {
    headers: {
      "user-agent": "ArtisanPro Importer/1.0 (+https://artisan.local)",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download image ${imageUrl}: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await writeFile(absoluteFilePath, Buffer.from(arrayBuffer));

  return relativeFilePath;
}

function getFileExtension(url: string) {
  try {
    const extension = path.extname(new URL(url).pathname);
    return extension || ".jpg";
  } catch {
    return ".jpg";
  }
}

function getSlugFromUrl(url: string) {
  const pathname = new URL(url).pathname.split("/").filter(Boolean);
  return pathname.at(-1) ?? "unknown-product";
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function toAbsoluteUrl(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  try {
    return new URL(url, "https://www.agtwood.ru").toString();
  } catch {
    return null;
  }
}

function isValidProductImageUrl(url: string) {
  return /\/Product\/Image\/[a-z0-9-]+$/i.test(url);
}

function extractMatch(input: string, expression: RegExp) {
  const match = input.match(expression);
  return match?.[1] ?? null;
}

function stripTags(value: string) {
  return decodeHtml(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&laquo;", "«")
    .replaceAll("&raquo;", "»")
    .replaceAll("&ndash;", "–")
    .replaceAll("&mdash;", "—");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "ArtisanPro Importer/1.0 (+https://artisan.local)",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

async function delay(ms: number) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
