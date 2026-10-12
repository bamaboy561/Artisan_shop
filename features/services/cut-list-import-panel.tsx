"use client";

import { useRef, useState } from "react";

import { ClipboardPaste, FileSpreadsheet, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  cutListTemplateRows,
  parseCutListRows,
  parseCutListText,
  type CutListImportResult,
  type ImportedDetail,
} from "@/features/services/cut-list-import";
import { cn } from "@/lib/utils";

type ImportMode = "append" | "replace";

type CutListImportPanelProps = {
  onImport: (details: ImportedDetail[], mode: ImportMode) => void;
};

const pastePlaceholder = `Боковина\t720\t560\t2\t2Д
Полка\t564\t540\t3\t1Д
Фасад\t716\t396\t2\tкругом`;

async function readSpreadsheet(file: File): Promise<CutListImportResult> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (extension === "csv" || extension === "txt") {
    return parseCutListText(await file.text());
  }

  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!firstSheet) {
    return { details: [], skippedLines: 0 };
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  return parseCutListRows(
    rows.map((row) => row.map((cell) => String(cell ?? ""))),
  );
}

async function downloadTemplate() {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet(cutListTemplateRows);
  sheet["!cols"] = [
    { wch: 22 },
    ...cutListTemplateRows[0].slice(1).map(() => ({ wch: 9 })),
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Детали");
  XLSX.writeFile(workbook, "artisan-raskroy-shablon.xlsx");
}

export function CutListImportPanel({ onImport }: CutListImportPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ImportMode>("replace");
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyResult = (result: CutListImportResult) => {
    if (result.details.length === 0) {
      setFeedback({
        tone: "error",
        message:
          "Не нашли размеров. Нужны колонки: название, длина, ширина, количество, кромка.",
      });
      return;
    }

    onImport(result.details, mode);
    const pieces = result.details.reduce(
      (sum, detail) => sum + detail.quantity,
      0,
    );
    setFeedback({
      tone: "success",
      message: `Добавлено ${result.details.length} поз. (${pieces} дет.)${
        result.skippedLines > 0
          ? `, пропущено строк без размеров: ${result.skippedLines}`
          : ""
      }. Проверьте кромку и ориентацию ниже.`,
    });
    setText("");
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;

    try {
      applyResult(await readSpreadsheet(file));
    } catch {
      setFeedback({
        tone: "error",
        message:
          "Не получилось прочитать файл. Сохраните его как .xlsx или .csv, либо скопируйте строки и вставьте их сюда.",
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="mt-3.5 border border-dashed border-[color:var(--line-strong)] bg-[#fcfaf6] p-3 sm:mt-5 sm:p-4">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--accent)] uppercase">
            Список деталей готов?
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
            Вставьте из Excel или загрузите файл, детали появятся сами.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <Button
            variant={isOpen ? "secondary" : "accent"}
            onClick={() => setIsOpen((current) => !current)}
            className="w-full sm:w-auto"
          >
            <ClipboardPaste className="size-4" />
            Вставить список
          </Button>
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            className="w-full sm:w-auto"
          >
            <Upload className="size-4" />
            Excel / CSV
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.txt"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </div>
      </div>

      {isOpen ? (
        <div className="mt-3 grid gap-2.5">
          <Textarea
            className="min-h-[132px] font-mono text-[12px] sm:text-[13px]"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={pastePlaceholder}
            aria-label="Список деталей"
          />
          <p className="text-[11px] leading-4.5 text-[var(--muted)]">
            Порядок колонок: название, длина вдоль текстуры, ширина, количество,
            кромка. Кромку можно писать как «2Д», «1Д 1Ш», «кругом» или четырьмя
            колонками Д1 Д2 Ш1 Ш2 (1 есть, 0 нет).
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1.5 text-[12px]">
              {(
                [
                  ["replace", "Заменить список"],
                  ["append", "Добавить к списку"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  aria-pressed={mode === value}
                  className={cn(
                    "border px-2.5 py-1.5 transition",
                    mode === value
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[color:var(--line)] bg-white text-[var(--muted)]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button
              variant="accent"
              onClick={() => applyResult(parseCutListText(text))}
              disabled={!text.trim()}
              className="w-full sm:w-auto"
            >
              Разобрать детали
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] leading-4.5 text-[var(--muted)] sm:text-[12px]">
        <button
          type="button"
          onClick={() => void downloadTemplate()}
          className="inline-flex items-center gap-1.5 text-[var(--foreground)] underline underline-offset-2"
        >
          <FileSpreadsheet className="size-3.5" />
          Скачать шаблон Excel
        </button>
        <a
          href="#cut-request-form"
          className="text-[var(--foreground)] underline underline-offset-2"
        >
          Есть проект Базиса или фото списка? Прикрепите к заявке
        </a>
      </div>

      {feedback ? (
        <p
          role="status"
          className={cn(
            "mt-2.5 border px-3 py-2 text-[12px] leading-5",
            feedback.tone === "success"
              ? "border-[rgba(55,131,82,0.2)] bg-[rgba(55,131,82,0.08)] text-[#2f6a41]"
              : "border-[rgba(185,88,45,0.18)] bg-[rgba(185,88,45,0.08)] text-[#8c4a27]",
          )}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
