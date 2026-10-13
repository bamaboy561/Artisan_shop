import type { Metadata } from "next";

import { PartLocator } from "@/features/bazis/part-locator";
import { toBazisViewProject } from "@/features/bazis/project-view";
import { parseBazisProject } from "@/lib/bazis-b3d";
import { verifyBazisPartToken } from "@/lib/server/bazis-part-link";
import { readRequestFileBytes } from "@/lib/server/request-file-content";
import { getRequestDetailById } from "@/lib/server/request-inbox";

export const dynamic = "force-dynamic";

// Служебная страница для сборщиков: в поиске ей делать нечего.
export const metadata: Metadata = {
  title: "Деталь проекта | Artisan",
  robots: { index: false, follow: false },
};

type PartPageProps = {
  params: Promise<{ token: string }>;
};

async function loadProject(token: string) {
  const ref = verifyBazisPartToken(decodeURIComponent(token));

  if (!ref) {
    return null;
  }

  const request = await getRequestDetailById(ref.requestId);
  const file = request?.files.find((item) => item.id === ref.fileId);

  if (!file || !/\.b3d$/i.test(file.fileName)) {
    return null;
  }

  const bytes = await readRequestFileBytes(file.fileUrl);

  if (!bytes) {
    return null;
  }

  const project = toBazisViewProject(parseBazisProject(bytes));

  return project.panels[ref.panelIndex]
    ? { project, panelIndex: ref.panelIndex }
    : null;
}

export default async function PartPage({ params }: PartPageProps) {
  const { token } = await params;
  let found: Awaited<ReturnType<typeof loadProject>> = null;

  try {
    found = await loadProject(token);
  } catch (error) {
    console.error("[bazis:part-page]", error);
  }

  return (
    <div className="bg-[#f3f5f3]">
      <section className="mx-auto max-w-[900px] px-4 py-6 sm:px-8 sm:py-10">
        {found ? (
          <PartLocator project={found.project} panelIndex={found.panelIndex} />
        ) : (
          <div className="bg-white p-6">
            <h1 className="text-xl font-semibold text-[#252b29]">
              Деталь не найдена
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#69716d]">
              Код на этикетке не читается или проект уже удалён. Попросите
              менеджера напечатать этикетки заново.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
