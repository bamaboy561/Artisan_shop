import {
  createStaffUserAction,
  promoteUserToStaffAction,
  updateStaffPasswordAction,
  updateStaffUserAction,
} from "@/app/admin/actions";
import { SetupState } from "@/components/admin/setup-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Select } from "@/components/ui/select";
import { RoleCode } from "@/generated/prisma";
import { requireAdminPermission } from "@/lib/auth/dal";
import { getDb, hasDatabaseUrl } from "@/lib/db";

export const dynamic = "force-dynamic";

type AdminStaffPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const staffRoleLabels: Record<RoleCode, string> = {
  [RoleCode.CUSTOMER]: "Клиент",
  [RoleCode.DEALER]: "Дилер",
  [RoleCode.MANAGER]: "Менеджер",
  [RoleCode.ADMIN]: "Администратор",
  [RoleCode.SUPER_ADMIN]: "Супер-админ",
};

const staffRoleOptions = [
  RoleCode.MANAGER,
  RoleCode.ADMIN,
  RoleCode.SUPER_ADMIN,
] as const;

const noticeCopy: Record<
  string,
  { tone: "success" | "warning" | "neutral"; title: string; text: string }
> = {
  created: {
    tone: "success",
    title: "Сотрудник создан",
    text: "Теперь он может войти по email и временному паролю.",
  },
  converted: {
    tone: "success",
    title: "Пользователь переведен в сотрудники",
    text: "Аккаунт уже существовал, поэтому мы сменили ему роль и включили доступ в админку.",
  },
  updated: {
    tone: "success",
    title: "Доступ обновлен",
    text: "Изменения роли, телефона или активности сохранены.",
  },
  password: {
    tone: "success",
    title: "Пароль обновлен",
    text: "Передайте сотруднику новый временный пароль.",
  },
  exists: {
    tone: "warning",
    title: "Этот пользователь уже сотрудник",
    text: "Проверьте список сотрудников ниже или задайте ему новый пароль.",
  },
  invalid: {
    tone: "warning",
    title: "Заполните обязательные поля",
    text: "Нужны корректный email, роль и пароль минимум 8 символов.",
  },
  database: {
    tone: "warning",
    title: "База не подключена",
    text: "Проверьте DATABASE_URL и production bootstrap.",
  },
  error: {
    tone: "warning",
    title: "Не удалось сохранить",
    text: "Попробуйте еще раз. Если повторится, проверьте логи Vercel.",
  },
};

