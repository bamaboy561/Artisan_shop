import { ButtonLink } from "@/components/ui/button-link";
import { isDemoModeEnabled } from "@/lib/db";

type SetupStateProps = {
  title: string;
  description: string;
  steps: string[];
};

export function SetupState({ title, description, steps }: SetupStateProps) {
  const demoMode = isDemoModeEnabled();

  return (
    <section className="surface-glow rounded-[28px] border border-[color:var(--line)] bg-white/82 p-6 sm:p-8">
      <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--accent)] uppercase">
        {demoMode ? "Включен demo-режим" : "Требуется подключение базы"}
      </p>
      <h2 className="mt-4 text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">
        {title}
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base">
        {description}
      </p>

      {demoMode ? (
        <div className="mt-6 rounded-[24px] border border-[color:var(--line)] bg-[var(--surface)] px-5 py-4 text-sm leading-6 text-[var(--foreground)]">
          Сейчас ты уже можешь войти в админку и проверить shell, навигацию и
          интерфейсы. Живые данные, сохранение изменений и операционная логика
          включатся после подключения PostgreSQL.
        </div>
      ) : null}

      <ol className="mt-6 grid gap-3 text-sm text-[var(--foreground)]">
        {steps.map((step, index) => (
          <li
            key={step}
            className="rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] px-4 py-4"
          >
            <span className="mr-3 inline-flex size-7 items-center justify-center rounded-full bg-[var(--hero)] text-xs font-semibold text-white">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="/admin" variant="secondary">
          Обновить после настройки
        </ButtonLink>
        {demoMode ? (
          <ButtonLink href="/login?next=/admin" variant="contrast">
            Войти в админку
          </ButtonLink>
        ) : null}
      </div>
    </section>
  );
}
