import Link from "next/link";
import { redirect } from "next/navigation";
import { HardDrive } from "lucide-react";

import { SetupState } from "@/components/admin/setup-state";
import { requireAdminSession } from "@/lib/auth/dal";
import { canManageProduction } from "@/lib/auth/roles";
import { hasDatabaseUrl } from "@/lib/db";
import {
  isWatcherStale,
  maxMachineFolders,
} from "@/features/production/machine-folders";
import { formatDuration } from "@/features/production/workflow-flags";
import {
  getCurrentMachineFiles,
  getMachineFolders,
  getRemovedMachineFiles,
  getWatcherStatus,
  prepareMachineFolders,
} from "@/lib/server/machine-folders";
import { shiftDateTimeFormatter } from "@/lib/server/production-shifts";
import {
  linkMachineFileAction,
  regenerateWatcherKeyAction,
  saveMachineFoldersAction,
} from "./actions";
import styles from "@/features/production/shift.module.css";

export const dynamic = "force-dynamic";

const basePath = "/admin/production/machines";

const notices: Record<string, { tone: "success" | "error"; text: string }> = {
  "folders-saved": {
    tone: "success",
    text: "Папки сохранены. Наблюдатель подхватит их в течение минуты.",
  },
  "key-saved": {
    tone: "success",
    text: "Ключ заменён. Скачайте программу заново — старая больше не работает.",
  },
  "link-linked": { tone: "success", text: "Файл привязан к заявке." },
  "link-unlinked": { tone: "success", text: "Привязка снята." },
  "link-not-found": {
    tone: "error",
    text: "Заявка с таким номером не найдена.",
  },
};

function when(date: Date | null) {
  return date ? shiftDateTimeFormatter.format(date) : "—";
}