function getSearchValue(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getRoleTone(roleCode: RoleCode) {
  if (roleCode === RoleCode.SUPER_ADMIN) return "warning" as const;
  if (roleCode === RoleCode.ADMIN) return "accent" as const;
  return "neutral" as const;
}

function getDisplayName(user: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

export default async function AdminStaffPage({
  searchParams,
}: AdminStaffPageProps) {
  if (!hasDatabaseUrl()) {
    return (
      <SetupState
        title="Сотрудники появятся после подключения базы"
        description="Раздел создает менеджеров и администраторов, но ему нужен PostgreSQL и production bootstrap."
        steps={[
          "Подключите DATABASE_URL.",
          "Выполните prisma:bootstrap.",
          "Войдите под супер-админом и создайте менеджеров для планшетов.",
        ]}
      />
    );
  }

  const session = await requireAdminPermission(
    "/admin/staff",
    "/login?next=/admin/staff",
  );
  const resolvedSearchParams = await searchParams;
  const noticeKey = getSearchValue(resolvedSearchParams, "staff");
  const notice = noticeKey ? noticeCopy[noticeKey] : null;
  const noticeEmail = getSearchValue(resolvedSearchParams, "email");
  const db = getDb();

  const [staff, candidateUsers] = await Promise.all([
    db.user.findMany({
      where: {
        role: {
          code: {
            in: [RoleCode.MANAGER, RoleCode.ADMIN, RoleCode.SUPER_ADMIN],
          },
        },
      },
      orderBy: [{ role: { code: "desc" } }, { createdAt: "asc" }],
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        createdAt: true,
        role: {
          select: {
            code: true,
            name: true,
          },
        },
        _count: {
          select: {
            managedOrders: true,
            managedRequests: true,
          },
        },
      },
    }),
    db.user.findMany({
      where: {
        role: {
          code: {
            in: [RoleCode.CUSTOMER, RoleCode.DEALER],
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 12,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        createdAt: true,
        role: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-4">
      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-5 sm:p-7">
        <SectionHeading
          title="Сотрудники и доступы"
          description="Создавайте менеджеров для планшетов, переводите существующих пользователей в сотрудников и отключайте доступ без удаления истории заказов."
          titleClassName="text-2xl sm:text-3xl"
          descriptionClassName="max-w-4xl text-sm leading-7"
        />
      </section>

      {notice ? (
        <section className="rounded-[22px] border border-[color:var(--line)] bg-white/95 p-4 shadow-[0_16px_40px_rgba(17,17,17,0.035)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <StatusBadge tone={notice.tone}>{notice.title}</StatusBadge>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {notice.text}
                {noticeEmail ? ` Email: ${noticeEmail}.` : ""}
              </p>
            </div>
            <a
              href="/admin/staff"
              className="font-mono text-[11px] font-semibold tracking-[0.14em] text-[var(--accent)] uppercase"
            >
              Очистить
            </a>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
        <form
          action={createStaffUserAction}
          className="rounded-[26px] border border-[color:var(--line)] bg-white/92 p-5 shadow-[0_18px_44px_rgba(17,17,17,0.04)]"
        >
          <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
            Новый сотрудник
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            Доступ для команды
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Если email уже есть среди клиентов, аккаунт не потеряется: мы просто
            переведем его в выбранную роль.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
              Имя
              <Input name="firstName" placeholder="Имя" />
            </label>
            <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
              Фамилия
              <Input name="lastName" placeholder="Фамилия" />
            </label>
            <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
              Email
              <Input
                name="email"
                type="email"
                placeholder="manager@artisan.shop.kg"
                required
              />
            </label>
            <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
              Телефон
              <Input name="phone" placeholder="+996..." />
            </label>
            <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
              Роль
              <Select name="roleCode" defaultValue={RoleCode.MANAGER}>
                {staffRoleOptions.map((roleCode) => (
                  <option key={roleCode} value={roleCode}>
                    {staffRoleLabels[roleCode]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
              Временный пароль
              <Input
                name="password"
                type="password"
                minLength={8}
                placeholder="Минимум 8 символов"
                required
              />
            </label>
          </div>

          <Button type="submit" variant="accent" className="mt-4 w-full">
            Создать или перевести в сотрудники
          </Button>
        </form>

        <article className="rounded-[26px] border border-[color:var(--line)] bg-[#111111] p-5 text-white shadow-[0_22px_58px_rgba(17,17,17,0.16)]">
          <p className="font-mono text-[10px] tracking-[0.22em] text-white/42 uppercase">
            Матрица доступа
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
            Менеджер видит только рабочие разделы
          </h2>
          <div className="mt-5 grid gap-2 text-sm text-white/68">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
              <strong className="text-white">Менеджер:</strong> мой кабинет,
              продажа в зале, заказы, заявки, распил, карточка клиента и
              подтверждение бонусов.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
              <strong className="text-white">Администратор:</strong> каталог,
              товары, бренды, клиенты, акции и настройки калькулятора.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
              <strong className="text-white">Супер-админ:</strong> сотрудники,
              запуск, Telegram webhook и все системные разделы.
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            title="Текущие сотрудники"
            description="Пользователи, которые имеют доступ к админке."
            titleClassName="text-xl sm:text-2xl"
            descriptionClassName="text-sm"
          />
          <span className="rounded-full border border-[color:var(--line)] bg-white px-3 py-1.5 text-xs text-[var(--muted)]">
            {staff.length} сотрудников
          </span>
        </div>

        {staff.map((user) => {
          const displayName = getDisplayName(user);
          const isSelf = user.id === session.userId;

          return (
            <article
              key={user.id}
              className="rounded-[24px] border border-[color:var(--line)] bg-white/92 p-4 shadow-[0_16px_40px_rgba(17,17,17,0.035)]"
            >
              <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_320px] xl:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={getRoleTone(user.role.code)}>
                      {staffRoleLabels[user.role.code]}
                    </StatusBadge>
                    <StatusBadge tone={user.isActive ? "success" : "neutral"}>
                      {user.isActive ? "Активен" : "Отключен"}
                    </StatusBadge>
                    {isSelf ? (
                      <StatusBadge tone="warning">Это вы</StatusBadge>
                    ) : null}
                  </div>
                  <h3 className="mt-3 truncate text-xl font-semibold text-[var(--foreground)]">
                    {displayName}
                  </h3>
                  <p className="mt-1 truncate text-sm text-[var(--muted)]">
                    {user.email}
                  </p>
                  <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                    Создан: {formatDate(user.createdAt)} · Заказы:{" "}
                    {user._count.managedOrders} · Заявки:{" "}
                    {user._count.managedRequests}
                  </p>
                </div>

                <form
                  action={updateStaffUserAction}
                  className="grid gap-3 rounded-[20px] border border-[color:var(--line)] bg-[var(--surface)] p-3 sm:grid-cols-2"
                >
                  <input type="hidden" name="id" value={user.id} />
                  <Input
                    name="firstName"
                    defaultValue={user.firstName ?? ""}
                    placeholder="Имя"
                  />
                  <Input
                    name="lastName"
                    defaultValue={user.lastName ?? ""}
                    placeholder="Фамилия"
                  />
                  <Input
                    name="phone"
                    defaultValue={user.phone ?? ""}
                    placeholder="Телефон"
                  />
                  <Select
                    name="roleCode"
                    defaultValue={user.role.code}
                    disabled={isSelf}
                  >
                    {staffRoleOptions.map((roleCode) => (
                      <option key={roleCode} value={roleCode}>
                        {staffRoleLabels[roleCode]}
                      </option>
                    ))}
                  </Select>
                  {isSelf ? (
                    <input
                      type="hidden"
                      name="roleCode"
                      value={RoleCode.SUPER_ADMIN}
                    />
                  ) : null}
                  <label className="flex items-center gap-2 rounded-xl border border-[color:var(--line)] bg-white px-3 py-2 text-sm text-[var(--foreground)]">
                    <input
                      type="checkbox"
                      name="isActive"
                      defaultChecked={user.isActive}
                      disabled={isSelf}
                    />
                    Активен
                  </label>
                  {isSelf ? (
                    <input type="hidden" name="isActive" value="on" />
                  ) : null}
                  <Button type="submit" variant="secondary" className="w-full">
                    Сохранить
                  </Button>
                </form>

                <form
                  action={updateStaffPasswordAction}
                  className="grid gap-3 rounded-[20px] border border-[color:var(--line)] bg-[var(--surface)] p-3"
                >
                  <input type="hidden" name="id" value={user.id} />
                  <label className="grid gap-1.5 text-sm text-[var(--foreground)]">
                    Новый пароль
                    <Input
                      name="password"
                      type="password"
                      minLength={8}
                      placeholder="Минимум 8 символов"
                    />
                  </label>
                  <Button type="submit" variant="accent" className="w-full">
                    Сбросить пароль
                  </Button>
                </form>
              </div>
            </article>
          );
        })}
      </section>

      {candidateUsers.length > 0 ? (
        <section className="rounded-[26px] border border-[color:var(--line)] bg-white/92 p-5 shadow-[0_18px_44px_rgba(17,17,17,0.04)]">
          <SectionHeading
            title="Пользователи без доступа в админку"
            description="Если сотрудник был создан как клиент или уже регистрировался на сайте, переведите его в нужную роль здесь."
            titleClassName="text-xl sm:text-2xl"
            descriptionClassName="max-w-3xl text-sm leading-6"
          />

          <div className="mt-4 grid gap-3">
            {candidateUsers.map((user) => (
              <article
                key={user.id}
                className="grid gap-3 rounded-[20px] border border-[color:var(--line)] bg-[var(--surface)] p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone="neutral">
                      {staffRoleLabels[user.role.code]}
                    </StatusBadge>
                    <StatusBadge tone={user.isActive ? "success" : "neutral"}>
                      {user.isActive ? "Активен" : "Отключен"}
                    </StatusBadge>
                  </div>
                  <h3 className="mt-2 truncate text-base font-semibold text-[var(--foreground)]">
                    {getDisplayName(user)}
                  </h3>
                  <p className="mt-1 truncate text-xs text-[var(--muted)]">
                    {user.email}
                    {user.phone ? ` · ${user.phone}` : ""}
                  </p>
                </div>

                <form
                  action={promoteUserToStaffAction}
                  className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                >
                  <input type="hidden" name="id" value={user.id} />
                  <Select name="roleCode" defaultValue={RoleCode.MANAGER}>
                    {staffRoleOptions.map((roleCode) => (
                      <option key={roleCode} value={roleCode}>
                        {staffRoleLabels[roleCode]}
                      </option>
                    ))}
                  </Select>
                  <Input
                    name="password"
                    type="password"
                    minLength={8}
                    placeholder="Новый пароль, если нужен"
                  />
                  <Button type="submit" variant="accent" className="px-4">
                    Дать доступ
                  </Button>
                </form>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
