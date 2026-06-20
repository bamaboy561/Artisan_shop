import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { companyName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Пользовательское соглашение",
  description: `Пользовательское соглашение ${companyName}. Условия использования сайта и сервисов.`,
};

export default function TermsPage() {
  return (
    <Container className="max-w-3xl space-y-8 py-10 sm:py-14">
      <SectionHeading
        title="Пользовательское соглашение"
        description="Условия использования сайта, сервисов и материалов."
      />

      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <div className="prose prose-sm max-w-none text-[var(--foreground)]">
          <h2 className="text-lg font-semibold">1. Общие условия</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Настоящее соглашение определяет условия использования сайта{" "}
            {companyName}. Используя сайт, вы соглашаетесь с данными условиями.
          </p>

          <h2 className="mt-6 text-lg font-semibold">
            2. Использование сервисов
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Вы можете использовать каталог, калькулятор распила, формы заявок и
            личный кабинет. Администрация оставляет за собой право изменять
            функциональность сервисов.
          </p>

          <h2 className="mt-6 text-lg font-semibold">3. Ответственность</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Информация о ценах и наличии является ориентировочной. Точные
            условия подтверждает менеджер при обработке заявки.
          </p>

          <h2 className="mt-6 text-lg font-semibold">4. Связь</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            По всем вопросам обращайтесь на{" "}
            <Link
              href="/contacts"
              className="font-medium text-[var(--accent)] transition hover:underline"
            >
              страницу контактов
            </Link>
            .
          </p>
        </div>
      </section>
    </Container>
  );
}
