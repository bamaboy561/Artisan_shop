import { getOptionalSession } from "@/lib/auth/dal";
import { canAccessGeneralAdmin } from "@/lib/auth/roles";
import { hasDatabaseUrl } from "@/lib/db";
import { getPhotoCatalogData } from "@/lib/server/photo-catalog-data";
import {
  loadCatalogPhotos,
  renderPhotoExcel,
  renderPhotoPdf,
} from "@/lib/server/photo-catalog-render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
const headers = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request) {
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
  const params = new URL(request.url).searchParams;
  const format = params.get("format");
  if (format !== "pdf" && format !== "xlsx")
    return Response.json(
      { error: "Выберите PDF или Excel." },
      { status: 400, headers },
    );
  try {
    const data = await getPhotoCatalogData(
      params.get("brand") ?? "",
      params.get("inStock") === "1",
    );
    if (!data.products.length)
      return Response.json(
        { error: "Нет товаров для выбранных условий." },
        { status: 404, headers },
      );
    const photos = await loadCatalogPhotos(data);
    const file =
      format === "pdf"
        ? await renderPhotoPdf(data, photos)
        : await renderPhotoExcel(data, photos);
    if (file.length > 4 * 1024 * 1024)
      return Response.json(
        { error: "Файл слишком большой. Выберите отдельный бренд." },
        { status: 422, headers },
      );
    return new Response(new Uint8Array(file), {
      headers: {
        ...headers,
        "Content-Type":
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="artisan-photo-catalog-${data.createdAt.toISOString().slice(0, 10)}.${format}"`,
        "X-Catalog-Missing-Photos": String(
          photos.filter((photo) => !photo).length,
        ),
      },
    });
  } catch (error) {
    console.error(
      "Photo catalog export failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return Response.json(
      {
        error:
          "Не удалось сформировать каталог. Попробуйте выбрать отдельный бренд и повторить выгрузку.",
      },
      { status: 500, headers },
    );
  }
}
