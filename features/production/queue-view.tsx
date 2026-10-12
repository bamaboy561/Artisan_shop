import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Factory,
  FileStack,
  Filter,
  RotateCcw,
} from "lucide-react";
import { ProductionQrSearch } from "@/app/admin/production/production-qr-search";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CuttingStage } from "@/generated/prisma";
import { cuttingStageLabels } from "@/features/cutting/progress";
import {
  isProductionOverdue,
  productionQueueUrl,
  productionTimeZone,
  type ProductionScope,
} from "./queue";
import type { getProductionQueue } from "@/lib/server/production-workspace";
import styles from "./workspace.module.css";

type Queue = Awaited<ReturnType<typeof getProductionQueue>>;
const scopes: Array<[ProductionScope, string]> = [
  ["all", "Все"],
  ["CUTTING", "Распил"],
  ["EDGING", "Кромка"],
  ["DRILLING", "Присадка"],
  ["READY_FOR_PICKUP", "К выдаче"],
];
const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  timeZone: productionTimeZone,
});

export function ProductionQueueView({
  queue,
  operator = false,
  title,
  notice,
}: {
  queue: Queue;
  operator?: boolean;
  title: string;
  notice?: string;
}) {
  const { filters, items, planning } = queue;
  const returnTo = productionQueueUrl(filters);
  return (
    <div className={styles.workspace}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>
            <Factory size={16} /> Производство
          </p>
          <h1>{title}</h1>
        </div>
        <span className={styles.total}>
          {queue.total}
          <span>заявок</span>
        </span>
      </header>
      {notice ? (
        <p role="alert" className={styles.alert}>
          {notice}
        </p>
      ) : null}
      <ProductionQrSearch
        key={returnTo}
        initialQuery={filters.q}
        queueUrl={returnTo}
      />
      {!operator ? (
        <nav className={styles.tabs} aria-label="Станции производства">
          {scopes.map(([value, label]) => (
            <Link
              key={value}
              href={productionQueueUrl(filters, { station: value, page: 1 })}
              aria-current={filters.station === value ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      ) : null}
      <form
        action="/admin/production"
        className={styles.filters}
        key={`${filters.from}/${filters.to}/${filters.sort}/${filters.due}`}
      >
        <input type="hidden" name="q" value={filters.q} />
        <input type="hidden" name="station" value={filters.station} />
        <label>
          Создан с
          <Input
            name="from"
            type="date"
            min="2000-01-01"
            max="2100-12-31"
            defaultValue={filters.from}
          />
        </label>
        <label>
          По дату
          <Input
            name="to"
            type="date"
            min="2000-01-01"
            max="2100-12-31"
            defaultValue={filters.to}
          />
        </label>
        {planning ? (
          <label>
            Готовность
            <Select name="due" defaultValue={filters.due}>
              <option value="all">Все сроки</option>
              <option value="today">На сегодня</option>
              <option value="overdue">Просрочено</option>
              <option value="unplanned">Без срока</option>
            </Select>
          </label>
        ) : null}
        <label>
          Порядок
          <Select name="sort" defaultValue={filters.sort}>
            <option value="created-asc">Сначала старые</option>
            <option value="created-desc">Сначала новые</option>
            {planning ? (
              <option value="due-asc">По сроку готовности</option>
            ) : null}
          </Select>
        </label>
        <div className={styles.filterActions}>
          <Button type="submit" variant="secondary">
            <Filter size={16} />
            Применить
          </Button>
          <Link
            className={styles.iconButton}
            href={
              operator
                ? `/admin/production?station=${filters.station}`
                : "/admin/production"
            }
            aria-label="Сбросить фильтры"
            title="Сбросить фильтры"
          >
            <RotateCcw size={17} />
          </Link>
        </div>
      </form>
      <div className={styles.queueHeading}>
        <h2>Очередь заказов</h2>
        <span>
          {queue.total
            ? `${queue.skip + 1}–${queue.skip + items.length} из ${queue.total}`
            : "0 заявок"}
        </span>
      </div>
      {items.length ? (
        <>
          <div className={styles.desktopTable}>
            <table>
              <thead>
                <tr>
                  <th>Заказ / клиент</th>
                  <th>Материал / объём</th>
                  <th>Этап</th>
                  {planning ? <th>Готовность</th> : null}
                  <th>Менеджер</th>
                  <th>
                    <span className="sr-only">Открыть</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((request) => {
                  const stage = request.cuttingStage ?? CuttingStage.ACCEPTED;
                  const href = `/admin/production/${encodeURIComponent(request.id)}?${new URLSearchParams({ returnTo })}`;
                  const overdue = isProductionOverdue(
                    request.dueDate,
                    stage,
                    queue.today,
                  );
                  return (
                    <tr key={request.id} data-overdue={overdue || undefined}>
                      <td>
                        <Link className={styles.orderLink} href={href}>
                          {request.number ??
                            request.id.slice(0, 8).toUpperCase()}
                        </Link>
                        <strong>{request.contactName}</strong>
                        <small>{dateFormatter.format(request.createdAt)}</small>
                      </td>
                      <td>
                        <span>{request.material || request.subject}</span>
                        <small>
                          {request.cuttingSheetCount ?? "—"} лист. ·{" "}
                          {request.cuttingEdgeMeters ?? "—"} м кромки
                        </small>
                        {request.edgeOption ? (
                          <small>{request.edgeOption}</small>
                        ) : null}
                      </td>
                      <td>
                        <StatusBadge
                          tone={
                            stage === CuttingStage.READY_FOR_PICKUP
                              ? "success"
                              : stage === CuttingStage.ACCEPTED
                                ? "neutral"
                                : "warning"
                          }
                        >
                          {cuttingStageLabels[stage]}
                        </StatusBadge>
                        {request.cuttingPickupCell ? (
                          <small>Ячейка {request.cuttingPickupCell}</small>
                        ) : null}
                        <small className={styles.files}>
                          <FileStack size={13} /> {request._count.files}
                        </small>
                      </td>
                      {planning ? (
                        <td>
                          <Deadline
                            date={request.dueDate}
                            overdue={overdue}
                            today={queue.today}
                            stage={stage}
                          />
                        </td>
                      ) : null}
                      <td>
                        {request.manager ? (
                          [request.manager.firstName, request.manager.lastName]
                            .filter(Boolean)
                            .join(" ") || request.manager.email
                        ) : (
                          <small>Не назначен</small>
                        )}
                      </td>
                      <td>
                        <Link
                          className={styles.iconButton}
                          href={href}
                          title="Открыть заказ"
                          aria-label={`Открыть ${request.number ?? request.id}`}
                        >
                          <ArrowRight size={17} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className={styles.mobileList}>
            {items.map((request) => {
              const stage = request.cuttingStage ?? CuttingStage.ACCEPTED;
              const overdue = isProductionOverdue(
                request.dueDate,
                stage,
                queue.today,
              );
              return (
                <Link
                  className={styles.mobileOrder}
                  key={request.id}
                  href={`/admin/production/${encodeURIComponent(request.id)}?${new URLSearchParams({ returnTo })}`}
                >
                  <div className={styles.cardTop}>
                    <strong>
                      {request.number ?? request.id.slice(0, 8).toUpperCase()}
                    </strong>
                    <ArrowRight size={18} />
                  </div>
                  <StatusBadge
                    tone={
                      stage === CuttingStage.READY_FOR_PICKUP
                        ? "success"
                        : "neutral"
                    }
                  >
                    {cuttingStageLabels[stage]}
                  </StatusBadge>
                  <p className={styles.material}>
                    {request.material || request.subject}
                  </p>
                  <p>{request.contactName}</p>
                  <div className={styles.quantities}>
                    <span>{request.cuttingSheetCount ?? "—"} лист.</span>
                    <span>{request.cuttingEdgeMeters ?? "—"} м кромки</span>
                    <span className={styles.files}>
                      <FileStack size={14} /> {request._count.files}
                    </span>
                  </div>
                  {request.edgeOption ? (
                    <small>{request.edgeOption}</small>
                  ) : null}
                  <div className={styles.cardBottom}>
                    <small>
                      Создан {dateFormatter.format(request.createdAt)}
                    </small>
                    {planning ? (
                      <Deadline
                        date={request.dueDate}
                        overdue={overdue}
                        today={queue.today}
                        stage={stage}
                      />
                    ) : null}
                  </div>
                  {request.cuttingPickupCell ? (
                    <small>Ячейка {request.cuttingPickupCell}</small>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </>
      ) : (
        <div className={styles.empty}>
          <Factory size={28} />
          <h3>Заявки не найдены</h3>
          <Link
            href={
              operator
                ? `/admin/production?station=${filters.station}`
                : "/admin/production"
            }
          >
            Сбросить фильтры
          </Link>
        </div>
      )}
      {queue.pages > 1 ? (
        <nav className={styles.pagination} aria-label="Страницы очереди">
          {queue.page > 1 ? (
            <Link
              className={styles.iconButton}
              href={productionQueueUrl(filters, { page: queue.page - 1 })}
              aria-label="Предыдущая страница"
            >
              <ChevronLeft size={18} />
            </Link>
          ) : (
            <span className={styles.iconButton} aria-disabled="true">
              <ChevronLeft size={18} />
            </span>
          )}
          <form action="/admin/production">
            {Object.entries(filters)
              .filter(([key]) => key !== "page")
              .map(([key, value]) => (
                <input key={key} type="hidden" name={key} value={value} />
              ))}
            <label>
              Страница{" "}
              <input
                aria-label="Номер страницы"
                name="page"
                type="number"
                min="1"
                max={queue.pages}
                defaultValue={queue.page}
                key={queue.page}
              />
            </label>
            <span>из {queue.pages}</span>
            <button
              className={styles.iconButton}
              aria-label="Перейти на страницу"
              title="Перейти на страницу"
            >
              <ArrowRight size={17} />
            </button>
          </form>
          {queue.page < queue.pages ? (
            <Link
              className={styles.iconButton}
              href={productionQueueUrl(filters, { page: queue.page + 1 })}
              aria-label="Следующая страница"
            >
              <ChevronRight size={18} />
            </Link>
          ) : (
            <span className={styles.iconButton} aria-disabled="true">
              <ChevronRight size={18} />
            </span>
          )}
        </nav>
      ) : null}
    </div>
  );
}

function Deadline({
  date,
  overdue,
  today,
  stage,
}: {
  date: string | null;
  overdue: boolean;
  today: string;
  stage: CuttingStage;
}) {
  if (!date) return <small>Не назначена</small>;
  return (
    <span className={overdue ? styles.overdue : styles.deadline}>
      {date.split("-").reverse().join(".")}
      {overdue ? (
        <small>Просрочено</small>
      ) : date === today && stage !== CuttingStage.READY_FOR_PICKUP ? (
        <small>Сегодня</small>
      ) : null}
    </span>
  );
}
