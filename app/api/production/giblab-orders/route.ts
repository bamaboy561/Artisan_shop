import { isWatcherAuthorized } from "@/lib/server/machine-folders";
import {
  ackGibLabOrders,
  getPendingGibLabOrders,
  getWatchedGibLabOrders,
  parseGibLabOrderAcks,
} from "@/lib/server/giblab-orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Программа цеха: GET — какие заказы положить в папку проектов GibLab
// (содержимое в base64), POST — что получилось. Ключ тот же, что у папок.
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
  try {
    const [orders, watch] = await Promise.all([
      getPendingGibLabOrders(),
      getWatchedGibLabOrders(),
    ]);
    return Response.json({ ok: true, orders, watch });
  } catch (error) {
    console.error("[giblab-orders] pending failed", error);
    return Response.json({ ok: false, orders: [] }, { status: 500 });
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
  await ackGibLabOrders(parseGibLabOrderAcks(body));
  return Response.json({ ok: true });
}
