import {
  toBazisViewProject,
  type BazisViewResponse,
} from "@/features/bazis/project-view";
import { BazisParseError, parseBazisProject } from "@/lib/bazis-b3d";
import { saveBazisTempFile } from "@/lib/server/bazis-temp-files";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Читаем проект и сразу отдаём его странице просмотра. Копию файла держим
// два дня, чтобы менеджер мог скачать её, если у клиента что-то не так.
// Vercel принимает запрос до 4,5 МБ.
const MAX_FILE_BYTES = 4 * 1024 * 1024;

function fail(error: string, status: number) {
  return Response.json({ ok: false, error } satisfies BazisViewResponse, {
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
    return fail(
      "Файл больше 4 МБ. Прикрепите его к заявке, менеджер откроет проект.",
      413,
    );
  }

  try {
    const project = parseBazisProject(Buffer.from(await file.arrayBuffer()));

    if (project.panels.length === 0) {
      return fail("В проекте не нашли деталей из плиты.", 422);
    }

    // Сохраняем только файлы, которые действительно оказались проектом.
    // Если хранилище недоступно, клиент всё равно видит свой проект.
    // Предпросмотр в формах (?keep=0) копию не сохраняет: там файл и так
    // уходит вместе с заявкой.
    try {
      if (new URL(request.url).searchParams.get("keep") !== "0") {
        await saveBazisTempFile(file);
      }
    } catch (error) {
      console.error("[bazis] не удалось сохранить копию проекта", error);
    }

    return Response.json({
      ok: true,
      project: toBazisViewProject(project),
    } satisfies BazisViewResponse);
  } catch (error) {
    return fail(
      error instanceof BazisParseError
        ? error.message
        : "Не получилось прочитать проект. Прикрепите файл к заявке, менеджер разберёт его.",
      422,
    );
  }
}
