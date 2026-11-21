import {
  parseWatcherReport,
  watcherIntervalSeconds,
} from "@/features/production/machine-folders";
import {
  getMachineFolders,
  ingestWatcherReport,
  isWatcherAuthorized,
} from "@/lib/server/machine-folders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Наблюдатель за сетевыми папками станков (файл .cmd с компьютера цеха).
// GET — какие папки смотреть, POST — что сейчас лежит в каждой папке.
// Доступ по ключу со страницы «Станки и папки».
async function guard(request: Request) {
  const auth = await isWatcherAuthorized(request);
  if (auth === "ok") return null;
  return Response.json(
    {
      ok: false,
      message: auth === "unavailable" ? "Database unavailable" : "Invalid key",
    },
    { status: auth === "unavailable" ? 503 : 401 },
  );
}

export async function GET(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  const folders = (await getMachineFolders()).filter((f) => f.path);
  return Response.json({
    ok: true,
    intervalSeconds: watcherIntervalSeconds,
    folders: folders.map((f) => ({ id: f.id, name: f.name, path: f.path })),
  });
}

export async function POST(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  const text = await request.text();
  if (text.length > 2_000_000)
    return Response.json({ ok: false, message: "Too large" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    return Response.json({ ok: false, message: "Bad JSON" }, { status: 400 });
  }
  const report = parseWatcherReport(body);
  if (!report)
    return Response.json({ ok: false, message: "Bad report" }, { status: 400 });
  try {
    const result = await ingestWatcherReport(report);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("[machine-folder] ingest failed", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
