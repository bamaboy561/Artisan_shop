import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { ClientOperationTimeline } from "@/components/account/client-operation-timeline";
import { SectionHeading } from "@/components/ui/section-heading";
import { DataTable } from "@/components/ui/table";
import { OrderStatus, PaymentStatus } from "@/generated/prisma";
import {
  orderStatusLabels,
  paymentStatusLabels,
} from "@/features/admin/operations-filters";
import { RepeatOrderButton } from "@/components/account/repeat-order-button";
import { hasDatabaseUrl } from "@/lib/db";
import { getAccountOrders, getAccountUser } from "@/lib/server/account-data";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KGS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatOptionalDate(date: Date | null) {
  return date ? formatDate(date) : "РќРµ Р·Р°РґР°РЅРѕ";
}

function getStatusTone(status: OrderStatus) {
  switch (status) {
    case OrderStatus.NEW:
    case OrderStatus.CONFIRMED:
      return "warning" as const;
    case OrderStatus.IN_PRODUCTION:
    case OrderStatus.READY_FOR_PICKUP:
    case OrderStatus.SHIPPED:
      return "accent" as const;
    case OrderStatus.COMPLETED:
      return "success" as const;
    case OrderStatus.CANCELED:
    default:
      return "neutral" as const;
  }
}

function getPaymentTone(status: PaymentStatus) {
  switch (status) {
    case PaymentStatus.PAID:
      return "success" as const;
    case PaymentStatus.PARTIAL:
      return "accent" as const;
    case PaymentStatus.WAITING_PAYMENT:
      return "warning" as const;
    case PaymentStatus.REFUNDED:
    case PaymentStatus.CANCELED:
    default:
      return "neutral" as const;
  }
}

