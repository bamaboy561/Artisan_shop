import { getRaskroyStock, parseRaskroyStockSave, saveRaskroyStock } from "@/lib/server/raskroy-stock";

import { denied, hasDatabaseUrl, noDb, raskroySession } from "../access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Общий склад деловых остатков для всех компьютеров цеха.
export async function GET() {
  const session = await raskroySession();
  if (!session) return denied();
  if (!hasDatabaseUrl()) return noDb();
  try {
    return Response.json({ ok: true, ...(await getRaskroyStock()) });
  } catch (error) {
    console.error("[raskroy] stock read failed", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await raskroySession();
  if (!session) return denied();
  if (!hasDatabaseUrl()) return noDb();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const input = parseRaskroyStockSave(body);
  if (!input) return Response.json({ ok: false, error: "bad_request" }, { status: 400 });
  try {
    const result = await saveRaskroyStock(input, {
      userId: session.userId,
      name: [session.firstName, session.lastName].filter(Boolean).join(" ") || session.email,
    });
    if (result.status === "too_large") return Response.json({ ok: false, error: "too_large" }, { status: 413 });
    if (result.status === "conflict")
      return Response.json({ ok: false, error: "conflict", version: result.version }, { status: 409 });
    return Response.json({ ok: true, version: result.version, savedAt: result.savedAt });
  } catch (error) {
    console.error("[raskroy] stock save failed", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
