import { getRaskroyCatalog } from "@/lib/server/raskroy-catalog";

import { denied, hasDatabaseUrl, noDb, raskroySession } from "../access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Прайс материалов и работ для сметы в программе раскроя.
export async function GET() {
  const session = await raskroySession();
  if (!session) return denied();
  if (!hasDatabaseUrl()) return noDb();
  try {
    return Response.json({ ok: true, catalog: await getRaskroyCatalog() });
  } catch (error) {
    console.error("[raskroy] catalog failed", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
