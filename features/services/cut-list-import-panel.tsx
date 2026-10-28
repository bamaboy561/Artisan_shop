"use client";

import { useRef, useState } from "react";

import { Camera, ClipboardPaste, FileSpreadsheet, Upload } from "lucide-react";

import { BazisFilePreview } from "@/components/bazis/bazis-file-preview";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { compressInvoicePhoto } from "@/features/admin/invoice-photo-client";
import {
  cutListTemplateRows,
  parseCutListRows,
  parseCutListText,
  type CutListImportResult,
  type ImportedDetail,
} from "@/features/services/cut-list-import";
import {
  groupDetailsByMaterial,
  type BazisImportResponse,
  type BazisMaterialGroup,
} from "@/features/services/bazis-import";
import type { CutListPhotoResponse } from "@/features/services/cut-list-photo-result";
import { cn } from "@/lib/utils";

type ImportMode = "append" | "replace";

type CutListImportPanelProps = {
  onImport: (details: ImportedDetail[], mode: ImportMode) => void;
  onProjectFile?: (file: File) => void;
  /** Показывать кнопку «Фото списка» (на сервере есть ключ распознавания). */
  photoEnabled?: boolean;
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

async function readCutListPhoto(file: File): Promise<CutListPhotoResponse> {
  let photo: File;
  try {
    photo = await compressInvoicePhoto(file);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Не удалось подготовить фото.",
    };
  }

  const body = new FormData();
  body.append("file", photo);

  try {
    const response = await fetch("/api/cutting/photo", {
      method: "POST",
      body,
    });
    return (await response.json()) as CutListPhotoResponse;
  } catch {
    return { ok: false, error: "Нет связи с сайтом. Попробуйте ещё раз." };
  }
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

async function readBazisProject(file: File): Promise<BazisImportResponse> {
  const body = new FormData();
  body.append("file", file);

  try {
    const response = await fetch("/api/bazis/parts", { method: "POST", body });
    return (await response.json()) as BazisImportResponse;
  } catch {
    return {
      ok: false,
      error: "Нет связи с сайтом. Попробуйте ещё раз.",
    };
  }
}

function formatGroupLabel(group: BazisMaterialGroup) {
  return `${group.material}${
    !group.thickness || group.material.includes(String(group.thickness))
      ? ""
      : `, ${group.thickness} мм`
  }`;
}

export function CutListImportPanel({
  onImport,
  onProjectFile,
  photoEnabled = false,
}: CutListImportPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ImportMode>("replace");
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [bazisChoice, setBazisChoice] = useState<{
    orderName: string;
    groups: BazisMaterialGroup[];
    source: "bazis" | "table";
  } | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [bazisPreviewFile, setBazisPreviewFile] = useState<File | null>(null);
  const [photoNotes, setPhotoNotes] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const applyResult = (result: CutListImportResult) => {
    setPhotoNotes([]);
    if (result.details.length === 0) {
      setFeedback({
        tone: "error",
        message:
          "Не нашли размеров. Нужны колонки: название, длина, ширина, количество, кромка.",
      });
      return;
    }

    const groups = groupDetailsByMaterial(result.details);

    if (groups.length > 1) {
      setBazisChoice({ orderName: "", groups, source: "table" });
      setFeedback(null);
      setText("");
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

  const applyBazisGroup = (
    group: BazisMaterialGroup,
    groups: BazisMaterialGroup[],
    source: "bazis" | "table" = "bazis",
  ) => {
    onImport(group.details, mode);
    const others = groups.filter((item) => item !== group);
    const notes = [
      `${source === "bazis" ? "Из проекта Базиса" : "Из таблицы"}: ${formatGroupLabel(group)}, ${group.details.length} поз. (${group.pieces} дет.).`,
      group.complexCount > 0
        ? `У ${group.complexCount} дет. вырезы или скругления: размер взят по габариту, проверьте.`
        : "",
      others.length > 0
        ? `Другие материалы проекта (${others
            .map(formatGroupLabel)
            .join(
              "; ",
            )}) считаются отдельно: выберите их выше, когда понадобится.`
        : "",
      onProjectFile && source === "bazis"
        ? "Файл проекта приложен к заявке."
        : "",
      "Проверьте материал, кромку и направление текстуры ниже.",
    ];

    setFeedback({ tone: "success", message: notes.filter(Boolean).join(" ") });
  };

  const handleBazisFile = async (file: File) => {
    setIsReadingFile(true);
    const result = await readBazisProject(file);
    setIsReadingFile(false);

    if (!result.ok) {
      setBazisChoice(null);
      setFeedback({ tone: "error", message: result.error });
      return;
    }

    onProjectFile?.(file);
    setBazisPreviewFile(file);

    if (result.groups.length > 1) {
      setBazisChoice({
        orderName: result.orderName,
        groups: result.groups,
        source: "bazis",
      });
      setFeedback(null);
      return;
    }

    setBazisChoice(null);
    applyBazisGroup(result.groups[0], result.groups);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setPhotoNotes([]);

    if (file.name.toLowerCase().endsWith(".b3d")) {
      await handleBazisFile(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    try {
      setBazisChoice(null);
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

  const handlePhoto = async (file: File | undefined) => {
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
    if (!file) return;

    setIsReadingFile(true);
    setBazisChoice(null);
    setPhotoNotes([]);
    const result = await readCutListPhoto(file);
    setIsReadingFile(false);

    if (!result.ok) {
      setFeedback({ tone: "error", message: result.error });
      return;
    }

    // Оригинал фото уходит менеджеру вместе с заявкой для сверки.
    onProjectFile?.(file);
    applyResult(result);
    setPhotoNotes(result.warnings);
  };

  return (
    <div className="mt-3.5 border border-dashed border-[color:var(--line-strong)] bg-[var(--surface)] p-3 sm:mt-5 sm:p-4">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--accent)]">
            Список деталей готов?
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
            Загрузите проект Базиса (.b3d), таблицу Excel
            {photoEnabled ? ", фото списка" : ""} или список деталей из
            SketchUp (выгрузка OpenCutList), детали появятся сами.
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
            disabled={isReadingFile}
            className="w-full sm:w-auto"
          >
            <Upload className="size-4" />
            {isReadingFile ? "Читаем файл…" : "Excel / Базис"}
          </Button>
          {photoEnabled ? (
            <Button
              variant="secondary"
              onClick={() => photoInputRef.current?.click()}
              disabled={isReadingFile}
              className="col-span-2 w-full sm:col-span-1 sm:w-auto"
            >
              <Camera className="size-4" />
              {isReadingFile ? "Распознаём…" : "Фото списка"}
            </Button>
          ) : null}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => void handlePhoto(event.target.files?.[0])}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.txt,.b3d"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </div>
      </div>

      {bazisPreviewFile ? (
        <div className="mt-3">
          <BazisFilePreview file={bazisPreviewFile} />
        </div>
      ) : null}

      {bazisChoice ? (
        <div className="mt-3 grid gap-2">
          <p className="text-[13px] font-medium text-[var(--foreground)]">
            {bazisChoice.orderName
              ? `Проект «${bazisChoice.orderName}»: `
              : bazisChoice.source === "table"
                ? "В таблице "
                : "В проекте "}
            несколько материалов. Калькулятор считает один материал за раз,
            выберите, с какого начать.
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {bazisChoice.groups.map((group) => (
              <button
                key={`${group.material}-${group.thickness}`}
                type="button"
                onClick={() =>
                  applyBazisGroup(group, bazisChoice.groups, bazisChoice.source)
                }
                className="border border-[color:var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-left text-[13px] transition hover:border-[var(--accent)]"
              >
                <span className="block font-semibold text-[var(--foreground)]">
                  {formatGroupLabel(group)}
                </span>
                <span className="block text-[12px] text-[var(--muted)]">
                  {group.pieces} дет., {group.areaM2.toLocaleString("ru-RU")} м²
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

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
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]"
                      : "border-[color:var(--line)] bg-[var(--surface-strong)] text-[var(--muted)]",
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
          {photoEnabled
            ? "Другой файл или эскиз? Прикрепите к заявке"
            : "Есть фото списка или другой файл? Прикрепите к заявке"}
        </a>
      </div>

      {feedback ? (
        <p
          role="status"
          className={cn(
            "mt-2.5 border px-3 py-2 text-[12px] leading-5",
            feedback.tone === "success"
              ? "border-[rgba(55,131,82,0.2)] bg-[rgba(55,131,82,0.08)] text-[#7cc49a]"
              : "border-[rgba(185,88,45,0.18)] bg-[rgba(185,88,45,0.08)] text-[var(--accent)]",
          )}
        >
          {feedback.message}
        </p>
      ) : null}

      {photoNotes.length > 0 ? (
        <ul
          aria-label="Проверьте после распознавания"
          className="mt-2 grid gap-1 border border-[rgba(185,88,45,0.18)] bg-[rgba(185,88,45,0.06)] px-3 py-2 text-[12px] leading-5 text-[var(--foreground)]"
        >
          {photoNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
