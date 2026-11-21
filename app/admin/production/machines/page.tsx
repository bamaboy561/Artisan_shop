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
  gibLabCatalogColumns,
  gibLabCatalogStartRow,
} from "@/features/production/giblab-catalog";
import {
  getGibLabCatalogSettings,
  getGibLabCatalogStatus,
} from "@/lib/server/giblab-catalog";
import {
  getGibLabOrderSettings,
  getRecentGibLabOrders,
} from "@/lib/server/giblab-orders";
import {
  linkMachineFileAction,
  regenerateWatcherKeyAction,
  saveMachineFoldersAction,
  resendGibLabOrderAction,
  saveGibLabCatalogSettingsAction,
  saveGibLabOrderSettingsAction,
} from "./actions";
import styles from "@/features/production/shift.module.css";

export const dynamic = "force-dynamic";

const basePath = "/admin/production/machines";

const orderStatusLabels: Record<string, string> = {
  pending: "ждёт программу",
  written: "положен",
  exists: "файл уже был",
  failed: "ошибка",
  deleted: "удалён в GibLab → заявка отменена",
};

const notices: Record<string, { tone: "success" | "error"; text: string }> = {
  "catalog-saved": {
    tone: "success",
    text: "Настройки каталога сохранены. Программа обновит файл в течение 10 минут.",
  },
  "catalog-error": {
    tone: "error",
    text: "Не удалось сохранить настройки каталога.",
  },
  "orders-saved": {
    tone: "success",
    text: "Настройки заказов GibLab сохранены.",
  },
  "resend-saved": {
    tone: "success",
    text: "Заказ положат в папку GibLab ещё раз в течение минуты.",
  },
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
  const [
    folders,
    status,
    current,
    removed,
    orderSettings,
    orders,
    catalogSettings,
    catalogStatus,
  ] = await Promise.all([
    getMachineFolders(),
    getWatcherStatus(),
    getCurrentMachineFiles(),
    getRemovedMachineFiles(new Date(now.getTime() - 7 * 86_400_000)),
    getGibLabOrderSettings(),
    getRecentGibLabOrders(),
    getGibLabCatalogSettings(),
    getGibLabCatalogStatus(),
  ]);
  const orderRoot = orderSettings.root.replace(/\\+$/, "");
  const stale = isWatcherStale(status.lastSeenAt, now);
  const rows = [
    ...folders,
    ...Array.from(
      { length: Math.max(0, Math.min(2, maxMachineFolders - folders.length)) },
      () => ({
        id: "",
        name: "",
        path: "",
        stage: "" as const,
        recurse: false,
      }),
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
                  <th>Подпапки</th>
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
                        <label>
                          <input
                            type="checkbox"
                            name={`recurse-${index}`}
                            defaultChecked={folder.recurse}
                          />{" "}
                          смотреть
                        </label>
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
        <h2>Заказы с сайта → GibLab</h2>
        <p className={styles.hint}>
          Новая заявка на распил через минуту появляется в папке проектов
          GibLab: {orderRoot}\год\месяц\день (например 2026\Ноябрь\21-11), файл
          «R-2045 Имя телефон.project». Если клиент считал распил в калькуляторе
          — с деталями, иначе пустой проект. Удалили файл в GibLab до начала
          распила — заявка на сайте становится «Отменена» (её можно вернуть).
          Работает с программой, скачанной после 21.11 — перекачайте её один
          раз.
        </p>
        <form action={saveGibLabOrderSettingsAction} className={styles.inline}>
          <label className={styles.field}>
            <span>
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={orderSettings.enabled}
              />{" "}
              Включено
            </span>
          </label>
          <label className={styles.field}>
            Папка проектов
            <input
              className={styles.input}
              name="root"
              defaultValue={orderSettings.root}
              maxLength={300}
            />
          </label>
          <label className={styles.field}>
            Когда класть
            <select
              className={styles.select}
              name="trigger"
              defaultValue={orderSettings.trigger}
            >
              <option value="new">Сразу при новой заявке</option>
              <option value="in-progress">Когда заявка «В работе»</option>
            </select>
          </label>
          <button className={styles.primary} type="submit">
            Сохранить
          </button>
        </form>
        {orders.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Файл</th>
                  <th>Папка</th>
                  <th>Что внутри</th>
                  <th>Состояние</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.requestId}>
                    <td>
                      <Link
                        href={`/admin/requests/${encodeURIComponent(order.requestId)}`}
                      >
                        {order.fileName}
                      </Link>
                    </td>
                    <td>{order.folder}</td>
                    <td>{order.source ?? "—"}</td>
                    <td>
                      {orderStatusLabels[order.status] ?? order.status}
                      {order.writtenAt ? `, ${when(order.writtenAt)}` : ""}
                      {order.error ? ` (${order.error})` : ""}
                    </td>
                    <td>
                      <form action={resendGibLabOrderAction}>
                        <input
                          type="hidden"
                          name="requestId"
                          value={order.requestId}
                        />
                        <button className={styles.secondary} type="submit">
                          Положить ещё раз
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.muted}>Пока ни одного заказа не выгружено.</p>
        )}
      </section>

      <section className={styles.section}>
        <h2>Материалы сайта → каталог GibLab</h2>
        <p className={styles.hint}>
          Программа цеха раз в 10 минут кладёт файл {catalogSettings.path} со
          списком плит и кромки магазина в формате каталога GibLab: «Листовой
          материал» → категория → толщина → формат листа, и «Кромочные
          материалы». У плит цена за м² (цена листа ÷ площадь), у кромки — за
          метр. В папке «Услуги» — цены работ из «Прайс работ»: распил,
          кромление, присадка по диаметрам, фрезеровка. Файл перезаписывается,
          только когда товары изменились.
        </p>
        <form
          action={saveGibLabCatalogSettingsAction}
          className={styles.inline}
        >
          <label className={styles.field}>
            <span>
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={catalogSettings.enabled}
              />{" "}
              Включено
            </span>
          </label>
          <label className={styles.field}>
            Файл каталога
            <input
              className={styles.input}
              name="path"
              defaultValue={catalogSettings.path}
              maxLength={300}
            />
          </label>
          <button className={styles.primary} type="submit">
            Сохранить
          </button>
          <a className={styles.secondary} href={`${basePath}/catalog`}>
            Скачать goods.xls
          </a>
        </form>
        <p className={styles.muted}>
          {catalogStatus.status === "written"
            ? `Последний раз записан ${when(catalogStatus.at ? new Date(catalogStatus.at) : null)}, строк: ${catalogStatus.items ?? "—"}.`
            : catalogStatus.status === "failed"
              ? `Не удалось записать файл (${when(catalogStatus.at ? new Date(catalogStatus.at) : null)}): ${catalogStatus.error ?? "ошибка"}. Возможно, файл открыт в Excel.`
              : "Программа цеха ещё не записывала каталог."}
        </p>
        <details>
          <summary>Как один раз настроить GibLab</summary>
          <p className={styles.hint}>
            Сервисы → Catalog Excel (двойной щелчок). Файл:{" "}
            {catalogSettings.path}. Лист: 1. Начальная строка:{" "}
            {gibLabCatalogStartRow} (в первой строке заголовки). Столбцы:
          </p>
          <ul className={styles.hint}>
            {gibLabCatalogColumns.map((column) => (
              <li key={column.key}>
                {column.setting} — {column.letter}
              </li>
            ))}
          </ul>
        </details>
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
