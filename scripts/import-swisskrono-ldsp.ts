import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_PAGE_URL = "https://swisskrono.ru/ldsp.html";
const OUTPUT_ROOT = path.resolve(
  process.cwd(),
  "data",
  "imports",
  "swisskrono-ldsp",
);
const IMAGE_ROOT = path.join(OUTPUT_ROOT, "images");
const STRUCTURE_IMAGE_ROOT = path.join(OUTPUT_ROOT, "structures");
const BRAND_NAME = "SWISS KRONO";
const CATEGORY_NAME = "ЛДСП";
const DECOR_GROUPS = new Set(["ОДНОТОННЫЕ", "ДИЗАЙН", "ДРЕВЕСНЫЕ"]);
const REQUEST_DELAY_MS = 120;

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
  sourcePageUrl: string;
  brandName: string;
  categoryName: string;
  decorGroup: string;
  isNew: boolean;
  title: string;
  name: string;
  sku: string;
  description: string;
  properties: Record<string, string>;
  widthMm: number | null;
  lengthMm: number | null;
  thicknessMm: number[];
  emissionClasses: string[];
  previewImageUrl: string | null;
  images: ImportedImage[];
};

type ImportedSurfaceStructure = {
  code: string;
  name: string;
  sourceUrl: string;
  previewUrl: string | null;
  localPath: string | null;
};

type ImportedDocument = {
  title: string;
  sourceUrl: string;
  label: string;
};

type ImportResult = {
  generatedAt: string;
  sourcePageUrl: string;
  pageTitle: string;
  totalExportedProducts: number;
  groupCounts: Array<{ name: string; count: number }>;
  documents: ImportedDocument[];
  surfaceStructures: ImportedSurfaceStructure[];
  products: ImportedProduct[];
};

async function main() {
  const options = parseArgs(process.argv.slice(2));

  await mkdir(OUTPUT_ROOT, { recursive: true });
  await mkdir(IMAGE_ROOT, { recursive: true });
  await mkdir(STRUCTURE_IMAGE_ROOT, { recursive: true });

  console.log(`Fetching page: ${SOURCE_PAGE_URL}`);
  const html = await fetchText(SOURCE_PAGE_URL);
  const pageTitle = normalizeWhitespace(
    stripTags(extractMatch(html, /<title>([\s\S]*?)<\/title>/i) ?? ""),
  );

  const parsedSections = parseDecorSections(html);
  const allProducts = parsedSections.flatMap((section) => section.products);
  const products =
    typeof options.limit === "number"
      ? allProducts.slice(0, options.limit)
      : allProducts;

  console.log(
    `Found ${allProducts.length} decor items across ${parsedSections.length} groups. Processing ${products.length}.`,
  );

  const structures = parseSurfaceStructures(html);
  const documents = parseDocuments(html);

  const exportedProducts: ImportedProduct[] = [];

  for (const [index, product] of products.entries()) {
    console.log(
      `[${index + 1}/${products.length}] ${product.sku} ${product.name}`,
    );

    let localPath: string | null = null;

    if (options.downloadImages) {
      localPath = await downloadImage(product.images[0]?.sourceUrl ?? "", {
        directory: path.join(IMAGE_ROOT, product.slug),
        fileName: "01" + getFileExtension(product.images[0]?.sourceUrl ?? ""),
      });
      await delay(REQUEST_DELAY_MS);
    }

    exportedProducts.push({
      ...product,
      images: product.images.map((image, imageIndex) => ({
        sourceUrl: image.sourceUrl,
        localPath: imageIndex === 0 ? localPath : null,
      })),
    });
  }

  const exportedStructures: ImportedSurfaceStructure[] = [];

  for (const structure of structures) {
    let localPath: string | null = null;

    if (options.downloadImages) {
      localPath = await downloadImage(structure.sourceUrl, {
        directory: STRUCTURE_IMAGE_ROOT,
        fileName: `${structure.code.toLowerCase()}${getFileExtension(
          structure.sourceUrl,
        )}`,
      });
      await delay(REQUEST_DELAY_MS);
    }

    exportedStructures.push({
      ...structure,
      localPath,
    });
  }

  const result: ImportResult = {
    generatedAt: new Date().toISOString(),
    sourcePageUrl: SOURCE_PAGE_URL,
    pageTitle,
    totalExportedProducts: exportedProducts.length,
    groupCounts: parsedSections.map((section) => ({
      name: section.name,
      count: section.products.length,
    })),
    documents,
    surfaceStructures: exportedStructures,
    products: exportedProducts,
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

function parseDecorSections(html: string) {
  const headingMatches = [...html.matchAll(/<h3 class="h6">([\s\S]*?)<\/h3>/gi)]
    .map((match) => ({
      index: match.index ?? 0,
      value: normalizeWhitespace(stripTags(match[1] ?? "")).toUpperCase(),
    }))
    .filter((match) => DECOR_GROUPS.has(match.value));

  const warningIndex = html.indexOf("ВНИМАНИЕ! Изображения декоров");

  return headingMatches.map((heading, index) => {
    const sectionStart = heading.index;
    const sectionEnd =
      headingMatches[index + 1]?.index ??
      (warningIndex >= 0 ? warningIndex : html.length);
    const sectionHtml = html.slice(sectionStart, sectionEnd);

    return {
      name: heading.value,
      products: parseProductsFromSection(sectionHtml, heading.value),
    };
  });
}

function parseProductsFromSection(sectionHtml: string, decorGroup: string) {
  const productMatches = [
    ...sectionHtml.matchAll(
      /<a[^>]*data-decor-type="decor"[^>]*href="([^"]+)"[^>]*class="product"[^>]*>([\s\S]*?)<\/a>/gi,
    ),
  ];

  return productMatches.map((match) =>
    parseProductCard(match[1] ?? "", match[2] ?? "", decorGroup),
  );
}

