import { requireAdminSession } from "@/lib/auth/dal";
import { canManageProduction } from "@/lib/auth/roles";
import { getGibLabCatalogFile } from "@/lib/server/giblab-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Тот же goods.xls, что получает программа цеха, — посмотреть руками.
export async function GET() {
  const actor = await requireAdminSession(
    "/login?next=/admin/production/machines",
    "/admin/production/machines",
  );
  if (!canManageProduction(actor.roleCode))
    return new Response("Forbidden", { status: 403 });
  const { content } = await getGibLabCatalogFile();
  return new Response(new Uint8Array(content), {
    headers: {
      "Content-Type": "application/vnd.ms-excel",
      "Content-Disposition": 'attachment; filename="goods.xls"',
      "Cache-Control": "no-store",
    },
  });
}
