import { NextResponse } from "next/server";

import { CategoryKind, ProductStatus } from "@/generated/prisma";
import { rankProductSearch } from "@/features/admin/product-search";
import { isSheetFormat } from "@/features/storefront/plate-gallery";
import {
  edgeSizeFromName,
  sheetThicknessFromName,
  type MaterialSearchItem,
} from "@/features/cutting/material-lines";
import { getOptionalSession } from "@/lib/auth/dal";
import {
  canAccessGeneralAdmin,
  isCuttingManager,
  isProductionManager,
} from "@/lib/auth/roles";
import { getDb, hasDatabaseUrl } from "@/lib/db";

export const dynamic = "force-dynamic";

const EDGE_WORDS = /кромк|edge|abs|пвх/i;
const SHEET_WORDS =
  /лдсп|мдф|дсп|хдф|двп|фанер|плит|лист|hpl|столешниц|панел|egger|kronospan/i;

// Поиск листов и кромки магазина для строк заказа на распил.
// kind=sheet — плитные материалы, kind=edge — кромка.
export async function GET(request: Request) {
  const session = await getOptionalSession();

  if (
    !session?.userId ||
    !(
      canAccessGeneralAdmin(session.roleCode) ||
      isCuttingManager(session.roleCode) ||
      isProductionManager(session.roleCode)
    )
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ products: [], other: false });
  }

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") === "edge" ? "edge" : "sheet";
  const query = (searchParams.get("q") ?? "").trim().slice(0, 200);

  const products = await getDb().product.findMany({
    where: { status: ProductStatus.ACTIVE },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      stockQuantity: true,
      format: true,
      thicknessMm: true,
      edgeThicknessMm: true,
      edgeWidthMm: true,
      brand: { select: { name: true } },
      category: {
        select: {
          name: true,
          slug: true,
          kind: true,
          parent: { select: { name: true, slug: true } },
        },
      },
      images: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 1,
        select: { url: true },
      },
    },
  });

  const isEdge = (product: (typeof products)[number]) =>
    product.edgeThicknessMm !== null ||
    product.edgeWidthMm !== null ||
    product.category.slug === "kromka" ||
    product.category.parent?.slug === "kromka" ||
    /кромк/i.test(product.category.name) ||
    /кромк/i.test(product.category.parent?.name ?? "") ||
    /^\s*кромк/i.test(product.name);
  const isSheet = (product: (typeof products)[number]) =>
    !isEdge(product) &&
    (product.category.kind === CategoryKind.PLATE ||
      isSheetFormat(product.format ?? "") ||
      SHEET_WORDS.test(
        `${product.category.name} ${product.category.parent?.name ?? ""} ${product.name}`,
      ));

  const searchable = products.map((product) => ({
    ...product,
    categoryName: [
      product.category.name,
      product.thicknessMm ? `${product.thicknessMm} мм` : "",
      product.edgeThicknessMm ? `${product.edgeThicknessMm}` : "",
      product.edgeWidthMm ? `${product.edgeWidthMm}` : "",
      kind === "edge" && EDGE_WORDS.test(product.name) ? "кромка" : "",
    ]
      .filter(Boolean)
      .join(" "),
  }));

  const ofKind = searchable.filter(kind === "edge" ? isEdge : isSheet);
  let ranked = rankProductSearch(ofKind, query);
  // Ничего не нашли среди листов/кромки — ищем по всему магазину, чтобы
  // товар из «неправильной» категории всё равно можно было выбрать.
  let other = false;
  if (query && ranked.length === 0) {
    ranked = rankProductSearch(searchable, query);
    other = ranked.length > 0;
  }

  const items: MaterialSearchItem[] = ranked.slice(0, 30).map((product) => {
    const edgeSize =
      kind === "edge" &&
      (product.edgeThicknessMm === null || product.edgeWidthMm === null)
        ? edgeSizeFromName(product.name)
        : null;
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      brand: product.brand?.name ?? null,
      category: product.category.name,
      thicknessMm: product.thicknessMm ?? sheetThicknessFromName(product.name),
      edgeThicknessMm: product.edgeThicknessMm ?? edgeSize?.thicknessMm ?? null,
      edgeWidthMm: product.edgeWidthMm ?? edgeSize?.widthMm ?? null,
      format: product.format,
      stockQuantity: product.stockQuantity,
      price: product.price,
      image: product.images[0]?.url ?? null,
    };
  });

  return NextResponse.json({ products: items, other });
}