function parseProductCard(
  sourceImageUrl: string,
  productHtml: string,
  decorGroup: string,
): ImportedProduct {
  const code = normalizeWhitespace(
    stripTags(extractMatch(productHtml, /<span>([\s\S]*?)<\/span>/i) ?? ""),
  );
  const previewImageUrl = toAbsoluteUrl(
    extractMatch(productHtml, /<img[^>]*src="([^"]+)"/i),
  );
  const isNew = /object-badge[^>]*>\s*New\s*</i.test(productHtml);
  const plainText = normalizeWhitespace(stripTags(productHtml));
  const withoutBadge = isNew ? plainText.replace(/^New\s+/i, "") : plainText;
  const name = withoutBadge
    .replace(new RegExp(`^${escapeRegExp(code)}\\s*`), "")
    .trim();
  const absoluteSourceImageUrl = toAbsoluteUrl(sourceImageUrl);
  const slug = `swisskrono-ldsp-${code.toLowerCase()}`;

  return {
    slug,
    sourcePageUrl: SOURCE_PAGE_URL,
    brandName: BRAND_NAME,
    categoryName: CATEGORY_NAME,
    decorGroup,
    isNew,
    title: `${code} ${name}`,
    name,
    sku: code,
    description: `Декор ${code} ${name} из группы ${decorGroup.toLowerCase()} коллекции ламинированных плит ЛДСП SWISS KRONO.`,
    properties: {
      "Группа декора": decorGroup,
      Коллекция: "Ламинированные плиты ДСП SWISS KRONO",
      Новинка: isNew ? "Да" : "Нет",
    },
    widthMm: null,
    lengthMm: null,
    thicknessMm: [],
    emissionClasses: [],
    previewImageUrl,
    images: absoluteSourceImageUrl
      ? [
          {
            sourceUrl: absoluteSourceImageUrl,
            localPath: null,
          },
        ]
      : [],
  };
}

function parseSurfaceStructures(html: string) {
  const structuresStart = html.indexOf(
    "СТРУКТУРЫ ПОВЕРХНОСТИ ЛАМИНИРОВАННЫХ ПЛИТ",
  );

  if (structuresStart < 0) {
    return [];
  }

  const structuresEnd = html.indexOf("Скачать", structuresStart);
  const structuresHtml = html.slice(
    structuresStart,
    structuresEnd >= 0 ? structuresEnd : html.length,
  );

  const matches = [
    ...structuresHtml.matchAll(
      /<div class="lister-item"><a href="([^"]+)"[^>]*data-href="([^"]+)"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>\s*<span>([\s\S]*?)<\/span>/gi,
    ),
  ];

  return matches.map((match) => ({
    name: normalizeWhitespace(stripTags(match[3] ?? "")),
    code: normalizeWhitespace(stripTags(match[4] ?? "")).replace(/\s+/g, ""),
    sourceUrl: toAbsoluteUrl(match[1]) ?? "",
    previewUrl: toAbsoluteUrl(match[2]),
    localPath: null,
  }));
}

function parseDocuments(html: string) {
  const matches = [
    ...html.matchAll(
      /<a target="_blank" href="([^"]+)"[^>]*class="text-decoration-none[\s\S]*?<span class="ps-2 pe-2">([\s\S]*?)<\/span>[\s\S]*?<span class="ps-4 pe-2">([\s\S]*?)<\/span>/gi,
    ),
  ];

  return matches.map((match) => ({
    sourceUrl: toAbsoluteUrl(match[1]) ?? "",
    title: normalizeWhitespace(stripTags(match[2] ?? "")),
    label: normalizeWhitespace(stripTags(match[3] ?? "")),
  }));
}

async function downloadImage(
  imageUrl: string,
  options: { directory: string; fileName: string },
) {
  if (!imageUrl) {
    return null;
  }

  await mkdir(options.directory, { recursive: true });

  const absoluteFilePath = path.join(options.directory, options.fileName);
  const relativeFilePath = path
    .relative(OUTPUT_ROOT, absoluteFilePath)
    .replaceAll(path.sep, "/");

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

function toAbsoluteUrl(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  try {
    return new URL(url, SOURCE_PAGE_URL).toString();
  } catch {
    return null;
  }
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
