import "server-only";

import sharp from "sharp";

const maxBytes = 15 * 1024 * 1024;

// Фото станка при сдаче смены: уменьшаем до 1600 px и кладём в Vercel Blob.
// Без хранилища фото просто не сохраняется — сдача смены не ломается.
export async function uploadShiftPhoto(file: File, userId: string) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  if (!file.type.startsWith("image/") || file.size > maxBytes) return null;
  const input = Buffer.from(await file.arrayBuffer());
  const output = await sharp(input)
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 78 })
    .toBuffer();
  const { put } = await import("@vercel/blob");
  const safeUser = userId.replace(/[^\w-]/g, "").slice(0, 40) || "user";
  const blob = await put(`shifts/${safeUser}/${Date.now()}.jpg`, output, {
    access: "public",
    addRandomSuffix: true,
    contentType: "image/jpeg",
  });
  return blob.url;
}
