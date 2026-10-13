import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const uploadsRoot = path.join(process.cwd(), "public", "uploads", "requests");

// Содержимое файла заявки. Читаем только из своего хранилища: локальная
// папка загрузок или Vercel Blob. Любой другой адрес не открываем.
export async function readRequestFileBytes(fileUrl: string) {
  if (fileUrl.startsWith("/uploads/requests/")) {
    const target = path.join(process.cwd(), "public", fileUrl);

    if (
      !path.resolve(target).startsWith(path.resolve(uploadsRoot) + path.sep)
    ) {
      return null;
    }

    try {
      const bytes = await readFile(target);

      return bytes.length <= MAX_FILE_BYTES ? bytes : null;
    } catch {
      return null;
    }
  }

  let url: URL;

  try {
    url = new URL(fileUrl);
  } catch {
    return null;
  }

  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".public.blob.vercel-storage.com")
  ) {
    return null;
  }

  try {
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      return null;
    }

    const bytes = Buffer.from(await response.arrayBuffer());

    return bytes.length <= MAX_FILE_BYTES ? bytes : null;
  } catch {
    return null;
  }
}
