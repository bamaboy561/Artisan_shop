"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Download, Send } from "lucide-react";

type ExecutiveReportActionsProps = {
  reportText: string;
  csvContent?: string;
  csvFileName?: string;
};

export function ExecutiveReportActions({
  reportText,
  csvContent,
  csvFileName = "artisan-report.csv",
}: ExecutiveReportActionsProps) {
  const [copied, setCopied] = useState(false);
  const telegramHref = useMemo(() => {
    const text = encodeURIComponent(reportText);
    return `https://t.me/share/url?url=&text=${text}`;
  }, [reportText]);

  async function copyReport() {
    await navigator.clipboard.writeText(reportText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadCsv() {
    if (!csvContent) return;

    const blob = new Blob(["\uFEFF", csvContent], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = csvFileName;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={copyReport}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[color:var(--line-strong)] bg-white px-3 text-sm font-medium text-[var(--foreground)] transition hover:border-[color:var(--foreground)] hover:bg-[var(--foreground)] hover:text-white"
      >
        {copied ? (
          <Check className="size-4" strokeWidth={1.9} />
        ) : (
          <Copy className="size-4" strokeWidth={1.9} />
        )}
        {copied ? "Скопировано" : "Скопировать"}
      </button>
      {csvContent ? (
        <button
          type="button"
          onClick={downloadCsv}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[color:var(--line-strong)] bg-white px-3 text-sm font-medium text-[var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent)]"
        >
          <Download className="size-4" strokeWidth={1.9} />
          Скачать CSV
        </button>
      ) : null}
      <a
        href={telegramHref}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#1f2b25] px-4 text-sm font-medium text-white transition hover:bg-[#c4532b]"
      >
        <Send className="size-4" strokeWidth={1.9} />
        Отправить
      </a>
    </div>
  );
}