export default async function AccountOrdersPage() {
  if (!hasDatabaseUrl()) {
    return (
      <SetupState
        title="РСЃС‚РѕСЂРёСЏ Р·Р°РєР°Р·РѕРІ РѕС‚РєСЂРѕРµС‚СЃСЏ РїРѕСЃР»Рµ РїРѕРґРєР»СЋС‡РµРЅРёСЏ Р±Р°Р·С‹ РґР°РЅРЅС‹С…"
        description="Р—РґРµСЃСЊ Р±СѓРґСѓС‚ РІСЃРµ РІР°С€Рё Р·Р°РєР°Р·С‹, СЃС‚Р°С‚СѓСЃС‹, СЃСѓРјРјС‹ Рё РЅР°С‡РёСЃР»РµРЅРёСЏ Р±Р°Р»Р»РѕРІ РїРѕ Р·Р°РІРµСЂС€С‘РЅРЅС‹Рј СЃРґРµР»РєР°Рј."
        steps={[
          "Р”РѕР±Р°РІСЊС‚Рµ DATABASE_URL РІ .env.",
          "РџСЂРёРјРµРЅРёС‚Рµ Prisma-СЃС…РµРјСѓ С‡РµСЂРµР· prisma db push РёР»Рё prisma migrate dev.",
          "РџРѕСЃР»Рµ РїРµСЂРІРѕРіРѕ СЂРµР°Р»СЊРЅРѕРіРѕ Р·Р°РєР°Р·Р° РёСЃС‚РѕСЂРёСЏ РїРѕСЏРІРёС‚СЃСЏ Р·РґРµСЃСЊ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё.",
        ]}
      />
    );
  }

  const user = await getAccountUser();

  if (!user) {
    return null;
  }

  const orders = await getAccountOrders(user.id);

  const rows = orders.map((order) => ({
    order: (
      <div className="space-y-1">
        <p className="font-semibold text-[var(--foreground)]">
          {order.number ?? order.id.slice(0, 8)}
        </p>
        <p className="text-xs text-[var(--muted)]">
          {formatDate(order.createdAt)}
        </p>
      </div>
    ),
    delivery: (
      <div className="space-y-1">
        <p>{order.deliveryMethod?.name ?? "РЎР°РјРѕРІС‹РІРѕР·"}</p>
        <p className="text-xs text-[var(--muted)]">
          РЎРєРёРґРєР°: {formatCurrency(order.discountTotal)}
        </p>
        {order.appliedPromoCode || order.loyaltyRedemptionTotal > 0 ? (
          <p className="text-xs text-[var(--muted)]">
            {order.appliedPromoCode
              ? `РџСЂРѕРјРѕРєРѕРґ: ${order.appliedPromoCode}`
              : "Р‘РµР· РїСЂРѕРјРѕРєРѕРґР°"}
            {order.loyaltyRedemptionTotal > 0
              ? ` В· РЎРїРёСЃР°РЅРѕ Р±Р°Р»Р»РѕРІ: ${formatCurrency(order.loyaltyRedemptionTotal)}`
              : ""}
          </p>
        ) : null}
      </div>
    ),
    status: (
      <div className="space-y-2">
        <StatusBadge tone={getStatusTone(order.status)}>
          {orderStatusLabels[order.status]}
        </StatusBadge>
        <StatusBadge tone={getPaymentTone(order.paymentStatus)}>
          {paymentStatusLabels[order.paymentStatus]}
        </StatusBadge>
        <p className="text-xs text-[var(--muted)]">
          РџР»Р°РЅ: {formatOptionalDate(order.productionDueAt)}
        </p>
        {order.readyAt ? (
          <p className="text-xs text-[var(--muted)]">
            Р“РѕС‚РѕРІ: {formatDate(order.readyAt)}
          </p>
        ) : null}
      </div>
    ),
    production: (
      <div className="space-y-2">
        {order.fulfillmentComment ? (
          <p className="max-w-sm text-sm leading-6 text-[var(--foreground)]">
            {order.fulfillmentComment}
          </p>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            РљРѕРјРјРµРЅС‚Р°СЂРёР№ РїРѕСЏРІРёС‚СЃСЏ РїРѕСЃР»Рµ РѕР±СЂР°Р±РѕС‚РєРё Р·Р°РєР°Р·Р°.
          </p>
        )}
        {order.managerNotes.length > 0 ? (
          <p className="text-xs leading-5 text-[var(--muted)]">
            {order.managerNotes[0]?.body}
          </p>
        ) : null}
      </div>
    ),
    history: (
      <ClientOperationTimeline
        events={order.history}
        emptyMessage="РСЃС‚РѕСЂРёСЏ РїРѕСЏРІРёС‚СЃСЏ РїРѕСЃР»Рµ РѕР±СЂР°Р±РѕС‚РєРё Р·Р°РєР°Р·Р°."
      />
    ),
    total: (
      <div className="space-y-1">
        <p>{formatCurrency(order.total)}</p>
        <p className="text-xs text-[var(--muted)]">
          Р‘Р°Р»Р»С‹: +
          {order.loyaltyTransactions.reduce(
            (sum, transaction) => sum + Math.max(0, transaction.points),
            0,
          )}
        </p>
      </div>
    ),
    updated: formatDate(order.updatedAt),
    repeat: (
      <RepeatOrderButton orderId={order.id} />
    ),
  }));

  return (
    <div className="space-y-4">
      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <SectionHeading
          title="РСЃС‚РѕСЂРёСЏ Р·Р°РєР°Р·РѕРІ"
          description="Р’СЃРµ РѕС„РѕСЂРјР»РµРЅРЅС‹Рµ Р·Р°РєР°Р·С‹, СЃСѓРјРјС‹, РґРѕСЃС‚Р°РІРєР° Рё РЅР°С‡РёСЃР»РµРЅРЅС‹Рµ Р±Р°Р»Р»С‹ РїРѕ РїСЂРѕРіСЂР°РјРјРµ Р»РѕСЏР»СЊРЅРѕСЃС‚Рё."
          titleClassName="text-2xl sm:text-3xl"
          descriptionClassName="max-w-2xl text-sm leading-7"
        />
      </section>

      <DataTable
        columns={[
          { key: "order", label: "Р—Р°РєР°Р·" },
          { key: "delivery", label: "Р”РѕСЃС‚Р°РІРєР° Рё СЃРєРёРґРєР°" },
          { key: "status", label: "РЎС‚Р°С‚СѓСЃ" },
          { key: "production", label: "РџСЂРѕРёР·РІРѕРґСЃС‚РІРѕ" },
          { key: "history", label: "РСЃС‚РѕСЂРёСЏ" },
          { key: "total", label: "РЎСѓРјРјР° Рё Р±Р°Р»Р»С‹" },
          { key: "updated", label: "РћР±РЅРѕРІР»С‘РЅ" },
        ]}
        rows={rows}
        caption="Р—Р°РєР°Р·С‹"
        emptyMessage="РџРѕСЃР»Рµ РїРµСЂРІРѕРіРѕ РѕС„РѕСЂРјР»РµРЅРёСЏ Р·Р°РєР°Р·Р° РёСЃС‚РѕСЂРёСЏ РїРѕСЏРІРёС‚СЃСЏ Р·РґРµСЃСЊ."
      />
    </div>
  );
}