export default async function MachinesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdminSession(`/login?next=${basePath}`, basePath);
  if (!canManageProduction(actor.roleCode)) redirect("/admin/production");
  if (!hasDatabaseUrl() || !(await prepareMachineFolders()))
    return (
      <SetupState
        title="Станки появятся после подключения БД"
        description="Список файлов в папках станков хранится в базе."
        steps={["Настройте DATABASE_URL.", "Откройте страницу повторно."]}
      />
    );
  const params = await searchParams;
  const notice =
    notices[typeof params.notice === "string" ? params.notice : ""];
  const now = new Date();
  const [folders, status, current, removed] = await Promise.all([
    getMachineFolders(),
    getWatcherStatus(),
    getCurrentMachineFiles(),
    getRemovedMachineFiles(new Date(now.getTime() - 7 * 86_400_000)),
  ]);
  const stale = isWatcherStale(status.lastSeenAt, now);
  const rows = [
    ...folders,
    ...Array.from(
      { length: Math.max(0, Math.min(2, maxMachineFolders - folders.length)) },
      () => ({ id: "", name: "", path: "", stage: "" as const }),
    ),
  ];

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>
            <HardDrive size={16} /> Производство
          </p>
          <h1>Станки и папки</h1>
          <p className={styles.hint}>
            GibLab выгружает карты в сетевые папки станков. Программа на
            компьютере цеха раз в минуту смотрит эти папки: появился файл —
            заявка «передана на станок», файл убрали — «снят со станка».
          </p>
        </div>
        <Link className={styles.secondary} href="/admin/production/board">
          Доска распила
        </Link>
      </header>
      {notice ? (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={notice.tone === "error" ? styles.error : styles.success}
        >
          {notice.text}
        </p>
      ) : null}

      <section className={styles.section}>
        <h2>Связь с компьютером цеха</h2>
        {status.lastSeenAt ? (
          <p className={stale ? styles.warn : styles.success}>
            {stale ? "Нет связи. " : "На связи. "}
            Последний раз: {when(status.lastSeenAt)}
            {status.computer ? `, компьютер ${status.computer}` : ""}.
          </p>
        ) : (
          <p className={styles.warn}>
            Программа ещё ни разу не выходила на связь.
          </p>
        )}
        <ol className={styles.hint}>
          <li>
            Скачайте программу на компьютер, где стоит GibLab (он видит все
            папки станков).
          </li>
          <li>
            Запустите файл двойным щелчком. Откроется чёрное окно — его не
            закрывать, можно свернуть.
          </li>
          <li>
            Чтобы запускалась сама: нажмите Win+R, введите{" "}
            <code>shell:startup</code> и положите туда ярлык на этот файл.
          </li>
        </ol>
        <div className={styles.inline}>
          <a className={styles.primary} href={`${basePath}/watcher`} download>
            Скачать программу для цеха
          </a>
          <form action={regenerateWatcherKeyAction}>
            <button className={styles.secondary} type="submit">
              Заменить ключ
            </button>
          </form>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Папки станков</h2>
        <p className={styles.hint}>
          Пути как в настройках постпроцессоров GibLab. Лучше сетевой путь
          (\\КОМПЬЮТЕР\папка): буква диска вроде Z:\ работает, только если
          программа запущена на том же компьютере и под тем же пользователем.
        </p>
        <form action={saveMachineFoldersAction} className={styles.form}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Станок</th>
                  <th>Папка</th>
                  <th>Доска распила</th>
                  <th>Состояние</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((folder, index) => {
                  const folderStatus = folder.id
                    ? status.folders[folder.id]
                    : undefined;
                  return (
                    <tr key={folder.id || `new-${index}`}>
                      <td>
                        <input
                          type="hidden"
                          name={`id-${index}`}
                          value={folder.id}
                        />
                        <input
                          className={styles.input}
                          name={`name-${index}`}
                          defaultValue={folder.name}
                          placeholder="Название"
                          maxLength={60}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.input}
                          name={`path-${index}`}
                          defaultValue={folder.path}
                          placeholder="\\КОМПЬЮТЕР\папка"
                          maxLength={400}
                        />
                      </td>
                      <td>
                        <select
                          className={styles.select}
                          name={`stage-${index}`}
                          defaultValue={folder.stage}
                        >
                          <option value="cutting">Двигать сама</option>
                          <option value="">Только показывать</option>
                        </select>
                      </td>
                      <td>
                        {!folder.path
                          ? "—"
                          : !folderStatus || stale
                            ? "ждём данные"
                            : folderStatus.ok
                              ? `файлов: ${folderStatus.files}`
                              : "папка недоступна"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className={styles.hint}>
            «Двигать сама» — для пилы: файл появился в папке → заявка переходит
            в «Распил»; все файлы заявки убраны из папок пилы → «Кромка». Кромку
            оператор отмечает вручную, как сейчас. Чтобы убрать станок, сотрите
            название и путь.
          </p>
          <div className={styles.submitRow}>
            <button className={styles.primary} type="submit">
              Сохранить папки
            </button>
          </div>
        </form>
      </section>

      <section className={styles.section}>
        <h2>Сейчас на станках</h2>
        <p className={styles.hint}>
          Заявка находится по номеру в имени проекта GibLab (например «R-2045
          Иванов шкаф») или по имени клиента. Если не нашлась — впишите номер
          вручную.
        </p>
        {current.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Станок</th>
                  <th>Файл</th>
                  <th>Передан</th>
                  <th>Сколько лежит</th>
                  <th>Заявка</th>
                </tr>
              </thead>
              <tbody>
                {current.map((file) => (
                  <tr key={file.id}>
                    <td>{file.machine}</td>
                    <td>{file.fileName}</td>
                    <td>{when(file.fileModifiedAt ?? file.firstSeenAt)}</td>
                    <td>
                      {formatDuration(
                        now.getTime() -
                          (file.fileModifiedAt ?? file.firstSeenAt).getTime(),
                      )}
                    </td>
                    <td>
                      <LinkCell
                        fileId={file.id}
                        requestId={file.requestId}
                        requestNumber={file.requestNumber}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.muted}>
            {status.lastSeenAt ? "В папках станков пусто." : "Данных пока нет."}
          </p>
        )}
      </section>

      <section className={styles.section}>
        <h2>Снято со станков за 7 дней</h2>
        {removed.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Станок</th>
                  <th>Файл</th>
                  <th>Передан</th>
                  <th>Снят</th>
                  <th>Заявка</th>
                </tr>
              </thead>
              <tbody>
                {removed.map((file) => (
                  <tr key={file.id}>
                    <td>{file.machine}</td>
                    <td>{file.fileName}</td>
                    <td>{when(file.fileModifiedAt ?? file.firstSeenAt)}</td>
                    <td>{when(file.removedAt)}</td>
                    <td>
                      <LinkCell
                        fileId={file.id}
                        requestId={file.requestId}
                        requestNumber={file.requestNumber}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.muted}>Пока ничего не снимали.</p>
        )}
      </section>
    </div>
  );
}

function LinkCell({
  fileId,
  requestId,
  requestNumber,
}: {
  fileId: string;
  requestId: string | null;
  requestNumber: string | null;
}) {
  return (
    <form action={linkMachineFileAction} className={styles.inline}>
      {requestId ? (
        <Link href={`/admin/production/${encodeURIComponent(requestId)}`}>
          {requestNumber ?? "Заявка"}
        </Link>
      ) : null}
      <input type="hidden" name="fileId" value={fileId} />
      <input
        className={styles.input}
        name="requestNumber"
        placeholder={requestId ? "другой №" : "R-…"}
        aria-label="Номер заявки"
        maxLength={20}
        size={7}
      />
      <button className={styles.secondary} type="submit">
        {requestId ? "Сменить" : "Привязать"}
      </button>
    </form>
  );
}
