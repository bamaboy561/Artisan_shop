import { BazisParseError, parseBazisProject } from "@/lib/bazis-b3d";
import {
  groupBazisRowsByMaterial,
  type BazisImportResponse,
} from "@/features/services/bazis-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Проект Базиса обычно весит до 1-2 МБ. Файл никуда не сохраняется:
// читаем детали и сразу отдаём их калькулятору.
const MAX_FILE_BYTES = 4 * 1024 * 1024;

function fail(error: string, status: number) {
  return Response.json({ ok: false, error } satisfies BazisImportResponse, {
    status,
  });
}

export async function POST(request: Request) {
  let file: FormDataEntryValue | null;

  try {
    file = (await request.formData()).get("file");
  } catch {
    return fail("Не получилось принять файл.", 400);
  }

  if (!(file instanceof File) || file.size === 0) {
    return fail("Выберите файл проекта Базиса (.b3d).", 400);
  }

  if (file.size > MAX_FILE_BYTES) {
    return fail("Файл больше 4 МБ. Прикрепите его к заявке.", 413);
  }

  try {
    const project = parseBazisProject(Buffer.from(await file.arrayBuffer()));
    const groups = groupBazisRowsByMaterial(project.rows);

    if (groups.length === 0) {
      return fail("В проекте не нашли деталей из плиты.", 422);
    }

    return Response.json({
      ok: true,
      orderName: project.orderName,
      groups,
    } satisfies BazisImportResponse);
  } catch (error) {
    return fail(
      error instanceof BazisParseError
        ? error.message
        : "Не получилось прочитать проект. Прикрепите файл к заявке, менеджер разберёт его.",
      422,
    );
  }
}
