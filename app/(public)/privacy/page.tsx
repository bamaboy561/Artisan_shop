import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { companyName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description: `Политика конфиденциальности ${companyName}. Информация о сборе, использовании и защите персональных данных.`,
};

export default function PrivacyPage() {
  return (
    <Container className="max-w-3xl space-y-8 py-10 sm:py-14">
      <SectionHeading
        title="Политика конфиденциальности"
        description="Данная страница описывает правила обработки и защиты персональных данных пользователей сайта."
      />

      <section className="surface-glow rounded-[24px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 sm:p-8">
        <div className="prose prose-sm max-w-none text-[var(--foreground)]">
          <h2 className="text-lg font-semibold">1. Общие положения</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            {companyName} обрабатывает персональные данные посетителей сайта в
            соответствии с законодательством Кыргызской Республики. Используя
            сайт, вы соглашаетесь с условиями настоящей политики.
          </p>

          <h2 className="mt-6 text-lg font-semibold">
            2. Какие данные мы собираем
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Имя, телефон и email — при заполнении форм обратной связи или
            регистрации. Техническая информация — IP-адреса и cookies для
            обеспечения работы сайта.
          </p>

          <h2 className="mt-6 text-lg font-semibold">
            3. Как мы используем данные
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Для обработки заявок, улучшения сервиса и связи с вами по вопросам
            заказов. Мы не передаём данные третьим лицам без вашего согласия.
          </p>

          <h2 className="mt-6 text-lg font-semibold">4. Связь</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            По вопросам обработки персональных данных обращайтесь на{" "}
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
