"use client";

import { useRef, useState } from "react";
import { Download, LoaderCircle, X, Images } from "lucide-react";

export function PhotoCatalogExport({
  brands,
}: {
  brands: { id: string; name: string }[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [brand, setBrand] = useState("");
  const [format, setFormat] = useState("pdf");
  const [inStock, setInStock] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function download() {
    if (pending) return;
    setPending(true);
    setMessage("");
    try {
      const params = new URLSearchParams({
        brand,
        format,
        inStock: inStock ? "1" : "0",
      });
      const response = await fetch(
        `/api/admin/products/photo-catalog?${params}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "Не удалось скачать каталог.");
      }
      const expectedType =
        format === "pdf" ? "application/pdf" : "spreadsheetml.sheet";
      if (!response.headers.get("Content-Type")?.includes(expectedType))
        throw new Error("Сервер не вернул файл каталога.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download =
        response.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ?? `artisan-catalog.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const missing = Number(
        response.headers.get("X-Catalog-Missing-Photos") ?? 0,
      );
      setMessage(
        missing
          ? `Каталог скачан. Недоступные фото: ${missing}. Все товары сохранены в файле.`
          : "Каталог скачан.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка выгрузки.");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/12 px-3.5 text-xs font-semibold text-white/76 hover:text-white"
      >
        <Images className="size-4" />
        Каталог с фото
      </button>
      <dialog
        ref={dialog}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        aria-labelledby="photo-catalog-title"
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-lg bg-white p-6 text-stone-900 shadow-xl backdrop:bg-black/50"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="photo-catalog-title" className="text-lg font-semibold">
            Каталог с фотографиями
          </h2>
          <button
            type="button"
            aria-label="Закрыть"
            title="Закрыть"
            disabled={pending}
            onClick={() => dialog.current?.close()}
            className="flex size-9 items-center justify-center"
          >
            <X className="size-5" />
          </button>
        </div>
        <fieldset disabled={pending} className="grid gap-4">
          <label className="grid gap-1.5 text-sm">
            Бренд
            <select
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              className="h-11 w-full rounded border border-stone-300 bg-white px-3"
            >
              <option value="">Все бренды</option>
              {brands.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            Формат
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value)}
              className="h-11 rounded border border-stone-300 bg-white px-3"
            >
              <option value="pdf">PDF</option>
              <option value="xlsx">Excel (.xlsx)</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={inStock}
              onChange={(event) => setInStock(event.target.checked)}
            />
            Только с положительным остатком
          </label>
          <button
            type="button"
            onClick={download}
            className="flex h-11 items-center justify-center gap-2 rounded bg-emerald-800 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {pending ? "Формирование каталога..." : "Скачать"}
          </button>
        </fieldset>
        {message && (
          <p role="status" className="mt-4 text-sm">
            {message}
          </p>
        )}
      </dialog>
    </>
  );
}
