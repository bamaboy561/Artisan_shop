import "server-only";

import { randomBytes } from "node:crypto";

// Проекты Базиса, которые клиенты открывают на странице /bazis. Копию файла
// держим в Vercel Blob два дня: если у клиента что-то не так, менеджер
// скачает файл и откроет его в Базисе. Потом файл удаляется.
const PREFIX = "bazis-temp/";
export const BAZIS_TEMP_KEEP_HOURS = 48;
const KEEP_MS = BAZIS_TEMP_KEEP_HOURS * 60 * 60 * 1000;

export type BazisTempFile = {
  url: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: Date;
  expiresAt: Date;
};

export function isBazisTempStorageConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function safeFileName(fileName: string) {
  const base = fileName
    .replace(/\.b3d$/i, "")
    .replace(/[^\p{L}\p{N}._ -]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  return `${base || "проект"}.b3d`;
}

// Время загрузки стоит в начале пути, поэтому старые файлы находятся без
// отдельной таблицы. Случайная часть не даёт угадать адрес чужого файла.
export async function saveBazisTempFile(file: File) {
  if (!isBazisTempStorageConfigured()) {
    return false;
  }

  const { put } = await import("@vercel/blob");

  await put(
    `${PREFIX}${Date.now()}-${randomBytes(12).toString("hex")}/${safeFileName(file.name)}`,
    file,
    { access: "public", addRandomSuffix: false },
  );

  return true;
}

async function listAll() {
  const { list } = await import("@vercel/blob");
  const files: BazisTempFile[] = [];
  let cursor: string | undefined;

  // Не больше 2000 файлов за раз: этого хватает на два дня с запасом.
  for (let page = 0; page < 2; page += 1) {
    const result = await list({ prefix: PREFIX, limit: 1000, cursor });

    for (const blob of result.blobs) {
      const uploadedAt = new Date(blob.uploadedAt);

      files.push({
        url: blob.url,
        fileName: blob.pathname.split("/").pop() || "проект.b3d",
        sizeBytes: blob.size,
        uploadedAt,
        expiresAt: new Date(uploadedAt.getTime() + KEEP_MS),
      });
    }

    if (!result.hasMore || !result.cursor) break;
    cursor = result.cursor;
  }

  return files;
}

// Удаляет файлы старше двух дней и возвращает их число.
export async function cleanupBazisTempFiles(now = new Date()) {
  if (!isBazisTempStorageConfigured()) {
    return 0;
  }

  const expired = (await listAll()).filter(
    (file) => file.expiresAt.getTime() <= now.getTime(),
  );

  if (expired.length > 0) {
    const { del } = await import("@vercel/blob");

    await del(expired.map((file) => file.url));
  }

  return expired.length;
}

// Файлы, которые ещё не пора удалять: новые сверху.
export async function listBazisTempFiles(now = new Date()) {
  if (!isBazisTempStorageConfigured()) {
    return [];
  }

  return (await listAll())
    .filter((file) => file.expiresAt.getTime() > now.getTime())
    .sort(
      (left, right) => right.uploadedAt.getTime() - left.uploadedAt.getTime(),
    );
}
