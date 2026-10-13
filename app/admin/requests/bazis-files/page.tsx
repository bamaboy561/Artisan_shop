import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { SectionHeading } from "@/components/ui/section-heading";
import { requireAdminSession } from "@/lib/auth/dal";
import {
  BAZIS_TEMP_KEEP_HOURS,
  cleanupBazisTempFiles,
  isBazisTempStorageConfigured,
  listBazisTempFiles,
  type BazisTempFile,
} from "@/lib/server/bazis-temp-files";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Asia/Bishkek",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} МБ`
    : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

function formatLeft(file: BazisTempFile, now: Date) {
  const hours = Math.ceil(
    (file.expiresAt.getTime() - now.getTime()) / 3_600_000,
  );

  return hours <= 1 ? "меньше часа" : `${hours} ч`;
}

export default async function BazisTempFilesPage() {
  await requireAdminSession(
    "/login?next=/admin/requests/bazis-files",
    "/admin/requests",
  );

  const now = new Date();
  let files: BazisTempFile[] = [];
  let problem = "";

  if (isBazisTempStorageConfigured()) {
    try {
      // Заодно убираем просроченные, если ночная очистка не сработала.
      await cleanupBazisTempFiles(now);
      files = await listBazisTempFiles(now);
    } catch {
      problem = "Не получилось открыть хранилище файлов. Обновите страницу.";
    }
  } else {
    problem = "Хранилище файлов не подключено, проекты не сохраняются.";
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/requests"
        className="inline-flex h-10 items-center gap-2 border border-[color:var(--line-strong)] px-4 text-sm font-medium transition hover:border-[color:var(--foreground)]"
      >
        <ArrowLeft className="size-4" />К заявкам
      </Link>
      <SectionHeading
        title="Проекты Базиса с сайта"
        description={`Файлы, которые клиенты открывали на странице «Проект Базиса». Хранятся ${BAZIS_TEMP_KEEP_HOURS} часов, потом удаляются сами. Клиент здесь не указан: ищите проект по названию файла и времени.`}
        titleClassName="text-2xl sm:text-3xl"
        descriptionClassName="max-w-3xl text-sm leading-7"
      />

      {problem ? (
        <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {problem}
        </p>
      ) : files.length === 0 ? (
        <p className="border border-[color:var(--line-strong)] bg-white px-4 py-6 text-sm text-[var(--muted-foreground)]">
          За последние два дня проекты на сайте не открывали.
        </p>
      ) : (
        <div className="overflow-x-auto border border-[color:var(--line-strong)] bg-white">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[color:var(--line-strong)] text-left text-xs text-[var(--muted-foreground)]">
                <th className="px-4 py-3 font-medium">Файл</th>
                <th className="px-4 py-3 font-medium">Загружен</th>
                <th className="px-4 py-3 font-medium">Размер</th>
                <th className="px-4 py-3 font-medium">Удалится через</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr
                  key={file.url}
                  className="border-b border-[color:var(--line-strong)] last:border-0"
                >
                  <td className="px-4 py-3 font-medium break-all">
                    {file.fileName}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {dateFormatter.format(file.uploadedAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatSize(file.sizeBytes)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatLeft(file, now)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`${file.url}?download=1`}
                      download={file.fileName}
                      className="inline-flex h-9 items-center justify-center border border-[color:var(--line-strong)] px-3 text-sm font-medium transition hover:border-[color:var(--accent)] hover:text-[var(--accent)]"
                    >
                      Скачать
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
