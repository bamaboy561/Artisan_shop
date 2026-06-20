import Link from "next/link";

import { Container } from "@/components/ui/container";
import {
  companyContacts,
  companyName,
  primaryNavigation,
} from "@/lib/site-config";

const supportLinks = [
  { href: "/contacts", label: "Контакты" },
  { href: "/about", label: "О компании" },
  { href: "/services", label: "Услуги" },
];

export function SiteFooter() {
  return (
    <footer className="mt-14 bg-[var(--hero)] text-white sm:mt-18 lg:mt-20">
      <Container className="grid gap-10 py-10 sm:py-12 md:grid-cols-2 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1fr] lg:py-16">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-lg font-semibold"
          >
            <span className="flex size-10 items-center justify-center rounded-[1rem] bg-white text-[var(--hero)]">
              A
            </span>
            {companyName}
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/64 sm:mt-5">
            Материалы, распил и проектные заявки в одной системе.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white/92">Навигация</h3>
          <nav className="mt-4 space-y-3 sm:mt-5">
            {primaryNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block text-sm text-white/60 transition hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white/92">Разделы</h3>
          <nav className="mt-4 space-y-3 sm:mt-5">
            {supportLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block text-sm text-white/60 transition hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white/92">Контакты</h3>
          <div className="mt-4 space-y-3 text-sm leading-6 text-white/60 sm:mt-5 sm:leading-7">
            {companyContacts.phone ? (
              <p>
                <a
                  href={`tel:${companyContacts.phone.replace(/[\s()-]/g, "")}`}
                  className="transition hover:text-white"
                >
                  {companyContacts.phone}
                </a>
              </p>
            ) : null}
            {companyContacts.email ? (
              <p>
                <a
                  href={`mailto:${companyContacts.email}`}
                  className="transition hover:text-white"
                >
                  {companyContacts.email}
                </a>
              </p>
            ) : null}
            {companyContacts.hours ? <p>{companyContacts.hours}</p> : null}
            {companyContacts.address ? <p>{companyContacts.address}</p> : null}
          </div>
        </div>
      </Container>

      <div className="border-t border-white/10">
        <Container className="flex flex-col items-start justify-between gap-3 py-5 text-xs text-white/42 sm:flex-row sm:items-center">
          <p>&copy; 2026 {companyName}. Все права защищены.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            <Link href="/privacy" className="transition hover:text-white/72">
              Политика конфиденциальности
            </Link>
            <Link href="/terms" className="transition hover:text-white/72">
              Пользовательское соглашение
            </Link>
          </div>
        </Container>
      </div>
    </footer>
  );
}
