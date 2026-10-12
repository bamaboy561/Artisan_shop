"use client";

import { useEffect, useState } from "react";
import { Camera, FileUp, Check, LoaderCircle, Search, X } from "lucide-react";
import { previewSalesInvoiceAction } from "@/app/admin/sales-floor/invoice-actions";
import {
  validateInvoiceLine,
  MAX_SALE_AMOUNT,
} from "@/features/admin/sales-invoice-model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compressInvoicePhoto } from "@/features/admin/invoice-photo-client";

type Preview = Extract<
  Awaited<ReturnType<typeof previewSalesInvoiceAction>>,
  { invoice: unknown }
>["invoice"];
type Product = NonNullable<Preview["lines"][number]["product"]>;
type DraftLine = Preview["lines"][number] & { included: boolean };
export type ImportedSaleItem = {
  product: Product;
  quantity: number;
  unitPrice: number;
};
const money = (value: number) =>
  value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
function draftNumber(value: string) {
  if (!value.trim()) return null;
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function InvoiceProductPicker({
  product,
  initialQuery,
  onChange,
}: {
  product: Product | null;
  initialQuery: string;
  onChange: (product: Product) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!query.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setMessage("Поиск...");
      try {
        const response = await fetch(
          `/api/admin/products?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Search failed");
        const payload = (await response.json()) as { products?: Product[] };
        if (!controller.signal.aborted) {
          setResults(payload.products ?? []);
          setMessage(payload.products?.length ? "" : "Товары не найдены");
        }
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setMessage("Не удалось загрузить товары");
        }
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  return (
    <div className="min-w-0 space-y-2">
      {product && (
        <p className="text-xs font-medium break-words text-emerald-800">
          {product.name}
          <span className="block font-mono break-all text-zinc-500">
            {product.sku}
          </span>
        </p>
      )}
      <label className="relative block">
        <span className="sr-only">Найти товар на сайте</span>
        <Search className="absolute top-3 left-2 size-4 text-zinc-500" />
        <Input
          value={query}
          onFocus={() => {
            if (!product && !query) setQuery(initialQuery);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setResults([]);
            setMessage("");
          }}
          placeholder={product ? "Заменить товар" : "Название или артикул"}
          className="h-10 pl-8 text-xs"
        />
      </label>
      {query.trim() && (
        <div className="max-h-40 overflow-auto">
          {message && (
            <p role="status" className="text-xs text-zinc-500">
              {message}
            </p>
          )}
          {results.map((candidate) => (
            <button
              type="button"
              key={candidate.id}
              onClick={() => {
                onChange(candidate);
                setQuery("");
                setResults([]);
              }}
              className="block w-full border-b border-zinc-200 py-2 text-left text-xs break-words hover:text-emerald-800"
            >
              {candidate.name}
              <span className="block font-mono break-all text-zinc-500">
                {candidate.sku}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SalesInvoiceImport({
  photoEnabled = false,
  onImport,
  onEditing,
}: {
  photoEnabled?: boolean;
  onImport: (
    items: ImportedSaleItem[],
    reference: string,
    buyer: string,
  ) => boolean;
  onEditing: (editing: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [source, setSource] = useState<"excel" | "photo">("excel");
  const [consent, setConsent] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);
  function chooseFile(next: File | null) {
    setFile(next);
    setPhotoUrl(next && source === "photo" ? URL.createObjectURL(next) : "");
    setConsent(false);
    setError("");
  }
  async function load() {
    if (!file || busy || (source === "photo" && (!photoEnabled || !consent)))
      return;
    setBusy(true);
    setError("");
    setAcknowledged(false);
    onEditing(true);
    const data = new FormData();
    try {
      data.set(
        "invoice",
        source === "photo" ? await compressInvoicePhoto(file) : file,
      );
      data.set("source", source);
      if (source === "photo" && consent) data.set("photoConsent", "yes");
      const response = await previewSalesInvoiceAction(data);
      if ("invoice" in response && response.invoice) {
        setPreview(response.invoice);
        setLines(
          response.invoice.lines.map((line) => ({ ...line, included: true })),
        );
      } else {
        setError(response.error ?? "Не удалось прочитать файл");
        onEditing(false);
      }
    } catch (error) {
      setError(
        error instanceof Error && source === "photo"
          ? error.message
          : "Не удалось загрузить накладную. Повторите попытку.",
      );
      onEditing(false);
    } finally {
      setBusy(false);
    }
  }
  function patch(key: string, change: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...change } : line)),
    );
    setAcknowledged(false);
  }
  function cancel() {
    setPreview(null);
    setLines([]);
    setError("");
    setAcknowledged(false);
    onEditing(false);
  }
  const included = lines.filter((line) => line.included);
  const total = included.reduce(
    (sum, line) => sum + (line.quantity ?? 0) * (line.unitPrice ?? 0),
    0,
  );
  const discrepancy =
    !!preview &&
    (preview.warnings.length > 0 ||
      included.length !== lines.length ||
      (preview.declaredTotal !== null && total !== preview.declaredTotal) ||
      included.some(
        (line) =>
          line.amount !== null &&
          (line.quantity ?? 0) * (line.unitPrice ?? 0) !== line.amount,
      ));
  const ids = included.map((line) => line.product?.id).filter(Boolean);
  const duplicate = new Set(ids).size !== ids.length;
  function issue(line: DraftLine) {
    return (
      validateInvoiceLine(line) ??
      (!line.product
        ? "Выберите товар сайта."
        : line.product.stockQuantity !== null &&
            line.quantity! > line.product.stockQuantity
          ? `Недостаточно остатка: ${line.product.stockQuantity}.`
          : null)
    );
  }
  const invalid =
    included.some((line) => issue(line)) ||
    duplicate ||
    !included.length ||
    !Number.isSafeInteger(total) ||
    total > MAX_SALE_AMOUNT;
  return (
    <div className="mt-4 min-w-0 border-y border-zinc-200 py-3 text-zinc-900">
      {!preview && (
        <div
          role="group"
          aria-label="Источник накладной"
          className="mb-3 flex gap-1"
        >
          {(["excel", "photo"] as const).map((mode) => (
            <button
              type="button"
              key={mode}
              disabled={busy}
              aria-pressed={source === mode}
              onClick={() => {
                setSource(mode);
                chooseFile(null);
              }}
              className={`flex min-h-10 items-center gap-2 rounded-md border px-3 text-xs ${source === mode ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-zinc-200"}`}
            >
              {mode === "photo" ? (
                <Camera className="size-4" />
              ) : (
                <FileUp className="size-4" />
              )}
              {mode === "photo" ? "Фото" : "Excel"}
            </button>
          ))}
        </div>
      )}
      {source === "photo" && !photoEnabled && (
        <p role="status" className="mb-3 text-xs text-amber-800">
          Распознавание фото ожидает подключения сервиса администратором. Excel
          доступен.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="grid min-w-0 flex-1 gap-1 text-xs font-medium">
          {source === "photo"
            ? "Фото накладной JPG / PNG / WebP"
            : "Накладная XLS / XLSX"}
          <Input
            key={source}
            type="file"
            accept={
              source === "photo"
                ? "image/jpeg,image/png,image/webp"
                : ".xls,.xlsx"
            }
            disabled={busy || !!preview}
            onChange={(event) => {
              chooseFile(event.target.files?.[0] ?? null);
            }}
            className="h-auto min-w-0 py-2 text-xs"
          />
        </label>
        {source === "photo" && !preview && (
          <label
            className={`flex min-h-10 items-center gap-2 rounded-md border border-zinc-200 px-3 text-xs ${busy ? "opacity-50" : "cursor-pointer"}`}
          >
            <Camera className="size-4" /> Камера
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              disabled={busy}
              className="sr-only"
              onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
            />
          </label>
        )}
        {!preview && (
          <Button
            type="button"
            variant="secondary"
            disabled={
              !file ||
              busy ||
              (source === "photo" && (!photoEnabled || !consent))
            }
            onClick={() => void load()}
            className="h-auto min-h-10 text-xs tracking-normal normal-case"
          >
            {busy ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <FileUp className="size-4" />
            )}
            {source === "photo"
              ? busy
                ? "Распознавание..."
                : "Распознать"
              : "Загрузить"}
          </Button>
        )}
        {preview && (
          <button
            type="button"
            onClick={cancel}
            title="Закрыть накладную"
            aria-label="Закрыть накладную"
            className="grid size-10 place-items-center rounded-md border border-zinc-200"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      {source === "photo" && file && photoUrl && (
        <a
          href={photoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block"
          aria-label="Открыть оригинал накладной"
        >
          {/* Local blob preview stays on the employee's device. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt="Фото накладной"
            className="max-h-64 w-full object-contain"
          />
        </a>
      )}
      {source === "photo" && !preview && (
        <label className="mt-3 flex items-start gap-2 text-xs text-zinc-600">
          <input
            type="checkbox"
            checked={consent}
            disabled={busy || !photoEnabled}
            onChange={(event) => setConsent(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-emerald-700"
          />
          Подтверждаю отправку фото накладной в OpenAI для распознавания. Фото
          не сохраняется на сайте.
        </label>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
      {preview && (
        <div className="mt-3 space-y-3">
          <p className="text-sm font-semibold break-words">
            {preview.title || preview.fileName}
          </p>
          {preview.customerName && (
            <p className="text-xs text-zinc-600">
              Покупатель в накладной: {preview.customerName}
            </p>
          )}
          {preview.warnings.map((warning) => (
            <p key={warning} className="text-xs text-amber-800">
              {warning}
            </p>
          ))}
          <div className="max-h-[32rem] space-y-3 overflow-y-auto">
            {lines.map((line) => (
              <div key={line.key} className="border-b border-zinc-200 pb-3">
                <label className="flex items-start gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={line.included}
                    onChange={(event) =>
                      patch(line.key, { included: event.target.checked })
                    }
                    className="mt-0.5 size-4 shrink-0 accent-emerald-700"
                  />
                  <span className="min-w-0 break-words">{line.name}</span>
                </label>
                {line.included && (
                  <div className="mt-2 space-y-2 pl-6">
                    <InvoiceProductPicker
                      product={line.product}
                      initialQuery={line.sku || line.name}
                      onChange={(product) =>
                        patch(line.key, {
                          product,
                          matchMessage: "Выбрано вручную",
                        })
                      }
                    />
                    <p className="text-xs text-zinc-500">{line.matchMessage}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="grid gap-1 text-xs">
                        Количество {line.unit}
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={line.quantity ?? ""}
                          onChange={(event) =>
                            patch(line.key, {
                              quantity: draftNumber(event.target.value),
                            })
                          }
                          className="h-10"
                        />
                      </label>
                      <label className="grid gap-1 text-xs">
                        Цена из накладной
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={line.unitPrice ?? ""}
                          onChange={(event) =>
                            patch(line.key, {
                              unitPrice: draftNumber(event.target.value),
                            })
                          }
                          className="h-10"
                        />
                      </label>
                    </div>
                    {issue(line) && (
                      <p className="text-xs text-red-700">{issue(line)}</p>
                    )}
                    <p className="text-xs">
                      Расчёт:{" "}
                      {money((line.quantity ?? 0) * (line.unitPrice ?? 0))} сом
                      {line.amount !== null &&
                        ` · В файле: ${money(line.amount)} сом`}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-sm font-semibold">
            Итого по выбранным позициям: {money(total)} сом
          </p>
          {preview.declaredTotal !== null && (
            <p className="text-xs text-zinc-600">
              Итог накладной: {money(preview.declaredTotal)} сом
            </p>
          )}
          {duplicate && (
            <p role="alert" className="text-xs text-red-700">
              Один товар выбран несколько раз. Оставьте одну строку с итоговым
              количеством.
            </p>
          )}
          {discrepancy && (
            <label className="flex items-start gap-2 text-xs text-amber-900">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-amber-700"
              />
              {source === "photo"
                ? "Я сверил все товары, количество, цены и суммы с фото накладной."
                : "Подтверждаю выбранные количество и цены, несмотря на расхождения с накладной."}
            </label>
          )}
          <Button
            type="button"
            variant="accent"
            disabled={invalid || (discrepancy && !acknowledged)}
            onClick={() => {
              if (invalid || (discrepancy && !acknowledged)) return;
              if (
                onImport(
                  included.map((line) => ({
                    product: line.product!,
                    quantity: line.quantity!,
                    unitPrice: line.unitPrice!,
                  })),
                  preview.title || preview.fileName,
                  preview.customerName,
                )
              )
                cancel();
            }}
            className="h-auto min-h-10 w-full py-2 text-xs tracking-normal normal-case"
          >
            <Check className="size-4" />
            Перенести в продажу: {included.length}
          </Button>
        </div>
      )}
    </div>
  );
}
