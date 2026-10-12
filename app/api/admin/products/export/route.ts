import { getOptionalSession } from "@/lib/auth/dal";
import { canAccessGeneralAdmin } from "@/lib/auth/roles";
import { hasDatabaseUrl } from "@/lib/db";
import { getCatalogExportData } from "@/lib/server/catalog-export";
import { createCatalogExport } from "@/features/admin/catalog-export";

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
        { error: "Нет доступа к выгрузке каталога." },
        { status: 403, headers },
      );
    if (!hasDatabaseUrl())
      return Response.json(
        { error: "База данных не подключена." },
        { status: 503, headers },
      );
    const file = createCatalogExport(await getCatalogExportData());
    return new Response(file, {
      headers: {
        ...headers,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="artisan-catalog-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { error: "Не удалось выгрузить каталог. Повторите попытку." },
      { status: 500, headers },
    );
  }
}
