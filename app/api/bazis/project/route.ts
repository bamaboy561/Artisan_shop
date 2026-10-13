import {
  toBazisViewProject,
  type BazisViewResponse,
} from "@/features/bazis/project-view";
import { BazisParseError, parseBazisProject } from "@/lib/bazis-b3d";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Файл нигде не сохраняется: читаем проект и сразу отдаём его странице
// просмотра. Vercel принимает запрос до 4,5 МБ.
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
