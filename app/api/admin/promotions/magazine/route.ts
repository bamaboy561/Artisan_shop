import { getOptionalSession } from "@/lib/auth/dal";
import { canAccessGeneralAdmin } from "@/lib/auth/roles";
import { hasDatabaseUrl } from "@/lib/db";
import { getPromoMagazineData } from "@/lib/server/promo-magazine-data";
import {
  defaultMagazineTheme,
  loadMagazinePhotos,
  parseMagazineTheme,
  renderPromoMagazine,
} from "@/lib/server/promo-magazine-render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
const headers = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
};

// Журнал акций в PDF: обложка, страницы товаров со скидкой, контакты.
// ?promotion=<id> — только одна акция, без параметра — все действующие.
export async function GET(request: Request) {
  const session = await getOptionalSession();
  if (!session?.userId)
    return Response.json(
      { error: "Войдите в аккаунт сотрудника." },
      { status: 401, headers },
    );
  if (!canAccessGeneralAdmin(session.roleCode))
    return Response.json(
      { error: "Нет доступа к журналу акций." },
      { status: 403, headers },
    );
  if (!hasDatabaseUrl())
    return Response.json(
      { error: "База данных не подключена." },
      { status: 503, headers },
    );
  const params = new URL(request.url).searchParams;
  const promotionId = params.get("promotion")?.trim() ?? "";
  // ?theme=classic|new-year; без параметра — по дате (новогодняя 1.12–15.01).
  const theme =
    parseMagazineTheme(params.get("theme")) ?? defaultMagazineTheme();
  try {
    const data = await getPromoMagazineData(promotionId);
    if (!data.products.length)
      return new Response(
        data.emptyReason ??
          "Сейчас нет товаров с действующей скидкой. Проверьте, что акция активна, сроки идут и к ней привязаны товары или категории.",
        {
          status: 404,
          headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
        },
      );
    const photos = await loadMagazinePhotos(data);
    const file = await renderPromoMagazine(data, photos, theme);
    const date = data.createdAt.toISOString().slice(0, 10);
    return new Response(new Uint8Array(file), {
      headers: {
        ...headers,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="artisan-akcii-${theme === "new-year" ? "novyj-god-" : ""}${date}.pdf"`,
      },
    });
  } catch (error) {
    console.error(
      "Promo magazine export failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return new Response(
      "Не удалось собрать журнал акций. Попробуйте ещё раз.",
      {
        status: 500,
        headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }
}
