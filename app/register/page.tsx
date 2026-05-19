import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RegisterForm } from "@/app/register/register-form";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { isDemoAdminEnabled } from "@/lib/auth/demo-access";
import { getOptionalSession, getSafeRedirectPath } from "@/lib/auth/dal";
import { canAccessAdmin, getAdminFallbackPath } from "@/lib/auth/roles";
import { hasDatabaseUrl } from "@/lib/db";
import { noIndexRobots } from "@/lib/seo";
import { getRegistrationEmailStatus } from "@/lib/server/registration-verification";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Регистрация",
  robots: noIndexRobots,
};

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
    redirect(
      canAccessAdmin(session.roleCode)
        ? getAdminFallbackPath(session.roleCode)
        : "/account",
    );
  }

  const next = getSafeRedirectPath(resolvedSearchParams.next, "/account");
  const emailStatus = getRegistrationEmailStatus();

  return (
    <Container className="grid min-h-[calc(100vh-9rem)] place-items-center py-12">
      <section className="surface-glow w-full max-w-2xl rounded-[28px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <SectionHeading
          title="Регистрация в Artisan"
          description={
            hasDatabaseUrl()
              ? "Создайте личный кабинет и подтвердите email одноразовым кодом. После этого будут доступны заказы, бонусы и персональные скидки."
              : isDemoAdminEnabled()
                ? "Сейчас включен demo-доступ для команды. Регистрация клиентов откроется после подключения PostgreSQL."
                : "Сначала подключите базу данных и seed. После этого регистрация станет доступна для реальных клиентов."
          }
          titleClassName="text-3xl sm:text-4xl"
          descriptionClassName="max-w-2xl text-sm leading-7"
        />

        {!emailStatus.ready ? (
          <div className="mt-5 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            Регистрация по email сейчас настраивается. Пока менеджер может
            создать или привязать кабинет вручную через QR и продажу в зале.
            Если вы клиент, пожалуйста, свяжитесь с Artisan через контакты.
          </div>
        ) : null}

        <RegisterForm next={next} emailReady={emailStatus.ready} />
      </section>
    </Container>
  );
}
