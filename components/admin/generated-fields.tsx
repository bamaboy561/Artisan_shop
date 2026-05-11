"use client";

import { useState, type ReactNode } from "react";

import { Input } from "@/components/ui/input";

const cyrillicMap: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

export function slugifyAdminValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split("")
    .map((char) => cyrillicMap[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildSku(value: string) {
  const base = slugifyAdminValue(value).replace(/-/g, "").toUpperCase();
  return base.slice(0, 18) || "ARTISAN";
}

type GeneratedSlugInputProps = {
  basePath: string;
  defaultValue?: string | null;
  help?: string;
  label?: string;
  name?: string;
  placeholder?: string;
  required?: boolean;
  sourceValue: string;
};

export function GeneratedSlugInput({
  basePath,
  defaultValue,
  help,
  label = "Адрес страницы",
  name = "slug",
  placeholder = "auto-generated",
  required = false,
  sourceValue,
}: GeneratedSlugInputProps) {
  const [manualValue, setManualValue] = useState(defaultValue ?? "");
  const [isManual, setIsManual] = useState(Boolean(defaultValue));
  const autoValue = slugifyAdminValue(sourceValue);
  const value = isManual ? manualValue : autoValue;

  return (
    <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
      <span className="flex items-center justify-between gap-3">
        {label}
        <button
          type="button"
          onClick={() => {
            setIsManual(false);
            setManualValue("");
          }}
          className="font-mono text-[10px] tracking-[0.16em] text-[var(--accent)] uppercase"
        >
          Авто
        </button>
      </span>
      <Input
        name={name}
        placeholder={placeholder}
        value={value}
        required={required}
        onChange={(event) => {
          setIsManual(true);
          setManualValue(slugifyAdminValue(event.target.value));
        }}
      />
      <span className="text-xs leading-5 text-[var(--muted)]">
        {value ? `${basePath}${value}` : "Заполнится автоматически после названия."}
        {help ? ` ${help}` : ""}
      </span>
    </label>
  );
}

type GeneratedSkuInputProps = {
  defaultValue?: string | null;
  label?: string;
  name?: string;
  required?: boolean;
  sourceValue: string;
};

export function GeneratedSkuInput({
  defaultValue,
  label = "Артикул / SKU",
  name = "sku",
  required = false,
  sourceValue,
}: GeneratedSkuInputProps) {
  const [manualValue, setManualValue] = useState(defaultValue ?? "");
  const [isManual, setIsManual] = useState(Boolean(defaultValue));
  const autoValue = buildSku(sourceValue);
  const value = isManual ? manualValue : autoValue;

  return (
    <label className="grid min-w-0 gap-2 text-sm text-[var(--foreground)]">
      <span className="flex items-center justify-between gap-3">
        {label}
        <button
          type="button"
          onClick={() => {
            setIsManual(false);
            setManualValue("");
          }}
          className="font-mono text-[10px] tracking-[0.16em] text-[var(--accent)] uppercase"
        >
          Авто
        </button>
      </span>
      <Input
        name={name}
        placeholder="Создастся автоматически"
        value={value}
        required={required}
        onChange={(event) => {
          setIsManual(true);
          setManualValue(event.target.value.trim().toUpperCase());
        }}
      />
      <span className="text-xs leading-5 text-[var(--muted)]">
        Можно оставить авто или вписать артикул поставщика.
      </span>
    </label>
  );
}

export function ManagerHelpCard({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-[#eadfd4] bg-[#fbf6ef] p-4 text-sm leading-6 text-[var(--muted)]">
      <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--accent)] uppercase">
        {title}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}
