import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  getDemoAdminCredentials,
  isDemoAdminEnabled,
} from "@/lib/auth/demo-access";
import { getOptionalSession, getSafeRedirectPath } from "@/lib/auth/dal";
import { canAccessAdmin, getAdminFallbackPath } from "@/lib/auth/roles";
import { hasDatabaseUrl } from "@/lib/db";
import { noIndexRobots } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Вход",
  robots: noIndexRobots,
};

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
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
  const demoCredentials = getDemoAdminCredentials();

  return (
    <Container className="grid min-h-[calc(100vh-9rem)] place-items-center py-12">
      <section className="surface-glow w-full max-w-xl rounded-[28px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <SectionHeading
          title="Вход в Artisan"
          description={
            hasDatabaseUrl()
              ? "Авторизуйтесь, чтобы открыть личный кабинет, историю заказов и рабочие разделы команды."
              : isDemoAdminEnabled()
                ? "Сейчас включен demo-режим: можно сразу войти в админку, а живые данные подключить позже."
                : "Сначала подключите базу данных и seed, затем вход по email и паролю станет доступен."
          }
          titleClassName="text-3xl sm:text-4xl"
          descriptionClassName="max-w-2xl text-sm leading-7"
        />

        {demoCredentials ? (
          <div className="mt-6 rounded-[24px] border border-[color:var(--line)] bg-[var(--surface)] p-5">
            <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--accent)] uppercase">
              Demo access
            </p>
            <h2 className="mt-3 text-xl font-semibold text-[var(--foreground)]">
              Быстрый вход в админку
            </h2>
            <div className="mt-4 grid gap-3 text-sm text-[var(--foreground)]">
              <div className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface-strong)] px-4 py-3">
                <span className="text-[var(--muted)]">Email:</span>{" "}
                <span className="font-semibold">{demoCredentials.email}</span>
              </div>
              <div className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface-strong)] px-4 py-3">
                <span className="text-[var(--muted)]">Пароль:</span>{" "}
                <span className="font-semibold">
                  {demoCredentials.password}
                </span>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
              После входа откроется <span className="font-semibold">/admin</span>.
            </p>
          </div>
        ) : null}

        <LoginForm next={next} />
      </section>
    </Container>
  );
}
