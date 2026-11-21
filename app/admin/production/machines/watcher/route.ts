import { requireAdminSession } from "@/lib/auth/dal";
import { canManageProduction } from "@/lib/auth/roles";
import { buildWatcherScript } from "@/features/production/machine-folders";
import { getSiteUrl } from "@/lib/seo";
import { getWatcherKey } from "@/lib/server/machine-folders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Скачивание наблюдателя (.cmd) с ключом и адресом сайта внутри.
export async function GET() {
  const actor = await requireAdminSession(
    "/login?next=/admin/production/machines",
    "/admin/production/machines",
  );
  if (!canManageProduction(actor.roleCode))
    return new Response("Forbidden", { status: 403 });
  const key = await getWatcherKey(actor);
  if (!key) return new Response("Database unavailable", { status: 503 });
  const script = buildWatcherScript({ siteUrl: getSiteUrl(), key });
  return new Response(script, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="artisan-stanki.cmd"',
      "Cache-Control": "no-store",
    },
  });
}
