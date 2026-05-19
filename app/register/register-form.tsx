"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { registerAction, type RegisterFormState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: RegisterFormState = {};

type RegisterFormProps = {
  next: string;
  emailReady: boolean;
};

export function RegisterForm({ next, emailReady }: RegisterFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    registerAction,
    initialState,
  );
  const isVerificationStep = state.step === "verify" && Boolean(state.email);
  const feedbackClassName =
    state.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : state.tone === "info"
        ? "border-sky-200 bg-sky-50 text-sky-800"
        : "border-rose-200 bg-rose-50 text-rose-700";

  useEffect(() => {
    if (state.success && state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [router, state.redirectTo, state.success]);

  return (
    <form action={formAction} className="mt-6 grid gap-4">
      <input type="hidden" name="next" value={next} />

      {isVerificationStep ? (
        <>
          <input type="hidden" name="email" value={state.email} />

          <div className="rounded-[22px] border border-[color:var(--line)] bg-[var(--surface)] p-4">
            <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
              Подтверждение email
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Мы отправили 6-значный код на{" "}
              <span className="font-semibold text-[var(--foreground)]">
                {state.email}
              </span>
              . Код действует 10 минут.
            </p>
          </div>

          <label className="grid gap-2 text-sm text-[var(--foreground)]">
            Код из письма
            <Input
              name="verificationCode"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              autoComplete="one-time-code"
              required
            />
          </label>

          {state.debugCode ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Локальный код для проверки:{" "}
              <span className="font-mono text-base font-semibold tracking-[0.18em]">
                {state.debugCode}
              </span>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Имя
              <Input
                name="firstName"
                placeholder="Ирина"
                autoComplete="given-name"
                required
              />
            </label>
            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Фамилия
              <Input
                name="lastName"
                placeholder="Кузнецова"
                autoComplete="family-name"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Телефон
              <Input
                name="phone"
                type="tel"
                placeholder="+996 700 000 000"
                autoComplete="tel"
              />
            </label>
            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Компания / студия
              <Input
                name="companyName"
                placeholder="Studio Form"
                autoComplete="organization"
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm text-[var(--foreground)]">
            Email
            <Input
              name="email"
              type="email"
              placeholder="project@artisan.shop.kg"
              autoComplete="email"
              required
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Пароль
              <Input
                name="password"
                type="password"
                placeholder="Минимум 8 символов"
                autoComplete="new-password"
                required
              />
            </label>
            <label className="grid gap-2 text-sm text-[var(--foreground)]">
              Повторите пароль
              <Input
                name="confirmPassword"
                type="password"
                placeholder="Повторите пароль"
                autoComplete="new-password"
                required
              />
            </label>
          </div>
        </>
      )}

      {state.message ? (
        <p className={`rounded-2xl border px-4 py-3 text-sm ${feedbackClassName}`}>
          {state.message}
        </p>
      ) : null}

      {isVerificationStep ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Button
            type="submit"
            name="intent"
            value="verify-code"
            variant="accent"
            disabled={pending}
          >
            {pending ? "Проверяем код..." : "Подтвердить и войти"}
          </Button>
          <Button
            type="submit"
            name="intent"
            value="resend-code"
            variant="secondary"
            disabled={pending}
            formNoValidate
          >
            Отправить ещё раз
          </Button>
          <button
            type="submit"
            name="intent"
            value="restart"
            className="text-left text-sm font-medium text-[var(--muted)] transition hover:text-[var(--foreground)] sm:col-span-2"
            disabled={pending}
            formNoValidate
          >
            Изменить данные регистрации
          </button>
        </div>
      ) : (
        <Button
          type="submit"
          name="intent"
          value="request-code"
          variant="accent"
          disabled={pending || !emailReady}
        >
          {pending
            ? "Отправляем код..."
            : emailReady
              ? "Получить код и продолжить"
              : "Регистрация временно настраивается"}
        </Button>
      )}

      <p className="text-sm text-[var(--muted)]">
        Уже есть аккаунт?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="font-medium text-[var(--foreground)] transition hover:text-[var(--accent)]"
        >
          Войти
        </Link>
      </p>
    </form>
  );
}
