import { getOptionalSession } from "@/lib/auth/dal";
import { canAccessGeneralAdmin } from "@/lib/auth/roles";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { getStockPendingItems } from "@/lib/server/stock-pending";
import { createStockPendingExport } from "@/features/admin/stock-pending-export";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET() {
  try {
    const session = await getOptionalSession();
    if (!session?.userId)
      return Response.json(
        { error: "Войдите в аккаунт сотрудника." },
        { status: 401, headers },
      );
    if (!canAccessGeneralAdmin(session.roleCode))
      return Response.json(
        { error: "Нет доступа к списку товаров." },
        { status: 403, headers },
      );
    if (!hasDatabaseUrl())
      return Response.json(
        { error: "База данных не подключена." },
        { status: 503, headers },
      );
    const file = createStockPendingExport(await getStockPendingItems(getDb()));
    return new Response(file, {
      headers: {
        ...headers,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="artisan-net-na-saite-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { error: "Не удалось выгрузить список. Повторите попытку." },
      { status: 500, headers },
    );
  }
}
