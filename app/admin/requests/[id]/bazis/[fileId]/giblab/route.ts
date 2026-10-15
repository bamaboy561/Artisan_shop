import { requireAdminSession } from "@/lib/auth/dal";
import { canAccessRequestType } from "@/lib/auth/roles";
import { BazisParseError } from "@/lib/bazis-b3d";
import { exportBazisToGibLab } from "@/lib/bazis-giblab";
import { readRequestFileBytes } from "@/lib/server/request-file-content";
import { getRequestDetailById } from "@/lib/server/request-inbox";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Файл .project для GibLab из проекта Базиса в заявке: тот же, что
// выгружает скрипт Базиса GibLabExport 1.86 (детали, кромка, присадка,
// фрезеровка контура).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id, fileId } = await params;
  const session = await requireAdminSession(
    "/login?next=/admin/requests",
    `/admin/requests/${id}/bazis/${fileId}/giblab`,
  );
  const request = await getRequestDetailById(id);
  const file = request?.files.find((item) => item.id === fileId);

  if (
    !request ||
    !file ||
    !/\.b3d$/i.test(file.fileName) ||
    !canAccessRequestType(session.roleCode, request.type)
  ) {
    return new Response("Проект не найден.", { status: 404 });
  }

  const bytes = await readRequestFileBytes(file.fileUrl);

  if (!bytes) {
    return new Response("Не удалось открыть файл проекта.", { status: 502 });
  }

  try {
    const project = exportBazisToGibLab(bytes);
    const baseName = file.fileName.replace(/\.b3d$/i, "") || "проект";

    return new Response(new Uint8Array(project), {
      headers: {
        "Content-Type": "application/xml; charset=windows-1251",
        "Content-Disposition": `attachment; filename="giblab.project"; filename*=UTF-8''${encodeURIComponent(`${baseName}.project`)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new Response(
      error instanceof BazisParseError
        ? error.message
        : "Не удалось подготовить файл для GibLab.",
      { status: 422 },
    );
  }
}
