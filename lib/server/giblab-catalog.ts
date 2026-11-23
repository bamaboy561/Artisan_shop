import "server-only";

import { createHash } from "node:crypto";

import {
  buildGibLabCatalogRows,
  buildGibLabServices,
  buildGibLabCatalogWorkbook,
  normalizeGibLabCatalogSettings,
  parseGibLabCatalogSettings,
  type GibLabCatalogRow,
  type GibLabCatalogSettings,
} from "@/features/production/giblab-catalog";
import { otherWorks } from "@/features/cutting/site-prices";
import { ProductStatus } from "@/generated/prisma";
import { canManageProduction } from "@/lib/auth/roles";
import type { SessionPayload } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import {
  getCuttingPrice,
  getSiteCuttingPrices,
} from "@/lib/server/cutting-pricing";
import {
  prepareMachineFolders,
  readSetting,
  writeSetting,
} from "@/lib/server/machine-folders";

const settingsKey = "gibLabCatalog";
const statusKey = "gibLabCatalogStatus";

export type GibLabCatalogStatus = {
  hash: string | null;
  status: "written" | "failed" | null;
  error: string | null;
  at: string | null;
  items: number | null;
};

export async function getGibLabCatalogSettings(): Promise<GibLabCatalogSettings> {
  if (!(await prepareMachineFolders())) return parseGibLabCatalogSettings(null);
  return parseGibLabCatalogSettings(await readSetting(settingsKey));
}

export async function saveGibLabCatalogSettings(
  actor: SessionPayload,
  value: Record<string, unknown>,
) {
  if (!canManageProduction(actor.roleCode)) return false;
  if (!(await prepareMachineFolders())) return false;
  await writeSetting(
    settingsKey,
    JSON.stringify(normalizeGibLabCatalogSettings(value)),
  );
  return true;
}

export async function getGibLabCatalogRows(): Promise<GibLabCatalogRow[]> {
  const db = getDb();
  const [categories, products] = await Promise.all([
    db.category.findMany({
      select: { id: true, name: true, slug: true, kind: true, parentId: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      select: {
        id: true,
        sku: true,
        name: true,
        categoryId: true,
        price: true,
        stockQuantity: true,
        format: true,
        thicknessMm: true,
        edgeThicknessMm: true,
        edgeWidthMm: true,
      },
    }),
  ]);
  const [site, labor] = await Promise.all([
    getSiteCuttingPrices(),
    getCuttingPrice().catch(() => null),
  ]);
  // Распил и кромка — по прайсу заявок, если он задан, иначе по ценам сайта.
  const services = buildGibLabServices({
    sheet: labor?.sheetRate ?? site.sheet,
    edge: labor?.edgeRate ?? site.edge,
    drilling: site.drilling,
    milling: site.milling,
    bevel: site.bevel,
    groove: site.groove,
    works: otherWorks.map((work) => ({
      price: work.price,
      label: work.label,
      unit: work.unit,
      group: work.group,
      rate: site[work.price],
    })),
  });
  return buildGibLabCatalogRows(categories, products, services);
}

function hashRows(rows: GibLabCatalogRow[]) {
  return createHash("sha256")
    .update(JSON.stringify(rows))
    .digest("hex")
    .slice(0, 16);
}

export async function getGibLabCatalogFile() {
  const rows = await getGibLabCatalogRows();
  return {
    rows,
    hash: hashRows(rows),
    content: buildGibLabCatalogWorkbook(rows),
  };
}

// Для программы цеха: файл отдаём, только если список изменился с той
// версии, что уже лежит у оператора.
export async function getGibLabCatalogForWatcher(knownHash: string | null) {
  const settings = await getGibLabCatalogSettings();
  if (!settings.enabled) return { enabled: false as const };
  const { rows, hash, content } = await getGibLabCatalogFile();
  const path64 = Buffer.from(settings.path, "utf8").toString("base64");
  if (knownHash && knownHash === hash) {
    return { enabled: true as const, hash, path64, items: rows.length };
  }
  return {
    enabled: true as const,
    hash,
    path64,
    items: rows.length,
    content: content.toString("base64"),
  };
}

export function parseGibLabCatalogAck(
  body: unknown,
): GibLabCatalogStatus | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  const status =
    value.status === "written" || value.status === "failed"
      ? value.status
      : null;
  if (!status) return null;
  return {
    hash: typeof value.hash === "string" ? value.hash.slice(0, 64) : null,
    status,
    error: typeof value.error === "string" ? value.error.slice(0, 500) : null,
    at: new Date().toISOString(),
    items:
      typeof value.items === "number" && Number.isFinite(value.items)
        ? Math.round(value.items)
        : null,
  };
}

export async function ackGibLabCatalog(ack: GibLabCatalogStatus | null) {
  if (!ack || !(await prepareMachineFolders())) return;
  await writeSetting(statusKey, JSON.stringify(ack));
}

export async function getGibLabCatalogStatus(): Promise<GibLabCatalogStatus> {
  const empty: GibLabCatalogStatus = {
    hash: null,
    status: null,
    error: null,
    at: null,
    items: null,
  };
  if (!(await prepareMachineFolders())) return empty;
  try {
    const raw = await readSetting(statusKey);
    return raw
      ? { ...empty, ...(JSON.parse(raw) as GibLabCatalogStatus) }
      : empty;
  } catch {
    return empty;
  }
}
