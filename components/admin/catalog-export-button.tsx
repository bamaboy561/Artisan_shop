"use client";

import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";

export function CatalogExportButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/products/export", {
        cache: "no-store",
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Не удалось скачать каталог.");
      }
      if (
        !response.headers.get("Content-Type")?.includes("spreadsheetml.sheet")
      ) {
        throw new Error(
          "Сервер не вернул файл Excel. Обновите страницу и повторите попытку.",
        );
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        response.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ?? "artisan-catalog.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Не удалось скачать каталог.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={download}
        disabled={pending}
        className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/12 px-3.5 text-xs font-semibold text-white/76 transition hover:border-white/28 hover:text-white disabled:opacity-50"
      >
        {pending ? (
          <LoaderCircle className="size-4 shrink-0 animate-spin" />
        ) : (
          <Download className="size-4 shrink-0" />
        )}
        {pending ? "Выгрузка…" : "Скачать каталог Excel"}
      </button>
      {error ? (
        <p role="alert" className="mt-2 max-w-sm text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
