"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  itemMarkLabels,
  shiftRoleLabels,
  type ItemMark,
  type ShiftItem,
  type ShiftRole,
} from "./shift";
import styles from "./shift.module.css";

const marks: ItemMark[] = ["done", "deviation", "na"];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.primary} disabled={pending}>
      {pending ? "Сохраняю…" : label}
    </button>
  );
}

// Чек-лист смены: по каждому пункту «Выполнено / Отклонение / Неприменимо».
// Отклонение и «неприменимо» требуют пояснения.
export function ShiftChecklistForm({
  action,
  itemsByRole,
  roles,
  defaultRole,
  submitLabel,
  encType,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  itemsByRole: Partial<Record<ShiftRole, ShiftItem[]>>;
  roles: ShiftRole[];
  defaultRole: ShiftRole;
  submitLabel: string;
  encType?: "multipart/form-data";
  children?: ReactNode;
}) {
  const [role, setRole] = useState<ShiftRole>(defaultRole);
  const [values, setValues] = useState<Record<string, ItemMark>>({});
  const items = itemsByRole[role] ?? [];
  const left = items.filter((item) => !values[item.key]).length;
  return (
    <form action={action} className={styles.form} encType={encType}>
      {roles.length > 1 ? (
        <fieldset className={styles.roles}>
          <legend>Кем вы сегодня работаете</legend>
          {roles.map((option) => (
            <label key={option}>
              <input
                type="radio"
                name="role"
                value={option}
                checked={role === option}
                onChange={() => setRole(option)}
              />
              {shiftRoleLabels[option]}
            </label>
          ))}
        </fieldset>
      ) : (
        <input type="hidden" name="role" value={role} />
      )}
      <ol className={styles.items}>
        {items.map((item) => {
          const mark = values[item.key];
          return (
            <li key={item.key} data-mark={mark}>
              <p className={styles.itemLabel}>{item.label}</p>
              {item.hint ? <p className={styles.hint}>{item.hint}</p> : null}
              <div className={styles.marks} role="radiogroup">
                {marks.map((option) => (
                  <label key={option} data-option={option}>
                    <input
                      type="radio"
                      name={`mark_${item.key}`}
                      value={option}
                      required
                      checked={mark === option}
                      onChange={() =>
                        setValues((current) => ({
                          ...current,
                          [item.key]: option,
                        }))
                      }
                    />
                    {itemMarkLabels[option]}
                  </label>
                ))}
              </div>
              {mark && mark !== "done" ? (
                <input
                  className={styles.input}
                  name={`note_${item.key}`}
                  required
                  maxLength={500}
                  placeholder={
                    mark === "na"
                      ? "Почему неприменимо"
                      : "Что не так и что сделали"
                  }
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      {children}
      <div className={styles.submitRow}>
        <SubmitButton label={submitLabel} />
        {left ? (
          <span className={styles.hint}>Осталось отметить: {left}</span>
        ) : null}
      </div>
    </form>
  );
}
