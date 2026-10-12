export async function compressInvoicePhoto(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type))
    throw new Error("Выберите фото JPG, PNG или WebP.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Фото больше 20 МБ. Выберите меньший файл.");
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    const ratio = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Не удалось подготовить фото.");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (!blob || blob.size > 3 * 1024 * 1024)
      throw new Error("Не удалось уменьшить фото. Попробуйте другой снимок.");
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } finally {
    bitmap.close();
  }
}
