"use client";

import { useEffect, useMemo, useState } from "react";

import { BazisViewer } from "@/components/bazis/bazis-viewer";
import { guessDecorColor } from "@/features/bazis/decor-color";
import {
  toBazisPartInfo,
  type BazisViewProject,
  type BazisViewResponse,
} from "@/features/bazis/project-view";

// Объёмный вид проекта Базиса сразу после выбора файла: в калькуляторе
// распила и в форме приёма заказа. Файл только читается, копия на сайте
// здесь не сохраняется.
export function BazisFilePreview({ file }: { file: File | null }) {
  const [project, setProject] = useState<BazisViewProject | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) {
      return;
    }

    const controller = new AbortController();
    const body = new FormData();

    body.set("file", file);
    // Состояние зависит от файла, который пришёл снаружи.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState("loading");
    setProject(null);

    fetch("/api/bazis/project?keep=0", {
      method: "POST",
      body,
      signal: controller.signal,
    })
      .then((response) => response.json() as Promise<BazisViewResponse>)
      .then((result) => {
        if (result.ok) {
          setProject(result.project);
          setState("idle");
        } else {
          setError(result.error);
          setState("error");
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return;

        setError("Не получилось показать макет: проверьте интернет.");
        setState("error");
      });

    return () => controller.abort();
  }, [file]);

  const boxes = useMemo(
    () =>
      (project?.panels ?? []).map((panel) => ({
        ...panel.box,
        thickness: panel.thickness,
        tone: panel.material,
        info: toBazisPartInfo(panel, project?.materials ?? []),
      })),
    [project],
  );
  const toneColors = useMemo(
    () => (project?.materials ?? []).map((name) => guessDecorColor(name)),
    [project],
  );

  if (!file) {
    return null;
  }

  return (
    <div className="grid gap-2 border border-[#d7d4ce] bg-white p-3">
      <p className="text-sm font-semibold text-[#252b29]">
        Макет проекта{project?.orderName ? ` «${project.orderName}»` : ""}
        <span className="ml-2 font-normal text-[#69716d]">{file.name}</span>
      </p>
      {state === "loading" ? (
        <p className="text-sm text-[#69716d]">Строим макет…</p>
      ) : null}
      {state === "error" ? (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {project ? (
        <>
          <p className="text-xs text-[#69716d]">
            Деталей: {project.panels.length}. Материалы:{" "}
            {project.materials.filter(Boolean).join("; ") || "не указаны"}.
          </p>
          <BazisViewer
            boxes={boxes}
            toneColors={toneColors}
            heightClassName="h-[42vh] min-h-64"
          />
        </>
      ) : null}
    </div>
  );
}
