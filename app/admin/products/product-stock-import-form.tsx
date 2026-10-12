"use client";

import { useState, useTransition } from "react";
import { Check, Download, FileSearch, LoaderCircle } from "lucide-react";
import { processStockImportAction } from "@/app/admin/products/stock-import-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StockReconciliationTable } from "@/app/admin/products/stock-reconciliation-table";
import {
  inventoryStatusLabels,
  stockImportStatusLabels,
  type StockImportMode,
  type StockImportResult,
  type StockValues,
} from "@/features/admin/stock-import";

const modes: Array<{ value: StockImportMode; label: string }> = [
  { value: "all", label: "Цены и остатки" },
  { value: "stock", label: "Только остатки" },
  { value: "price", label: "Только цены" },
];
const fields: Array<{ key: keyof StockValues; label: string }> = [
  { key: "price", label: "Цена" },
  { key: "compareAtPrice", label: "Старая цена" },
  { key: "stockQuantity", label: "Остаток" },
  { key: "inventoryStatus", label: "Наличие" },
];
function formatValue(value: StockValues[keyof StockValues] | undefined) {
  if (value === null || value === undefined) return "—";
  return typeof value === "number"
    ? value.toLocaleString("ru-RU")
    : inventoryStatusLabels[value];
}

export function ProductStockImportForm({
  importAction = processStockImportAction,
}: {
  importAction?: (data: FormData) => Promise<StockImportResult>;
} = {}) {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<StockImportMode>("stock");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<StockImportResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [intent, setIntent] = useState<"preview" | "apply">("preview");

  function submit(nextIntent: "preview" | "apply") {
    if (!file || pending) return;
    if (
      nextIntent === "apply" &&
      !window.confirm(
        `Обновить товаров: ${result?.reconciliation ? selected.size : (result?.counts?.ready ?? 0)}? Остальные строки останутся без изменений.`,
      )
    )
      return;
    setIntent(nextIntent);
    const data = new FormData();
    data.set("stockFile", file);
    data.set("mode", mode);
    data.set("intent", nextIntent);
    if (result?.fingerprint) data.set("fingerprint", result.fingerprint);
    if (result?.reconciliation)
      data.set("selectedRows", JSON.stringify([...selected]));
    startTransition(async () => {
      try {
        setResult(await importAction(data));
        setSelected(new Set());
      } catch {
        setResult({
          phase: "error",
          message:
            "Не удалось получить ответ сервера. Проверьте соединение и повторите проверку файла перед применением. Для большой таблицы попробуйте CSV или несколько файлов.",
        });
      }
    });
  }
  function downloadReport() {
    if (!result?.reportCsv) return;
    const url = URL.createObjectURL(
      new Blob([result.reportCsv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `stock-import-${result.phase}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="mt-4 min-w-0 space-y-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit("preview");
        }}
      >
        <fieldset disabled={pending} className="min-w-0 space-y-4">
          <legend className="sr-only">Обновление цен и остатков</legend>
          <div
            className="grid grid-cols-1 gap-1 rounded-lg bg-zinc-100 p-1 sm:grid-cols-3"
            role="radiogroup"
            aria-label="Режим обновления"
          >
            {modes.map((item) => (
              <label
                key={item.value}
                className={`relative flex min-h-10 cursor-pointer items-center justify-center rounded-md px-2 py-2 text-center text-xs font-semibold ${mode === item.value ? "bg-white text-emerald-800 shadow-sm" : "text-zinc-600"}`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={item.value}
                  checked={mode === item.value}
                  onChange={() => {
                    setMode(item.value);
                    setResult(null);
                    setSelected(new Set());
                  }}
                  className="peer sr-only"
                />
                <span className="absolute inset-0 rounded-md peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-600" />
                {item.label}
              </label>
            ))}
          </div>
          <label className="grid min-w-0 gap-2 text-sm font-medium">
            Файл Excel / CSV
            <Input
              type="file"
              accept=".xlsx,.xls,.csv,.tsv"
              required
              aria-label="Файл цен и остатков"
              className="h-auto min-h-11 min-w-0 py-2 text-xs"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setResult(null);
                setSelected(new Set());
              }}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              variant="secondary"
              disabled={!file || pending}
              className="h-auto min-h-10 py-2 tracking-normal normal-case"
            >
              {pending && intent === "preview" ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <FileSearch className="size-4" />
              )}
              {pending && intent === "preview"
                ? "Проверяем..."
                : "Проверить файл"}
            </Button>
            <a
              href="/templates/product-stock-update-template.xlsx"
              download
              className="inline-flex items-center gap-2 text-xs font-medium underline underline-offset-4"
            >
              <Download className="size-4" />
              Шаблон Excel
            </a>
          </div>
        </fieldset>
      </form>

      {result ? (
        <div
          className="min-w-0 space-y-3 border-t border-[color:var(--line)] pt-4"
          aria-busy={pending}
        >
          <p
            role="status"
            className={`text-sm font-medium ${result.phase === "error" ? "text-red-700" : "text-emerald-800"}`}
          >
            {result.message}
          </p>
          {result.counts ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
              {Object.entries(result.counts)
                .filter(
                  ([key, count]) =>
                    count > 0 ||
                    key === (result.phase === "done" ? "updated" : "ready"),
                )
                .map(([key, count]) => (
                  <div
                    key={key}
                    className="flex items-baseline justify-between gap-2 border-b border-zinc-200 pb-2"
                  >
                    <dt>
                      {
                        stockImportStatusLabels[
                          key as keyof typeof stockImportStatusLabels
                        ]
                      }
                    </dt>
                    <dd className="font-semibold tabular-nums">{count}</dd>
                  </div>
                ))}
            </dl>
          ) : null}
          {!!result.warnings?.length && (
            <ul className="space-y-1 text-xs text-amber-800">
              {result.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          )}
          {!!result.columns?.length && (
            <details className="text-xs">
              <summary className="cursor-pointer py-1 font-medium">
                Распознанные колонки
              </summary>
              <ul className="mt-2 space-y-1 text-zinc-600">
                {result.columns.map((column, index) => (
                  <li key={index}>
                    {column.source} → {column.target}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {result.reconciliation && (
            <StockReconciliationTable
              key={result.fingerprint ?? result.phase}
              entries={result.reconciliation}
              selected={selected}
              onSelection={setSelected}
              disabled={pending}
              preview={result.phase === "preview"}
            />
          )}
          {!result.reconciliation && !!result.entries?.length && (
            <div
              className="max-h-96 overflow-auto border-y border-zinc-200"
              tabIndex={0}
              role="region"
              aria-label="Результаты проверки строк"
            >
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="sticky top-0 bg-zinc-100">
                  <tr>
                    <th className="p-2 font-medium">Товар / строка</th>
                    <th className="p-2 font-medium">
                      {result.phase === "done"
                        ? "Было → стало"
                        : "Было → станет"}
                    </th>
                    <th className="p-2 font-medium">Результат</th>
                  </tr>
                </thead>
                <tbody>
                  {result.entries.map((entry, index) => (
                    <tr
                      key={index}
                      className="border-t border-zinc-200 align-top"
                    >
                      <td className="max-w-56 p-2 break-words">
                        <p className="font-medium">{entry.name || entry.sku}</p>
                        <p className="mt-1 font-mono break-all text-zinc-500">
                          {entry.sku}
                        </p>
                        <p className="mt-1 text-zinc-500">
                          {entry.sheet}: {entry.row}
                        </p>
                      </td>
                      <td className="p-2">
                        {fields
                          .filter(({ key }) => key in entry.changes)
                          .map(({ key, label }) => (
                            <p key={key} className="mb-1">
                              <span className="text-zinc-500">{label}: </span>
                              {formatValue(entry.before?.[key])} →{" "}
                              <strong>{formatValue(entry.changes[key])}</strong>
                            </p>
                          ))}
                        {!Object.keys(entry.changes).length ? "—" : null}
                      </td>
                      <td className="max-w-52 p-2">
                        <p
                          className={
                            entry.status === "skipped" ||
                            entry.status === "error" ||
                            entry.status === "conflict"
                              ? "font-medium text-amber-800"
                              : "font-medium text-emerald-800"
                          }
                        >
                          {stockImportStatusLabels[entry.status]}
                        </p>
                        {entry.reason && (
                          <p className="mt-1 leading-5 text-zinc-600">
                            {entry.reason}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!result.reconciliation &&
          result.total &&
          result.total > (result.entries?.length ?? 0) ? (
            <p className="text-xs text-zinc-500">
              Показано {result.entries?.length} из {result.total} строк. Все
              распознанные строки — в отчёте CSV.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {result.phase === "preview" && !!result.counts?.ready && (
              <Button
                type="button"
                variant="accent"
                disabled={
                  pending || (!!result.reconciliation && !selected.size)
                }
                onClick={() => submit("apply")}
                className="h-auto min-h-10 py-2 tracking-normal normal-case"
              >
                {pending && intent === "apply" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                {pending && intent === "apply"
                  ? "Применяем..."
                  : `Применить: ${result.reconciliation ? selected.size : result.counts.ready}`}
              </Button>
            )}
            {result.reportCsv && (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={downloadReport}
                className="h-auto min-h-10 py-2 tracking-normal normal-case"
              >
                <Download className="size-4" />
                Отчёт CSV
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
