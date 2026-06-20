"use client";

import { useState } from "react";

import { createCategoryAction } from "@/app/admin/actions";
import {
  GeneratedSlugInput,
  ManagerHelpCard,
} from "@/components/admin/generated-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CategoryKind } from "@/generated/prisma";

const categoryKindLabels: Record<CategoryKind, string> = {
  [CategoryKind.PLATE]: "Плитный материал",
  [CategoryKind.FITTINGS]: "Фурнитура",
  [CategoryKind.OTHER]: "Другое",
};

const categoryPresets: Record<
  CategoryKind,
  { indicator: string; scenario: string; summary: string }
> = {
  [CategoryKind.PLATE]: {
    indicator: "Плитные материалы",
    scenario: "Запрос цены, образцы и расчет распила",
    summary:
      "Материалы для мебельных и интерьерных проектов с консультацией менеджера.",
  },
  [CategoryKind.FITTINGS]: {
    indicator: "Фурнитура",
    scenario: "Покупка онлайн или запрос наличия",
    summary: "Комплектующие для мебели, кухни, шкафов и систем хранения.",
  },
  [CategoryKind.OTHER]: {
    indicator: "Каталог",
    scenario: "Консультация менеджера",
    summary: "Направление каталога для консультации и подбора.",
  },
};

export function CategoryCreateForm() {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CategoryKind>(CategoryKind.OTHER);
  const [indicator, setIndicator] = useState(
    categoryPresets[CategoryKind.OTHER].indicator,
  );
  const [scenario, setScenario] = useState(
    categoryPresets[CategoryKind.OTHER].scenario,
  );
  const [summary, setSummary] = useState(
    categoryPresets[CategoryKind.OTHER].summary,
  );

  function applyPreset(nextKind: CategoryKind) {
    setKind(nextKind);
    setIndicator(categoryPresets[nextKind].indicator);
    setScenario(categoryPresets[nextKind].scenario);
    setSummary(categoryPresets[nextKind].summary);
  }

  return (
    <form action={createCategoryAction} className="mt-6 grid gap-4">
      <ManagerHelpCard title="Упрощенный режим">
        Введите название и выберите тип. Адрес страницы, порядок и рабочие
        подсказки можно оставить автоматическими.
      </ManagerHelpCard>

      <label className="grid gap-2 text-sm text-[var(--foreground)]">
        Название категории
        <Input
          name="name"
          placeholder="Стеновые панели"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <label className="grid gap-2 text-sm text-[var(--foreground)]">
        Тип категории
        <Select
          name="kind"
          value={kind}
          onChange={(event) => applyPreset(event.target.value as CategoryKind)}
        >
          {Object.values(CategoryKind).map((kindValue) => (
            <option key={kindValue} value={kindValue}>
              {categoryKindLabels[kindValue]}
            </option>
          ))}
        </Select>
      </label>

      <label className="grid gap-2 text-sm text-[var(--foreground)]">
        Краткое описание
        <Textarea
          name="summary"
          rows={4}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="Коротко опишите направление для админки и витрины."
        />
      </label>

      <details className="rounded-[18px] border border-[color:var(--line)] bg-white/70 p-4">
        <summary className="cursor-pointer font-mono text-[11px] tracking-[0.16em] text-[var(--muted)] uppercase">
          Расширенные настройки
        </summary>

        <div className="mt-4 grid gap-4">
          <GeneratedSlugInput
            basePath="/catalog/"
            sourceValue={name}
            placeholder="wall-panels"
          />

          <label className="grid gap-2 text-sm text-[var(--foreground)]">
            Индикатор
            <Input
              name="indicator"
              value={indicator}
              onChange={(event) => setIndicator(event.target.value)}
              placeholder="МДФ панели"
            />
          </label>

          <label className="grid gap-2 text-sm text-[var(--foreground)]">
            Сценарий заказа
            <Input
              name="scenario"
              value={scenario}
              onChange={(event) => setScenario(event.target.value)}
              placeholder="Запрос цены и консультация"
            />
          </label>

          <label className="grid gap-2 text-sm text-[var(--foreground)]">
            Порядок
            <Input name="sortOrder" type="number" min="0" placeholder="Авто" />
          </label>
        </div>
      </details>

      <Button type="submit" variant="accent" className="w-full sm:w-auto">
        Добавить категорию
      </Button>
    </form>
  );
}
