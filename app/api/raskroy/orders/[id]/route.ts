import {
  getRaskroyOrder,
  parseRaskroySave,
  saveRaskroyOrder,
} from "@/lib/server/raskroy";

import { denied, hasDatabaseUrl, noDb, raskroySession } from "../../access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

// Открыть заявку в программе раскроя.
export async function GET(_request: Request, { params }: Ctx) {
  const session = await raskroySession();
  if (!session) return denied();
  if (!hasDatabaseUrl()) return noDb();
  const { id } = await params;
  try {
    const order = await getRaskroyOrder(id);
    if (!order) return Response.json({ ok: false, error: "missing" }, { status: 404 });
    return Response.json({ ok: true, order });
  } catch (error) {
    console.error("[raskroy] open failed", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}

// Сохранить проект и итог раскроя в заявку.
export async function PUT(request: Request, { params }: Ctx) {
  const session = await raskroySession();
  if (!session) return denied();
  if (!hasDatabaseUrl()) return noDb();
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const input = parseRaskroySave(body);
  if (!input) return Response.json({ ok: false, error: "bad_request" }, { status: 400 });
  try {
    const result = await saveRaskroyOrder(id, input, {
      userId: session.userId,
      name: [session.firstName, session.lastName].filter(Boolean).join(" ") || session.email,
    });
    if (result.status === "missing") return Response.json({ ok: false, error: "missing" }, { status: 404 });
    if (result.status === "too_large") return Response.json({ ok: false, error: "too_large" }, { status: 413 });
    if (result.status === "conflict")
      return Response.json(
        { ok: false, error: "conflict", version: result.version, savedAt: result.savedAt, savedBy: result.savedBy },
        { status: 409 },
      );
    return Response.json({ ok: true, version: result.version, savedAt: result.savedAt });
  } catch (error) {
    console.error("[raskroy] save failed", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
