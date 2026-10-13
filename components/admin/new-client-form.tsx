import { createClientByManagerAction } from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Input } from "@/components/ui/input";

// Быстрое создание клиента менеджером: только имя и телефон.
export function NewClientForm({
  returnTo,
  defaultOpen = false,
}: {
  returnTo: "sales-floor" | "users";
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="rounded-2xl border border-[color:var(--line)] bg-white p-4"
    >
      <summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)]">
        Новый клиент
      </summary>
      <form
        action={createClientByManagerAction}
        className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end"
      >
        <input type="hidden" name="returnTo" value={returnTo} />
        <label className="grid gap-1.5 text-xs font-medium text-[var(--foreground)]">
          Имя
          <Input name="firstName" required maxLength={80} className="h-10" />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-[var(--foreground)]">
          Фамилия
          <Input name="lastName" maxLength={80} className="h-10" />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-[var(--foreground)]">
          Телефон
          <Input
            name="phone"
            type="tel"
            required
            inputMode="tel"
            placeholder="0553 432 131"
            className="h-10"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-[var(--foreground)]">
          Компания
          <Input name="companyName" maxLength={120} className="h-10" />
        </label>
        <AdminSubmitButton
          type="submit"
          variant="accent"
          size="sm"
          className="h-10"
          idleLabel="Создать"
          pendingLabel="Создаём..."
        />
      </form>
      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
        Почта не нужна. Клиент сразу сможет покупать в зале, копить и тратить
        баллы. Вход в личный кабинет появится, когда в его карточке укажут
        настоящую почту. Если клиент с таким телефоном уже есть, откроется он.
      </p>
    </details>
  );
}
