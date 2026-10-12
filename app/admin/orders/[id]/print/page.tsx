import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PrintRouteSheetButton } from "@/components/admin/print-route-sheet-button";
import {
  getManagerDisplayName,
  orderStatusLabels,
} from "@/features/admin/operations-filters";
import { requireAdminSession } from "@/lib/auth/dal";
import { getOrderInboxItemById } from "@/lib/server/order-inbox";
import { companyContacts } from "@/lib/site-config";

type OrderPrintPageProps = {
  params: Promise<{ id: string }>;
};

const numberFormatter = new Intl.NumberFormat("ru-RU");

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bishkek",
  }).format(value instanceof Date ? value : new Date(value));
}

function TotalRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-6 py-1 ${strong ? "border-t-2 border-[#171714] pt-2 text-[14px] font-bold" : "text-[11px]"}`}
    >
      <span>{label}</span>
      <span className="whitespace-nowrap">{value}</span>
    </div>
  );
}

export default async function OrderPrintPage({ params }: OrderPrintPageProps) {
  const { id } = await params;
  await requireAdminSession("/login?next=/admin/orders", "/admin/orders");
  const order = await getOrderInboxItemById(id);

  if (!order) {
    notFound();
  }

  const orderNumber = order.number ?? order.id.slice(0, 8).toUpperCase();
  const otherDiscounts = Math.max(
    0,
    order.subtotal +
      order.deliveryTotal -
      order.loyaltyRedemptionTotal -
      order.total,
  );

  return (
    <div className="mx-auto max-w-[210mm] bg-white text-[#171714] print:max-w-none">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link
          href={`/admin/orders/${order.id}`}
          className="inline-flex h-10 items-center gap-2 border border-[color:var(--line-strong)] px-4 text-sm font-medium transition hover:border-[color:var(--foreground)]"
        >
          <ArrowLeft className="size-4" />К заказу
        </Link>
        <PrintRouteSheetButton />
      </div>

      <article className="border border-[#cbc7bf] bg-white p-[10mm] shadow-sm print:border-0 print:p-[8mm] print:shadow-none">
        <header className="flex items-start justify-between gap-[8mm] border-b-2 border-[#171714] pb-[5mm]">
          <div>
            <p className="text-[11px] font-bold tracking-[0.18em] uppercase">
              Artisan
            </p>
            <h1 className="mt-2 text-[22px] leading-none font-bold">
              Заказ № {orderNumber}
            </h1>
            <p className="mt-2 text-[11px] text-[#625f59]">
              от {formatDate(order.createdAt)} ·{" "}
              {orderStatusLabels[order.status]}
            </p>
          </div>
          <div className="text-right text-[10px] leading-5 text-[#4e4b46]">
            <p>{companyContacts.address}</p>
            <p>{companyContacts.hours}</p>
            <p className="font-semibold text-[#171714]">
              {companyContacts.phone}
            </p>
          </div>
        </header>

        <section className="mt-[5mm] grid grid-cols-2 gap-x-[8mm] gap-y-[2mm] text-[11px]">
          <p>
            <span className="text-[#77736c]">Клиент: </span>
            <strong>{order.contactName}</strong>
          </p>
          <p>
            <span className="text-[#77736c]">Телефон: </span>
            <strong>{order.contactPhone}</strong>
          </p>
          {order.companyName ? (
            <p>
              <span className="text-[#77736c]">Компания: </span>
              {order.companyName}
            </p>
          ) : null}
          <p>
            <span className="text-[#77736c]">Менеджер: </span>
            {order.manager
              ? getManagerDisplayName(order.manager)
              : "Не назначен"}
          </p>
          <p>
            <span className="text-[#77736c]">Получение: </span>
            {order.deliveryMethod?.name ?? "Самовывоз"}
          </p>
        </section>

        <table className="mt-[6mm] w-full border-collapse border border-[#bdb9b1] text-[10px] leading-[1.4]">
          <thead>
            <tr className="bg-[#f0eeea] text-left">
              <th className="w-[8mm] border border-[#bdb9b1] px-1.5 py-1">№</th>
              <th className="border border-[#bdb9b1] px-1.5 py-1">Товар</th>
              <th className="border border-[#bdb9b1] px-1.5 py-1">Артикул</th>
              <th className="border border-[#bdb9b1] px-1.5 py-1 text-right">
                Кол-во
              </th>
              <th className="border border-[#bdb9b1] px-1.5 py-1 text-right">
                Цена
              </th>
              <th className="border border-[#bdb9b1] px-1.5 py-1 text-right">
                Сумма
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={item.id ?? index} className="break-inside-avoid">
                <td className="border border-[#d7d4ce] px-1.5 py-1">
                  {index + 1}
                </td>
                <td className="border border-[#d7d4ce] px-1.5 py-1">
                  {item.name}
                  {item.brand ? (
                    <span className="text-[#77736c]"> · {item.brand}</span>
                  ) : null}
                </td>
                <td className="border border-[#d7d4ce] px-1.5 py-1 whitespace-nowrap">
                  {item.sku ?? ""}
                </td>
                <td className="border border-[#d7d4ce] px-1.5 py-1 text-right">
                  {numberFormatter.format(item.quantity)}
                </td>
                <td className="border border-[#d7d4ce] px-1.5 py-1 text-right whitespace-nowrap">
                  {numberFormatter.format(item.unitPrice)}
                </td>
                <td className="border border-[#d7d4ce] px-1.5 py-1 text-right font-semibold whitespace-nowrap">
                  {numberFormatter.format(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-[5mm] ml-auto w-[80mm] break-inside-avoid">
          <TotalRow
            label="Сумма без скидок"
            value={`${numberFormatter.format(order.subtotal)} сом`}
          />
          {otherDiscounts > 0 ? (
            <TotalRow
              label="Скидки"
              value={`− ${numberFormatter.format(otherDiscounts)} сом`}
            />
          ) : null}
          {order.loyaltyRedemptionTotal > 0 ? (
            <TotalRow
              label="Оплачено бонусами"
              value={`− ${numberFormatter.format(order.loyaltyRedemptionTotal)} сом`}
            />
          ) : null}
          {order.deliveryTotal > 0 ? (
            <TotalRow
              label="Доставка"
              value={`${numberFormatter.format(order.deliveryTotal)} сом`}
            />
          ) : null}
          <TotalRow
            label="К оплате"
            value={`${numberFormatter.format(order.total)} сом`}
            strong
          />
        </section>

        {order.fulfillmentComment ? (
          <section className="mt-[5mm] break-inside-avoid text-[10px] leading-5">
            <p className="font-semibold">Комментарий к выдаче</p>
            <p className="whitespace-pre-wrap">{order.fulfillmentComment}</p>
          </section>
        ) : null}

        <footer className="mt-[10mm] grid break-inside-avoid grid-cols-2 gap-[10mm] text-[10px] text-[#625f59]">
          <p>Отпустил: ____________________</p>
          <p>Получил: ____________________</p>
        </footer>
        <p className="mt-[5mm] text-[8px] text-[#8a857d]">
          Документ не является кассовым чеком. Напечатано:{" "}
          {formatDate(new Date())}
        </p>
      </article>
    </div>
  );
}
