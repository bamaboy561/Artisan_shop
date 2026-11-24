import { orderedBazisFiles } from "@/features/production/giblab-orders";
import { getRequestBazisCode } from "@/lib/server/giblab-orders";

type RequestFileRef = {
  id: string;
  fileName: string;
  createdAt?: Date | string | null;
};

// Код проекта для GibLab у заявки с файлом Базиса. Сайт сам дописывает его
// в имя файла заказа GibLab, и QR-код «СБОРКА» на этикетке детали
// открывает её место на макете. Один код на заявку, на все файлы Базиса.
export async function getGibLabProjectCode(
  requestId: string,
  files: RequestFileRef[],
) {
  return (await getRequestBazisCode(requestId, files))?.code ?? null;
}

export async function GibLabProjectCode({
  requestId,
  files,
  clientName,
}: {
  requestId: string;
  files: RequestFileRef[];
  clientName?: string;
}) {
  const code = await getGibLabProjectCode(requestId, files);

  if (!code) {
    return null;
  }

  const example = `${(clientName ?? "Клиент").trim().split(/\s+/)[0] || "Клиент"}_${code}`;
  const severalFiles = orderedBazisFiles(files).length > 1;

  return (
    <div className="border border-[color:var(--line-strong)] bg-[var(--surface)] p-4 text-sm leading-6">
      <p className="font-semibold">
        Код для GibLab:
        <span className="ml-2 bg-[var(--solid)] px-2 py-1 font-mono text-base tracking-[0.2em] text-white">
          {code}
        </span>
      </p>
      <p className="mt-2 text-[var(--muted)]">
        Сайт сам дописывает этот код в имя файла заказа GibLab, и QR-код
        «СБОРКА» на этикетке покажет сборщику, где стоит деталь. Если проект в
        GibLab создали вручную, допишите код к названию без пробелов внутри
        кода: «{example}».
        {severalFiles
          ? " Файлов Базиса несколько: в GibLab позиция идёт с номером файла, «2-5» — файл 2, позиция 5."
          : ""}
      </p>
    </div>
  );
}
