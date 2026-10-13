import type { Metadata } from "next";

import {
  loadBazisViewProject,
  PartPageView,
  type PartPageResult,
} from "@/features/bazis/part-page";
import { verifyBazisPartToken } from "@/lib/server/bazis-part-link";

export const dynamic = "force-dynamic";

// Служебная страница для сборщиков: в поиске ей делать нечего.
export const metadata: Metadata = {
  title: "Деталь проекта | Artisan",
  robots: { index: false, follow: false },
};

type PartPageProps = {
  params: Promise<{ token: string }>;
};

async function loadProject(token: string): Promise<PartPageResult> {
  const ref = verifyBazisPartToken(decodeURIComponent(token));

  if (ref === "expired") {
    return "expired";
  }

  if (!ref) {
    return null;
  }

  const project = await loadBazisViewProject(ref.requestId, ref.fileId);

  return project?.panels[ref.panelIndex]
    ? { project, panelIndex: ref.panelIndex }
    : null;
}

export default async function PartPage({ params }: PartPageProps) {
  const { token } = await params;
  let found: PartPageResult = null;

  try {
    found = await loadProject(token);
  } catch (error) {
    console.error("[bazis:part-page]", error);
  }

  return <PartPageView found={found} />;
}
