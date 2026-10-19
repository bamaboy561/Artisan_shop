import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { BazisProjectReadonly } from "@/features/bazis/project-readonly";
import {
  toBazisViewProject,
  type BazisViewProject,
} from "@/features/bazis/project-view";
import { BazisParseError, parseBazisProject } from "@/lib/bazis-b3d";
import { hasDatabaseUrl } from "@/lib/db";
import { getAccountRequests, getAccountUser } from "@/lib/server/account-data";
import { readRequestFileBytes } from "@/lib/server/request-file-content";

export const dynamic = "force-dynamic";

type AccountBazisPageProps = {
  params: Promise<{ id: string; fileId: string }>;
};

// Макет проекта Базиса, который клиент приложил к своей заявке. Заявку и
// файл берём только из списка заявок самого клиента.
export default async function AccountBazisPage({
  params,
}: AccountBazisPageProps) {
  const { id, fileId } = await params;

  if (!hasDatabaseUrl()) {
    notFound();
  }

  const user = await getAccountUser();

  if (!user) {
    return null;
  }

  const request = (await getAccountRequests(user.id)).find(
    (item) => item.id === id,
  );
  const file = request?.files.find((item) => item.id === fileId);

  if (!request || !file || !/\.b3d$/i.test(file.fileName)) {
    notFound();
  }

  let project: BazisViewProject | null = null;
  let problem = "";
  const bytes = await readRequestFileBytes(file.fileUrl);

  if (!bytes) {
    problem = "Не удалось открыть файл. Попробуйте позже.";
  } else {
    try {
      project = toBazisViewProject(parseBazisProject(bytes));
    } catch (error) {
      problem =
        error instanceof BazisParseError
          ? error.message
          : "Не удалось прочитать проект.";
    }
  }

  return (
    <div className="grid gap-5">
      <Link
        href="/account/requests"
        className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="size-4" /> Мои заявки
      </Link>
      <div>
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
          Заявка {request.number ?? request.id.slice(0, 8)}
        </p>
        <h1 className="mt-1 text-2xl leading-tight font-semibold text-[var(--foreground)] sm:text-3xl">
          {project?.orderName || file.fileName}
        </h1>
      </div>
      {problem ? (
        <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {problem}
        </p>
      ) : null}
      {project ? <BazisProjectReadonly project={project} /> : null}
    </div>
  );
}
