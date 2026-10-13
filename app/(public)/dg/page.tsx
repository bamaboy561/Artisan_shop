import type { Metadata } from "next";

import {
  loadBazisViewProject,
  PartPageView,
  type PartPageResult,
} from "@/features/bazis/part-page";
import { resolveBazisProjectCode } from "@/lib/server/bazis-project-code";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Деталь проекта | Artisan",
  robots: { index: false, follow: false },
};

// Страница детали по QR-коду с этикетки GibLab:
//   /dg?c=<название проекта GibLab с кодом сайта>&p=<номер позиции детали>
// Номер позиции в GibLab тот же, что в проекте Базиса.
type GibLabPartPageProps = {
  searchParams: Promise<{ c?: string | string[]; p?: string | string[] }>;
};

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";

async function loadProject(
  codeText: string,
  position: string,
): Promise<PartPageResult> {
  if (!codeText || !position || codeText.length > 300) {
    return null;
  }

  const ref = await resolveBazisProjectCode(codeText);

  if (ref === "expired") {
    return "expired";
  }

  if (!ref) {
    return null;
  }

  const project = await loadBazisViewProject(ref.requestId, ref.fileId);
  // «007» и «7» считаем одной позицией.
  const normalize = (value: string) => value.trim().replace(/^0+(?=\d)/, "");
  const wanted = normalize(position);
  const panelIndex =
    project?.panels.findIndex(
      (panel) => normalize(panel.position) === wanted,
    ) ?? -1;

  return project && panelIndex >= 0 ? { project, panelIndex } : null;
}

export default async function GibLabPartPage({
  searchParams,
}: GibLabPartPageProps) {
  const query = await searchParams;
  let found: PartPageResult = null;

  try {
    found = await loadProject(first(query.c).trim(), first(query.p).trim());
  } catch (error) {
    console.error("[bazis:giblab-part-page]", error);
  }

  return <PartPageView found={found} />;
}
