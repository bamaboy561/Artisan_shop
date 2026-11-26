"use client";

import { useState, type ChangeEvent } from "react";
import styles from "./shift.module.css";

const maxSide = 1600;

// Фото с камеры телефона весит 3–10 МБ, а запрос к серверу на Vercel
// ограничен 4,5 МБ: «Сдать смену» с таким фото падало. Уменьшаем фото
// в браузере до 1600 px (JPEG) ещё до отправки формы.
async function shrink(file: File): Promise<File | null> {
  if (!file.type.startsWith("image/")) return null;
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.8),
  );
  return blob ? new File([blob], "stanok.jpg", { type: "image/jpeg" }) : null;
}

export function ShiftPhotoInput() {
  const [status, setStatus] = useState<"" | "working" | "ready" | "failed">("");

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return setStatus("");
    // Пока фото уменьшается, большой оригинал в форме не держим: если
    // успеют нажать «Сдать смену», смена уйдёт без фото, а не упадёт.
    input.value = "";
    setStatus("working");
    try {
      const small = await shrink(file);
      if (!small) throw new Error("not an image");
      const list = new DataTransfer();
      list.items.add(small);
      input.files = list.files;
      setStatus("ready");
    } catch {
      // Не смогли уменьшить — не отправляем огромный файл, смена важнее фото.
      input.value = "";
      setStatus("failed");
    }
  }

  return (
    <label className={styles.field}>
      Фото станка после уборки
      <input
        className={styles.input}
        type="file"
        name="photo"
        accept="image/*"
        capture="environment"
        onChange={onChange}
      />
      {status === "working" ? (
        <span className={styles.hint}>Готовлю фото…</span>
      ) : status === "failed" ? (
        <span className={styles.hint}>
          Фото не получилось подготовить. Сдайте смену без фото или выберите
          другое.
        </span>
      ) : null}
    </label>
  );
}
