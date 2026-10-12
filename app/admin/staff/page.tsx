import { KeyRound, Search, ShieldCheck, UserRoundCog } from "lucide-react";

import {
  resetCuttingManagerPasswordAction,
  toggleCuttingManagerAccessAction,
  updateStaffAccountRoleAction,
} from "@/app/admin/actions";
import { CuttingManagerForm } from "@/app/admin/staff/cutting-manager-form";
import { ProductionAccountForm } from "@/app/admin/staff/production-account-form";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { ButtonLink } from "@/components/ui/button-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { SectionHeading } from "@/components/ui/section-heading";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/components/ui/table";
import { ProductionStation, RoleCode } from "@/generated/prisma";
import { requireAdminSession } from "@/lib/auth/dal";
import {
  employeeRoleCodes,
  productionStationDefinitions,
  roleDefinitions,
  standardAssignableRoleCodes,
} from "@/lib/auth/roles";
import { hasDatabaseUrl } from "@/lib/db";
import {
  getStaffAccountDirectory,
  type StaffAccountScope,
} from "@/lib/server/staff-admin";

export const dynamic = "force-dynamic";

type StaffPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const noticeMessages: Record<string, string> = {
  enabled: "Доступ сотрудника включен.",
  disabled: "Доступ сотрудника приостановлен.",
  "password-updated": "Пароль сотрудника обновлен.",
  "invalid-password": "Новый пароль должен содержать не менее 8 символов.",
  "role-updated": "Роль аккаунта обновлена.",
  "role-unchanged": "У аккаунта уже установлена выбранная роль.",
  "invalid-role": "Выбрана неизвестная роль.",
  "invalid-station": "Для оператора выберите станцию производства.",
  "self-role":
    "Нельзя изменять роль аккаунта, под которым вы сейчас работаете.",
  "role-forbidden": "Для изменения этой роли нужны права супер-администратора.",
  "last-super-admin":
    "Нельзя изменить роль единственного активного супер-администратора.",
  "account-missing":
    "Аккаунт не найден. Обновите страницу и повторите действие.",
};

const errorNotices = new Set([
  "invalid-password",
  "invalid-role",
  "invalid-station",
  "self-role",
  "role-forbidden",
  "last-super-admin",
  "account-missing",
]);

