import { redirect } from "next/navigation";

import { RegisterForm } from "@/app/register/register-form";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { isDemoAdminEnabled } from "@/lib/auth/demo-access";
import { getOptionalSession, getSafeRedirectPath } from "@/lib/auth/dal";
import { canAccessAdmin } from "@/lib/auth/roles";
import { hasDatabaseUrl } from "@/lib/db";

export const dynamic = "force-dynamic";

type RegisterPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function RegisterPage({
  searchParams,
}: RegisterPageProps) {
  const [session, resolvedSearchParams] = await Promise.all([
    getOptionalSession(),
    searchParams,
  ]);

  if (session?.userId) {
    redirect(canAccessAdmin(session.roleCode) ? "/admin" : "/account");
  }

  const next = getSafeRedirectPath(resolvedSearchParams.next, "/account");

  return (
    <Container className="grid min-h-[calc(100vh-9rem)] place-items-center py-12">
      <section className="surface-glow w-full max-w-2xl rounded-[28px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <SectionHeading
          title="Регистрация в Artisan"
          description={
            hasDatabaseUrl()
              ? "Создайте личный кабинет, чтобы сохранять заказы, использовать бонусы и получать персональные скидки."
              : isDemoAdminEnabled()
                ? "Сейчас включен demo-доступ для команды. Регистрация клиентов откроется после подключения PostgreSQL."
                : "Сначала подключите базу данных и seed. После этого регистрация станет доступна для реальных клиентов."
          }
          titleClassName="text-3xl sm:text-4xl"
          descriptionClassName="max-w-2xl text-sm leading-7"
        />
        <RegisterForm next={next} />
      </section>
    </Container>
  );
}
