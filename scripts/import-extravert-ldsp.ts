import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_SITEMAP_URL =
  "https://extravert.ru/wp-sitemap-posts-product-1.xml";
const OUTPUT_ROOT = path.resolve(
  process.cwd(),
  "data",
  "imports",
  "extravert-ldsp",
);
const IMAGE_ROOT = path.join(OUTPUT_ROOT, "images");
const BRAND_NAME = "EXTRAVERT";
const CATEGORY_NAME = "ЛДСП";
const REQUEST_DELAY_MS = 200;

type CliOptions = {
  limit?: number;
  downloadImages: boolean;
};

type ImportedImage = {
  sourceUrl: string;
  localPath: string | null;
};

type ImportedProduct = {
  slug: string;
  sourceUrl: string;
  sourceUpdatedAt: string | null;
  brandName: string;
  categoryName: string;
  title: string;
  name: string;
  sku: string;
  description: string;
  properties: Record<string, string>;
  widthMm: number | null;
  lengthMm: number | null;
  thicknessMm: number[];
  emissionClasses: string[];
  images: ImportedImage[];
};

type ImportResult = {
  generatedAt: string;
  sourceSitemapUrl: string;
  totalDiscoveredUrls: number;
  totalExportedProducts: number;
  products: ImportedProduct[];
};

async function main() {
  const options = parseArgs(process.argv.slice(2));

  await mkdir(OUTPUT_ROOT, { recursive: true });
  await mkdir(IMAGE_ROOT, { recursive: true });

  console.log(`Fetching sitemap: ${SOURCE_SITEMAP_URL}`);
  const sitemapXml = await fetchText(SOURCE_SITEMAP_URL);
  const discoveredUrls = extractUrlsFromSitemap(sitemapXml).filter((url) =>
    /\/catalog\/ldsp-/i.test(url),
  );

  const targetUrls =
    typeof options.limit === "number"
      ? discoveredUrls.slice(0, options.limit)
      : discoveredUrls;

  console.log(
    `Found ${discoveredUrls.length} LDSP product pages. Processing ${targetUrls.length}.`,
  );

  const products: ImportedProduct[] = [];

  for (const [index, url] of targetUrls.entries()) {
    console.log(`[${index + 1}/${targetUrls.length}] ${url}`);
    const html = await fetchText(url);
    const product = await parseProductPage(url, html, options.downloadImages);

    products.push(product);
    await delay(REQUEST_DELAY_MS);
  }

  const result: ImportResult = {
    generatedAt: new Date().toISOString(),
    sourceSitemapUrl: SOURCE_SITEMAP_URL,
    totalDiscoveredUrls: discoveredUrls.length,
    totalExportedProducts: products.length,
    products,
  };

  const catalogPath = path.join(OUTPUT_ROOT, "catalog.json");
  await writeFile(catalogPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  console.log(`Saved catalog export: ${catalogPath}`);
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

async function parseProductPage(
  sourceUrl: string,
  html: string,
  downloadImages: boolean,
): Promise<ImportedProduct> {
  const slug = getSlugFromUrl(sourceUrl);
  const title = decodeHtml(
    extractMatch(html, /<title>([\s\S]*?)<\/title>/i) ?? "",
  );
  const name = normalizeWhitespace(
    stripTags(
      extractMatch(
        html,
        /<h1[^>]*class="product-title"[^>]*>([\s\S]*?)<\/h1>/i,
      ) ?? "",
    ),
  );
  const sku = normalizeWhitespace(
    stripTags(
      extractMatch(
        html,
        /<div[^>]*class="product-sku on-post"[^>]*>([\s\S]*?)<\/div>/i,
      ) ?? "",
    ),
  );
  const sourceUpdatedAt = extractMatch(
    html,
    /<meta property="og:updated_time" content="([^"]+)"/i,
  );
  const descriptionHtml =
    extractMatch(
      html,
      /<div class="product-subtitle">Описание<\/div>\s*<div class="rich-text-block w-richtext"><div class="wprt-container">([\s\S]*?)<\/div><\/div>/i,
    ) ?? "";
  const description = normalizeWhitespace(stripTags(descriptionHtml));
  const properties = extractProperties(html);
  const galleryUrls = extractGalleryUrls(html);

  const images: ImportedImage[] = [];

  for (const [index, imageUrl] of galleryUrls.entries()) {
    let localPath: string | null = null;

    if (downloadImages) {
      localPath = await downloadImage(imageUrl, slug, index);
    }

    images.push({
      sourceUrl: imageUrl,
      localPath,
    });
  }

  return {
    slug,
    sourceUrl,
    sourceUpdatedAt,
    brandName: BRAND_NAME,
    categoryName: CATEGORY_NAME,
    title,
    name,
    sku,
    description,
    properties,
    widthMm: parseNumber(properties["Ширина, мм"]),
    lengthMm: parseNumber(properties["Длина, мм"]),
    thicknessMm: parseNumberList(properties["Толщина, мм"]),
    emissionClasses: parseEmissionClasses(properties["Эмиссия"]),
    images,
  };
}

