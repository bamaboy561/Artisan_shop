"use client";

import { inputClass } from "@/features/services/cabinet-builder-dialog";
import {
  DRAWER_SYSTEMS,
  DRAWER_SYSTEM_ORDER,
  HINGE_SYSTEMS,
  HINGE_SYSTEM_ORDER,
  LIFT_SYSTEMS,
  LIFT_SYSTEM_ORDER,
  SHELF_SUPPORTS,
  SHELF_SUPPORT_ORDER,
  type CabinetHardware,
} from "@/features/services/hardware-systems";

// Выбор систем фурнитуры: от направляющих зависят короба ящиков, от
// петель — сверловка чашки, от остальных — товары в списке.
export function HardwarePicker({
  value,
  onChange,
  drawers,
  hinges,
  shelves = true,
  lift = false,
}: {
  value: CabinetHardware | undefined;
  onChange: (next: CabinetHardware) => void;
  drawers: boolean;
  hinges: boolean;
  shelves?: boolean;
  lift?: boolean;
}) {
  const current = value ?? {};
  const set = (patch: Partial<CabinetHardware>) =>
    onChange({ ...current, ...patch });
  const drawer = DRAWER_SYSTEMS[current.drawers ?? "ball"];
  const hinge = HINGE_SYSTEMS[current.hinges ?? "standard"];
  const liftSystem = LIFT_SYSTEMS[current.lift ?? "any"];

  return (
    <>
      {drawers ? (
        <label className="grid gap-1 text-[12px] text-[var(--muted)]">
          Направляющие ящиков
          <select
            className={inputClass}
            value={drawer.id}
            onChange={(event) =>
              set({ drawers: event.target.value as typeof drawer.id })
            }
          >
            {DRAWER_SYSTEM_ORDER.map((id) => (
              <option key={id} value={id}>
                {DRAWER_SYSTEMS[id].label}
              </option>
            ))}
          </select>
          <span className="text-[11px] leading-4">{drawer.hint}</span>
        </label>
      ) : null}
      {hinges ? (
        <label className="grid gap-1 text-[12px] text-[var(--muted)]">
          Петли
          <select
            className={inputClass}
            value={hinge.id}
            onChange={(event) =>
              set({ hinges: event.target.value as typeof hinge.id })
            }
          >
            {HINGE_SYSTEM_ORDER.map((id) => (
              <option key={id} value={id}>
                {HINGE_SYSTEMS[id].label}
              </option>
            ))}
          </select>
          <span className="text-[11px] leading-4">{hinge.hint}</span>
        </label>
      ) : null}
      {shelves ? (
        <label className="grid gap-1 text-[12px] text-[var(--muted)]">
          Полкодержатели
          <select
            className={inputClass}
            value={current.shelves ?? "pin"}
            onChange={(event) =>
              set({
                shelves: event.target.value as CabinetHardware["shelves"],
              })
            }
          >
            {SHELF_SUPPORT_ORDER.map((id) => (
              <option key={id} value={id}>
                {SHELF_SUPPORTS[id].label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {lift ? (
        <label className="grid gap-1 text-[12px] text-[var(--muted)]">
          Подъёмный механизм
          <select
            className={inputClass}
            value={current.lift ?? "any"}
            onChange={(event) =>
              set({ lift: event.target.value as CabinetHardware["lift"] })
            }
          >
            {LIFT_SYSTEM_ORDER.map((id) => (
              <option key={id} value={id}>
                {LIFT_SYSTEMS[id].label}
              </option>
            ))}
          </select>
          <span className="text-[11px] leading-4">{liftSystem.hint}</span>
        </label>
      ) : null}
    </>
  );
}

// Коротко для заголовка шага: бренды выбранных систем.
export function hardwareSummary(value: CabinetHardware | undefined) {
  const brands = [
    DRAWER_SYSTEMS[value?.drawers ?? "ball"].brand,
    HINGE_SYSTEMS[value?.hinges ?? "standard"].brand,
  ].filter(Boolean);
  return [...new Set(brands)].join(", ");
}