const employeeRoleSet = new Set<RoleCode>(employeeRoleCodes);
const privilegedRoleSet = new Set<RoleCode>([
  RoleCode.ADMIN,
  RoleCode.SUPER_ADMIN,
]);
const productionAccessRoleSet = new Set<RoleCode>([
  RoleCode.CUTTING_MANAGER,
  RoleCode.PRODUCTION_MANAGER,
  RoleCode.PRODUCTION_OPERATOR,
]);

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function getSearchValue(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function getPageNumber(value: string) {
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function getRoleTone(roleCode: RoleCode) {
  if (roleCode === RoleCode.SUPER_ADMIN || roleCode === RoleCode.ADMIN) {
    return "accent" as const;
  }

  if (roleCode === RoleCode.MANAGER) {
    return "success" as const;
  }

  if (roleCode === RoleCode.CUTTING_MANAGER) {
    return "warning" as const;
  }

  if (roleCode === RoleCode.PRODUCTION_MANAGER) {
    return "accent" as const;
  }

  if (roleCode === RoleCode.PRODUCTION_OPERATOR) {
    return "warning" as const;
  }

  return "neutral" as const;
}

function getScopeLabel(scope: StaffAccountScope) {
  if (scope === "all") return "Все аккаунты";
  if (scope === "staff") return "Все сотрудники";
  return roleDefinitions[scope].label;
}

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const session = await requireAdminSession(
    "/login?next=/admin/staff",
    "/admin/staff",
  );

  if (!hasDatabaseUrl()) {
    return (
      <SetupState
        title="Учетные записи появятся после подключения БД"
        description="Для отдельных логинов сотрудников нужна рабочая база пользователей."
        steps={[
          "Настройте DATABASE_URL.",
          "Примените Prisma-схему.",
          "Вернитесь в раздел сотрудников и создайте доступ.",
        ]}
      />
    );
  }

  const resolvedSearchParams = await searchParams;
  const query = getSearchValue(resolvedSearchParams, "q");
  const scope = getSearchValue(resolvedSearchParams, "scope") || "staff";
  const directory = await getStaffAccountDirectory({
    page: getPageNumber(getSearchValue(resolvedSearchParams, "page")),
    query,
    scope,
  });
  const noticeCode = getSearchValue(resolvedSearchParams, "notice");
  const notice = noticeMessages[noticeCode];
  const assignableRoleCodes =
    session.roleCode === RoleCode.SUPER_ADMIN
      ? Object.values(RoleCode)
      : [...standardAssignableRoleCodes];
  const getPageHref = (page: number) => {
    const params = new URLSearchParams();
    if (directory.query) params.set("q", directory.query);
    if (directory.scope !== "staff") params.set("scope", directory.scope);
    if (page > 1) params.set("page", String(page));
    const search = params.toString();
    return search ? `/admin/staff?${search}` : "/admin/staff";
  };

  const rows = directory.accounts.map((account) => {
    const isCurrentAccount = account.id === session.userId;
    const canChangeRole =
      !isCurrentAccount &&
      (session.roleCode === RoleCode.SUPER_ADMIN ||
        !privilegedRoleSet.has(account.role.code));
    const isProductionAccess = productionAccessRoleSet.has(account.role.code);

    return {
      account: (
        <div className="min-w-52 space-y-1">
          <p className="font-semibold text-[var(--foreground)]">
            {[account.firstName, account.lastName].filter(Boolean).join(" ") ||
              account.email}
          </p>
          <p className="text-xs break-all text-[var(--muted)]">
            {account.email}
          </p>
          {account.phone ? (
            <p className="text-xs text-[var(--muted)]">{account.phone}</p>
          ) : null}
          {account.companyName ? (
            <p className="text-xs text-[var(--muted)]">{account.companyName}</p>
          ) : null}
        </div>
      ),
      role: (
        <div className="min-w-44 space-y-2">
          <StatusBadge tone={getRoleTone(account.role.code)}>
            {roleDefinitions[account.role.code].label}
          </StatusBadge>
          <p className="text-xs leading-5 text-[var(--muted)]">
            {roleDefinitions[account.role.code].description}
          </p>
          {account.productionStation ? (
            <p className="text-xs font-semibold text-[var(--accent)]">
              {productionStationDefinitions[account.productionStation].label}
            </p>
          ) : null}
        </div>
      ),
      access: (
        <div className="min-w-36 space-y-2">
          <StatusBadge tone={account.isActive ? "success" : "neutral"}>
            {account.isActive ? "Доступ активен" : "Доступ отключен"}
          </StatusBadge>
          <p className="text-xs text-[var(--muted)]">
            Создан {formatDate(account.createdAt)}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {account.hasPassword ? "Пароль настроен" : "Пароль не задан"}
          </p>
        </div>
      ),
      workload: employeeRoleSet.has(account.role.code) ? (
        <div className="min-w-36 space-y-1 text-sm text-[var(--foreground)]">
          <p>Заказов: {account._count.managedOrders}</p>
          <p>Заявок: {account._count.managedRequests}</p>
        </div>
      ) : (
        <p className="text-xs leading-5 text-[var(--muted)]">
          Зарегистрированный клиентский аккаунт
        </p>
      ),
      management: (
        <div className="grid min-w-64 gap-3">
          {canChangeRole ? (
            <form
              action={updateStaffAccountRoleAction}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2"
            >
              <input type="hidden" name="id" value={account.id} />
              <Select
                name="roleCode"
                defaultValue={account.role.code}
                aria-label={`Роль ${account.email}`}
                className="h-9 sm:h-9"
              >
                {assignableRoleCodes.map((roleCode) => (
                  <option key={roleCode} value={roleCode}>
                    {roleDefinitions[roleCode].label}
                  </option>
                ))}
              </Select>
              <Select
                name="productionStation"
                defaultValue={
                  account.productionStation ?? ProductionStation.CUTTING
                }
                aria-label={`Станция ${account.email}`}
                className="h-9 sm:h-9"
              >
                {Object.values(ProductionStation).map((station) => (
                  <option key={station} value={station}>
                    {productionStationDefinitions[station].shortLabel}
                  </option>
                ))}
              </Select>
              <AdminSubmitButton
                type="submit"
                variant="secondary"
                size="sm"
                idleLabel="Сохранить"
                pendingLabel="Сохраняем..."
              />
            </form>
          ) : (
            <p className="text-xs leading-5 text-[var(--muted)]">
              {isCurrentAccount
                ? "Вы работаете под этим аккаунтом."
                : "Изменение доступно супер-администратору."}
            </p>
          )}

          {isProductionAccess ? (
            <>
              <form action={toggleCuttingManagerAccessAction}>
                <input type="hidden" name="id" value={account.id} />
                <input
                  type="hidden"
                  name="isActive"
                  value={account.isActive ? "false" : "true"}
                />
                <AdminSubmitButton
                  type="submit"
                  variant="secondary"
                  size="sm"
                  idleLabel={account.isActive ? "Отключить" : "Включить"}
                  pendingLabel="Сохраняем..."
                />
              </form>

              <form
                action={resetCuttingManagerPasswordAction}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"
              >
                <input type="hidden" name="id" value={account.id} />
                <Input
                  name="password"
                  type="password"
                  minLength={8}
                  maxLength={128}
                  placeholder="Новый пароль"
                  autoComplete="new-password"
                  className="h-9"
                  required
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="icon"
                  title="Сменить пароль"
                  aria-label="Сменить пароль"
                  className="size-9"
                >
                  <KeyRound className="size-4" />
                </Button>
              </form>
            </>
          ) : null}
        </div>
      ),
    };
  });

  return (
    <div className="space-y-5">
      <section className="border border-[color:var(--line)] bg-white p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center bg-[var(--foreground)] text-white">
            <ShieldCheck className="size-5" />
          </span>
          <SectionHeading
            title="Аккаунты и роли"
            description="Все сотрудники Artisan и поиск по зарегистрированным аккаунтам. Здесь можно назначить рабочую роль человеку, который ранее зарегистрировался как клиент."
            titleClassName="text-2xl sm:text-3xl"
            descriptionClassName="max-w-3xl text-sm leading-6"
          />
        </div>
      </section>

      {notice ? (
        <p
          className={
            errorNotices.has(noticeCode)
              ? "border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              : "border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          }
        >
          {notice}
        </p>
      ) : null}

      <section className="border border-[color:var(--line)] bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <UserRoundCog className="mt-0.5 size-5 shrink-0 text-[var(--accent)]" />
          <div>
            <h2 className="font-semibold text-[var(--foreground)]">
              Сотрудник уже регистрировался на сайте?
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Найдите его по email, имени или телефону. Поиск проверяет все
              аккаунты, даже если сейчас у сотрудника указана роль «Клиент»,
              после чего выберите нужную роль и нажмите «Сохранить».
            </p>
          </div>
        </div>

        <form
          method="get"
          className="mt-5 grid gap-3 md:grid-cols-[minmax(16rem,1fr)_minmax(13rem,0.45fr)_auto_auto]"
        >
          <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
            Поиск аккаунта
            <Input
              name="q"
              defaultValue={directory.query}
              placeholder="Имя, email, телефон или компания"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
            Показывать
            <Select name="scope" defaultValue={directory.scope}>
              <option value="staff">Все сотрудники</option>
              <option value="all">Все аккаунты</option>
              {Object.values(RoleCode).map((roleCode) => (
                <option key={roleCode} value={roleCode}>
                  {roleDefinitions[roleCode].label}
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit" className="self-end">
            <Search className="size-4" />
            Найти
          </Button>
          <ButtonLink href="/admin/staff" variant="ghost" className="self-end">
            Сбросить
          </ButtonLink>
        </form>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-[color:var(--line)] pt-4">
          {directory.roleCounts.map(({ code, count }) => (
            <StatusBadge key={code} tone={getRoleTone(code)}>
              {roleDefinitions[code].label}: {count}
            </StatusBadge>
          ))}
        </div>
      </section>

      <section className="border border-[color:var(--line)] bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Производственные аккаунты
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Создайте отдельный аккаунт начальника производства и по одному общему
          аккаунту для распила, кромки и присадки. Каждый оператор увидит только
          свою очередь и разрешенные действия.
        </p>
        <div className="mt-5">
          <ProductionAccountForm />
        </div>
      </section>

      <section className="border border-[color:var(--line)] bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Новый менеджер кроя
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Используйте форму только для нового человека. Для уже
          зарегистрированного аккаунта назначьте роль в таблице ниже.
        </p>
        <div className="mt-5">
          <CuttingManagerForm />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              {getScopeLabel(directory.scope)}
            </h2>
            <p className="text-sm text-[var(--muted)]">
              Найдено аккаунтов: {directory.total}
            </p>
          </div>
          {directory.query ? (
            <p className="text-sm text-[var(--muted)]">
              Поиск: «{directory.query}»
            </p>
          ) : null}
        </div>

        <DataTable
          columns={[
            { key: "account", label: "Аккаунт" },
            { key: "role", label: "Роль" },
            { key: "access", label: "Доступ" },
            { key: "workload", label: "Работа" },
            { key: "management", label: "Управление" },
          ]}
          rows={rows}
          caption="Учетные записи и роли"
          emptyMessage="По заданным условиям аккаунты не найдены."
        />

        {directory.totalPages > 1 ? (
          <Pagination
            currentPage={directory.page}
            totalPages={directory.totalPages}
            getHref={getPageHref}
          />
        ) : null}
      </section>
    </div>
  );
}
