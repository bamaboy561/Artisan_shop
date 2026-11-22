import { listRaskroyOrders } from "@/lib/server/raskroy";

import { denied, hasDatabaseUrl, noDb, raskroySession } from "../access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Список заявок на распил для программы раскроя.
export async function GET() {
  const session = await raskroySession();
  if (!session) return denied();
  if (!hasDatabaseUrl()) return noDb();
  try {
    const orders = await listRaskroyOrders();
    return Response.json({
      ok: true,
      user: [session.firstName, session.lastName].filter(Boolean).join(" ") || session.email,
      orders,
    });
  } catch (error) {
    console.error("[raskroy] list failed", error);
    return Response.json({ ok: false, orders: [] }, { status: 500 });
  }
}
