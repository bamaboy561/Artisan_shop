import "server-only";

import {
  isEdgeCategory,
  parseSheetSizeMm,
} from "@/features/production/giblab-catalog";
import { CategoryKind, ProductStatus } from "@/generated/prisma";
import { getDb } from "@/lib/db";
import {
  getCuttingPrice,
  getSiteCuttingPrices,
} from "@/lib/server/cutting-pricing";

// Прайс для сметы в программе раскроя: плиты (цена листа и формат), кромка
// (цена за метр), фурнитура и прочие товары с ценой, и цены работ цеха —
// те же, что в каталоге GibLab и в расчёте заявки на сайте.
export type RaskroyCatalog = {
  sheets: Array<{ code: string; name: string; group: string; t: number | null; L: number; W: number; price: number }>;
  bands: Array<{ code: string; name: string; group: string; t: number | null; w: number | null; price: number }>;
  items: Array<{ code: string; name: string; group: string; price: number }>;
  services: {
    sheet: number;
    edge: number;
    drilling: Record<number, number>;
    milling: number;
    bevel: number;
    groove: number;
  };
};

const clean = (value: string) => value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();

export async function getRaskroyCatalog(): Promise<RaskroyCatalog> {
  const db = getDb();
  const [categories, products, site, labor] = await Promise.all([
    db.category.findMany({ select: { id: true, name: true, slug: true, kind: true } }),
    db.product.findMany({
      where: { status: ProductStatus.ACTIVE, price: { not: null } },
      select: {
        sku: true,
        name: true,
        categoryId: true,
        price: true,
        format: true,
        thicknessMm: true,
        edgeThicknessMm: true,
        edgeWidthMm: true,
      },
      orderBy: { name: "asc" },
      take: 5000,
    }),
    getSiteCuttingPrices(),
    getCuttingPrice().catch(() => null),
  ]);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const out: RaskroyCatalog = {
    sheets: [],
    bands: [],
    items: [],
    services: {
      // Распил и кромка — по прайсу заявок, если он задан, иначе по ценам сайта.
      sheet: labor?.sheetRate ?? site.sheet,
      edge: labor?.edgeRate ?? site.edge,
      drilling: site.drilling,
      milling: site.milling,
      bevel: site.bevel,
      groove: site.groove,
    },
  };
  for (const p of products) {
    if (p.price == null) continue;
    const category = byId.get(p.categoryId);
    const group = clean(category?.name ?? "Прочее");
    const name = clean(p.name);
    const code = clean(p.sku);
    const edge =
      (category ? isEdgeCategory(category) : false) || /кромк/i.test(p.name) || p.edgeWidthMm != null;
    if (edge) {
      out.bands.push({ code, name, group, t: p.edgeThicknessMm, w: p.edgeWidthMm, price: p.price });
      continue;
    }
    const size = parseSheetSizeMm(p.format, p.name);
    if (size) {
      out.sheets.push({ code, name, group, t: p.thicknessMm, L: size.length, W: size.width, price: p.price });
      continue;
    }
    if (category?.kind === CategoryKind.PLATE) continue; // плита без формата: в смете не посчитать
    out.items.push({ code, name, group, price: p.price });
  }
  return out;
}
