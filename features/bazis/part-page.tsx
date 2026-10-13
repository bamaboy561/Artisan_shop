import { PartLocator } from "@/features/bazis/part-locator";
import {
  toBazisViewProject,
  type BazisViewProject,
} from "@/features/bazis/project-view";
import { parseBazisProject } from "@/lib/bazis-b3d";
import { readRequestFileBytes } from "@/lib/server/request-file-content";
import { getRequestDetailById } from "@/lib/server/request-inbox";

// Общее для страниц детали: по ссылке с этикетки сайта (/d/…) и по коду с
// этикетки GibLab (/dg).
export type PartPageResult =
  | { project: BazisViewProject; panelIndex: number }
  | "expired"
  | null;

export async function loadBazisViewProject(requestId: string, fileId: string) {
  const request = await getRequestDetailById(requestId);
  const file = request?.files.find((item) => item.id === fileId);

  if (!file || !/\.b3d$/i.test(file.fileName)) {
    return null;
  }

  const bytes = await readRequestFileBytes(file.fileUrl);

  return bytes ? toBazisViewProject(parseBazisProject(bytes)) : null;
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="bg-white p-6">
      <h1 className="text-xl font-semibold text-[#252b29]">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-[#69716d]">{text}</p>
    </div>
  );
}

export function PartPageView({ found }: { found: PartPageResult }) {
  return (
    <div className="bg-[#f3f5f3]">
      <section className="mx-auto max-w-[900px] px-4 py-6 sm:px-8 sm:py-10">
        {found === "expired" ? (
          <Notice
            title="Срок действия кода истёк"
            text="Код на этикетке работает месяц. Попросите менеджера выдать новый код проекта и напечатать этикетки заново."
          />
        ) : found ? (
          <PartLocator project={found.project} panelIndex={found.panelIndex} />
        ) : (
          <Notice
            title="Деталь не найдена"
            text="Код на этикетке не читается, в названии проекта нет кода с сайта или проект уже удалён. Обратитесь к менеджеру."
          />
        )}
      </section>
    </div>
  );
}
