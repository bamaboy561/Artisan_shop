import { InStoreSaleWorkspace } from "@/components/admin/in-store-sale-workspace";
import { SetupState } from "@/components/admin/setup-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { ProductStatus, RoleCode } from "@/generated/prisma";
import { requireAdminPermission } from "@/lib/auth/dal";
import { getDb, hasDatabaseUrl } from "@/lib/db";
import { getLoyaltyProgramConfig } from "@/lib/server/loyalty-settings";
import {
  getEffectiveDiscountPercent,
  getLoyaltyTierLabel,
} from "@/lib/server/pricing";

export const dynamic = "force-dynamic";

type AdminSalesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];

  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminSalesPage({
  searchParams,
}: AdminSalesPageProps) {
  if (!hasDatabaseUrl()) {
    return (
      <SetupState
        title="Продажа в зале заработает после подключения базы"
        description="Менеджерский планшет требует PostgreSQL, клиентов и товары с ценами."
        steps={[
          "Подключите DATABASE_URL.",
          "Создайте клиентов или попросите их зарегистрироваться.",
          "Добавьте товары с ценой в каталог.",
        ]}
      />
    );
  }

  await requireAdminPermission("/admin/sales", "/login?next=/admin/sales");

  const resolvedSearchParams = await searchParams;
  const initialClientId = getSingleParam(resolvedSearchParams, "client");
  const db = getDb();
  const [clients, products, loyaltyConfig] = await Promise.all([
    db.user.findMany({
      where: {
        isActive: true,
        role: {
          code: {
            in: [RoleCode.CUSTOMER, RoleCode.DEALER],
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 300,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        companyName: true,
        loyaltyTier: true,
        loyaltyPointsBalance: true,
        personalDiscountPercent: true,
      },
    }),
    db.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        price: {
          not: null,
        },
      },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      take: 700,
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        brand: {
          select: {
            name: true,
          },
        },
        category: {
          select: {
            name: true,
          },
        },
      },
    }),
    getLoyaltyProgramConfig(),
  ]);

  return (
    <div className="space-y-4">
      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-5 sm:p-7">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <SectionHeading
            title="Продажа в зале"
            description="Рабочий экран для планшета менеджера: выберите клиента, добавьте товары, сохраните продажу и начислите бонусы."
            titleClassName="text-2xl sm:text-3xl"
            descriptionClassName="max-w-4xl text-sm leading-7"
          />
          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[32rem]">
            {["Клиент", "Товары", "Сохранение"].map((step, index) => (
              <div
                key={step}
                className="rounded-2xl border border-[color:var(--line)] bg-white/74 px-4 py-3 text-sm text-[var(--foreground)]"
              >
                <span className="font-mono text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase">
                  0{index + 1}
                </span>
                <span className="mt-1 block font-medium">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <InStoreSaleWorkspace
        initialClientId={initialClientId}
        clients={clients.map((client) => ({
          id: client.id,
          name:
            [client.firstName, client.lastName].filter(Boolean).join(" ") ||
            client.email,
          email: client.email,
          phone: client.phone,
          companyName: client.companyName,
          loyaltyTierLabel: getLoyaltyTierLabel(
            client.loyaltyTier,
            loyaltyConfig,
          ),
          loyaltyPointsBalance: client.loyaltyPointsBalance,
          discountPercent: getEffectiveDiscountPercent(client, loyaltyConfig),
        }))}
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          price: product.price ?? 0,
          brandName: product.brand?.name ?? null,
          categoryName: product.category.name,
        }))}
      />
    </div>
  );
}
