import { isWatcherAuthorized } from "@/lib/server/machine-folders";
import {
  ackGibLabCatalog,
  getGibLabCatalogForWatcher,
  parseGibLabCatalogAck,
} from "@/lib/server/giblab-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Программа цеха: GET ?hash= — каталог материалов для GibLab (goods.xls в
// base64, только если изменился), POST — записан ли файл. Ключ как у папок.
async function guard(request: Request) {
  const auth = await isWatcherAuthorized(request);
  if (auth === "ok") return null;
  return Response.json(
    { ok: false },
    { status: auth === "unavailable" ? 503 : 401 },
  );
}

export async function GET(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  const known = new URL(request.url).searchParams.get("hash");
  try {
    const catalog = await getGibLabCatalogForWatcher(known || null);
    return Response.json({ ok: true, ...catalog });
  } catch (error) {
    console.error("[giblab-catalog] build failed", error);
    return Response.json({ ok: false, enabled: false }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  let body: unknown;
  try {
    body = JSON.parse((await request.text()).replace(/^﻿/, ""));
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  await ackGibLabCatalog(parseGibLabCatalogAck(body));
  return Response.json({ ok: true });
}
