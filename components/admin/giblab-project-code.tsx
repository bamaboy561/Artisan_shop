import { getOrCreateBazisProjectCode } from "@/lib/server/bazis-project-code";

type RequestFileRef = { id: string; fileName: string };

// Код проекта для GibLab у заявки с файлом Базиса. Оператор цеха дописывает
// его к названию проекта в GibLab, и QR-код «СБОРКА» на этикетке детали
// открывает её место на макете.
export async function getGibLabProjectCode(
  requestId: string,
  files: RequestFileRef[],
) {
  const file = files.find((item) => /\.b3d$/i.test(item.fileName));

  if (!file) {
    return null;
  }

  try {
    return (
      (await getOrCreateBazisProjectCode(requestId, file.id))?.code ?? null
    );
  } catch (error) {
    console.error("[bazis:project-code]", error);
    return null;
  }
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

  return (
    <div className="border border-[color:var(--line-strong)] bg-[#faf8f4] p-4 text-sm leading-6">
      <p className="font-semibold">
        Код для GibLab:
        <span className="ml-2 bg-[#252b29] px-2 py-1 font-mono text-base tracking-[0.2em] text-white">
          {code}
        </span>
      </p>
      <p className="mt-2 text-[var(--muted)]">
        Перед распилом допишите код к названию проекта в GibLab через
        подчёркивание, без пробелов: «{example}». Тогда QR-код «СБОРКА» на
        этикетке покажет сборщику, где стоит деталь.
      </p>
    </div>
  );
}
