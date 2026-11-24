import { applyGibLabProjectAction } from "@/app/admin/cutting/pricing/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import {
  isGibLabProjectFileName,
  readRequestGibLabSummary,
} from "@/lib/server/giblab-project-apply";

type RequestFileRef = {
  id: string;
  fileName: string;
  fileUrl: string;
  createdAt?: Date | string | null;
};

const fmt = (value: number) =>
  value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });

// Готовый заказ GibLab в заявке: что в нём насчитано и кнопка «Перенести
// в заявку» (листы, кромка, присадка, фрезеровка → строки и сумма работ).
export async function GibLabProjectPanel({
  requestId,
  files,
  error,
}: {
  requestId: string;
  files: RequestFileRef[];
  error?: string;
}) {
  const projects = files
    .filter((file) => isGibLabProjectFileName(file.fileName))
    .sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime(),
    )
    .slice(0, 3);

  if (projects.length === 0) return null;

  const summaries = await Promise.all(
    projects.map(async (file) => ({
      file,
      summary: await readRequestGibLabSummary(file.fileUrl).catch(() => null),
    })),
  );

  return (
    <section
      id="giblab"
      className="surface-glow rounded-[var(--radius-card)] border border-[color:var(--line)] bg-white/82 p-6"
    >
      <h2 className="text-lg font-semibold text-[var(--foreground)]">
        Заказ из GibLab
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Листы, кромка и отверстия из готового проекта GibLab. «Перенести в
        заявку» заменит листы и кромку заявки и пересчитает сумму работ.
      </p>
      {error ? (
        <p
          role="alert"
          className="mt-3 border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </p>
      ) : null}
      <div className="mt-4 grid gap-4">
        {summaries.map(({ file, summary }) => {
          const holes = summary
            ? Object.entries(summary.drilling).sort(
                (a, b) => Number(a[0]) - Number(b[0]),
              )
            : [];
          return (
            <div
              key={file.id}
              className="border border-[color:var(--line)] bg-[var(--surface)] p-4 text-sm"
            >
              <p className="font-semibold break-all">{file.fileName}</p>
              {!summary ? (
                <p className="mt-2 text-[var(--muted)]">
                  Файл не читается как проект GibLab.
                </p>
              ) : (
                <>
                  <dl className="mt-3 grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
                    {summary.sheets.map((sheet, index) => (
                      <div key={`s${index}`} className="contents">
                        <dt className="text-[var(--muted)]">
                          {sheet.name}
                          {sheet.thicknessMm
                            ? ` ${fmt(sheet.thicknessMm)} мм`
                            : ""}
                          {sheet.lengthMm && sheet.widthMm
                            ? `, ${sheet.lengthMm}×${sheet.widthMm}`
                            : ""}
                        </dt>
                        <dd className="font-medium">
                          {sheet.sheets} л. · {sheet.parts} дет.
                        </dd>
                      </div>
                    ))}
                    {summary.bands.map((band, index) => (
                      <div key={`b${index}`} className="contents">
                        <dt className="text-[var(--muted)]">
                          Кромка {band.name}
                          {band.thicknessMm && band.widthMm
                            ? ` ${fmt(band.thicknessMm)}/${fmt(band.widthMm)}`
                            : ""}
                        </dt>
                        <dd className="font-medium">
                          {fmt(band.meters)} м
                          {band.metersWithWaste
                            ? ` (с запасом ${fmt(band.metersWithWaste)} м)`
                            : ""}
                        </dd>
                      </div>
                    ))}
                    {holes.length > 0 ? (
                      <div className="contents">
                        <dt className="text-[var(--muted)]">Присадка</dt>
                        <dd className="font-medium">
                          {holes
                            .map(
                              ([d, count]) =>
                                `Ø${d.replace(".", ",")} — ${count}`,
                            )
                            .join(", ")}{" "}
                          (пласть {summary.faceHoles}, торец {summary.edgeHoles}
                          )
                        </dd>
                      </div>
                    ) : null}
                    {summary.millMeters > 0 || summary.grooveMeters > 0 ? (
                      <div className="contents">
                        <dt className="text-[var(--muted)]">
                          Фрезеровка / пазы
                        </dt>
                        <dd className="font-medium">
                          {fmt(summary.millMeters)} м /{" "}
                          {fmt(summary.grooveMeters)} м
                        </dd>
                      </div>
                    ) : null}
                    {summary.cost ? (
                      <div className="contents">
                        <dt className="text-[var(--muted)]">Сумма в GibLab</dt>
                        <dd className="font-medium">
                          {fmt(summary.cost)} {summary.currency ?? "сом"}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  <form action={applyGibLabProjectAction} className="mt-4">
                    <input type="hidden" name="requestId" value={requestId} />
                    <input type="hidden" name="fileId" value={file.id} />
                    <AdminSubmitButton
                      type="submit"
                      variant="accent"
                      size="sm"
                      idleLabel="Перенести в заявку"
                      pendingLabel="Переносим..."
                    />
                  </form>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
