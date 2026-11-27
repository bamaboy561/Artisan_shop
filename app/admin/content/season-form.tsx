import { saveSeasonModeAction } from "@/app/admin/content/season-actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { resolveSeason, type SeasonMode } from "@/lib/season";

const options: { mode: SeasonMode; title: string; text: string }[] = [
  {
    mode: "auto",
    title: "Само по датам",
    text: "Включится 1 декабря, выключится 15 января",
  },
  { mode: "on", title: "Включено", text: "Пока не выключите вручную" },
  { mode: "off", title: "Выключено", text: "Обычный вид сайта" },
];

// Новогодняя гирлянда, снег на главной, шапочка на логотипе и поздравление
// в верхней строке. Меняет только вид витрины, цены и заказы не трогает.
export function SeasonForm({ mode }: { mode: SeasonMode }) {
  const active = resolveSeason(mode);

  return (
    <section className="surface-glow rounded-[var(--radius-card)] border border-[color:var(--line)] bg-white/82 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Новогоднее оформление сайта
        </h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            active
              ? "bg-emerald-100 text-emerald-800"
              : "bg-stone-100 text-stone-600"
          }`}
        >
          {active ? `Сейчас на сайте · ${active.greeting}` : "Сейчас выключено"}
        </span>
      </div>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
        Гирлянда под шапкой, снег на главной, шапочка на логотипе и поздравление
        в верхней строке. Цены и заказы не меняются.
      </p>
      <form
        action={saveSeasonModeAction}
        className="mt-4 grid gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-stretch"
      >
        {options.map((option) => (
          <label
            key={option.mode}
            className="flex cursor-pointer gap-3 rounded-2xl border border-[color:var(--line)] p-3 text-sm has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent)]/5"
          >
            <input
              type="radio"
              name="mode"
              value={option.mode}
              defaultChecked={option.mode === mode}
              className="mt-1 accent-[var(--accent)]"
            />
            <span>
              <span className="block font-semibold">{option.title}</span>
              <span className="block text-xs text-[var(--muted)]">
                {option.text}
              </span>
            </span>
          </label>
        ))}
        <AdminSubmitButton
          type="submit"
          idleLabel="Сохранить"
          pendingLabel="Сохраняем…"
        />
      </form>
    </section>
  );
}
