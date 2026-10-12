import { CheckCircle2, UserRound } from "lucide-react";

import { updateAccountProfileAction } from "@/app/account/profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { getAccountUser } from "@/lib/server/account-data";

export const dynamic = "force-dynamic";

type ProfilePageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const emptySearchParams: {
    status?: string;
    message?: string;
  } = {};
  const [user, params] = await Promise.all([
    getAccountUser(),
    searchParams ?? Promise.resolve(emptySearchParams),
  ]);

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[20px] border border-[color:var(--line)] bg-[var(--surface-strong)] p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center bg-[var(--foreground)] text-white">
            <UserRound className="size-5" aria-hidden />
          </div>
          <SectionHeading
            title="Профиль"
            description="Актуальные данные используются в заказах, уведомлениях и для связи с менеджером."
            titleClassName="text-2xl sm:text-3xl"
            descriptionClassName="max-w-2xl text-sm leading-6"
          />
        </div>
      </section>

      {params.status ? (
        <div
          className={
            params.status === "success"
              ? "flex items-center gap-3 border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800"
              : "border border-red-300 bg-red-50 p-4 text-sm text-red-800"
          }
        >
          {params.status === "success" ? (
            <>
              <CheckCircle2 className="size-5 shrink-0" aria-hidden />
              Данные профиля сохранены.
            </>
          ) : (
            params.message || "Не удалось сохранить профиль."
          )}
        </div>
      ) : null}

      <form
        action={updateAccountProfileAction}
        className="grid gap-5 border border-[color:var(--line)] bg-white p-5 sm:p-7"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <ProfileField
            label="Имя"
            name="firstName"
            value={user.firstName}
            required
          />
          <ProfileField label="Фамилия" name="lastName" value={user.lastName} />
          <ProfileField
            label="Телефон"
            name="phone"
            value={user.phone}
            type="tel"
          />
          <ProfileField
            label="Компания"
            name="companyName"
            value={user.companyName}
          />
          <ProfileField
            label="Email"
            name="email"
            value={user.email}
            type="email"
            required
            className="md:col-span-2"
          />
        </div>

        <Button type="submit" variant="accent" className="w-full sm:w-fit">
          Сохранить изменения
        </Button>
      </form>
    </div>
  );
}

function ProfileField({
  label,
  name,
  value,
  type = "text",
  required = false,
  className = "",
}: {
  label: string;
  name: string;
  value: string | null;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`grid gap-2 ${className}`}>
      <span className="text-sm font-medium text-[var(--foreground)]">
        {label}
      </span>
      <Input
        name={name}
        type={type}
        defaultValue={value ?? ""}
        required={required}
        autoComplete={name}
      />
    </label>
  );
}