async function downloadImage(
  imageUrl: string,
  productSlug: string,
  imageIndex: number,
) {
  const extension = path.extname(new URL(imageUrl).pathname) || ".jpg";
  const productImageDir = path.join(IMAGE_ROOT, productSlug);
  const fileName = `${String(imageIndex + 1).padStart(2, "0")}${extension}`;
  const absoluteFilePath = path.join(productImageDir, fileName);
  const relativeFilePath = path
    .relative(OUTPUT_ROOT, absoluteFilePath)
    .replaceAll(path.sep, "/");

  await mkdir(productImageDir, { recursive: true });

  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Failed to download image ${imageUrl}: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await writeFile(absoluteFilePath, Buffer.from(arrayBuffer));

  return relativeFilePath;
}

function extractUrlsFromSitemap(xml: string) {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) =>
    decodeHtml(match[1] ?? ""),
  );
}

function extractProperties(html: string) {
  const properties: Record<string, string> = {};
  const propertiesBlock =
    extractMatch(
      html,
      /<ul role="list" class="property-items">([\s\S]*?)<\/ul>/i,
    ) ?? "";
  const items = propertiesBlock.matchAll(
    /<li class="property-item">([\s\S]*?)<\/li>/gi,
  );

  for (const item of items) {
    const cells = [...(item[1] ?? "").matchAll(/<div[^>]*>([\s\S]*?)<\/div>/gi)]
      .map((cell) => normalizeWhitespace(stripTags(cell[1] ?? "")))
      .filter(Boolean);

    if (cells.length >= 2) {
      properties[cells[0]] = cells[1];
    }
  }

  return properties;
}

function extractGalleryUrls(html: string) {
  const urls = [
    ...html.matchAll(/<a[^>]*data-fancybox="gallery"[^>]*href="([^"]+)"/gi),
  ]
    .map((match) => decodeHtml(match[1] ?? ""))
    .filter(Boolean);

  return Array.from(new Set(urls));
}

function getSlugFromUrl(url: string) {
  const pathname = new URL(url).pathname.split("/").filter(Boolean);

  return pathname.at(-1) ?? "unknown-product";
}

function parseNumber(value: string | undefined) {
  if (!value) {
    return null;
  }

  const normalizedValue = value.replace(",", ".").match(/-?\d+(?:\.\d+)?/);

  if (!normalizedValue) {
    return null;
  }

  return Number.parseFloat(normalizedValue[0]);
}

function parseNumberList(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => parseNumber(item))
    .filter((item): item is number => typeof item === "number");
}

function parseEmissionClasses(value: string | undefined) {
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(value.match(/[A-Za-zА-Яа-яЁё]\d(?:[.,]\d+)?/g) ?? []),
  );
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
