"use client";

import { Download } from "lucide-react";

type DownloadCsvButtonProps = {
  csvContent: string;
  fileName: string;
  label?: string;
};

export function DownloadCsvButton({
  csvContent,
  fileName,
  label = "Скачать для Excel",
}: DownloadCsvButtonProps) {
  function downloadCsv() {
    // BOM нужен, чтобы Excel открыл кириллицу в UTF-8 без кракозябр.
    const blob = new Blob(["﻿", csvContent], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={downloadCsv}
      className="inline-flex h-11 items-center justify-center gap-2 border border-[color:var(--line-strong)] bg-white px-4 text-sm font-medium text-[var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent)]"
    >
      <Download className="size-4" strokeWidth={1.9} />
      {label}
    </button>
  );
}
