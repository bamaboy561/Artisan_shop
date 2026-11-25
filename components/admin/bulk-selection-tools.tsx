"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type BulkSelectionToolsProps = {
  checkboxSelector: string;
};

function readCheckboxes(selector: string) {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>(selector),
  ).filter((element) => !element.disabled);
}

export function BulkSelectionTools({
  checkboxSelector,
}: BulkSelectionToolsProps) {
  const [selectedCount, setSelectedCount] = useState(0);
  const [availableCount, setAvailableCount] = useState(0);

  useEffect(() => {
    const syncState = () => {
      const checkboxes = readCheckboxes(checkboxSelector);

      // Каждая строка есть дважды: карточкой (телефон) и в таблице.
      setAvailableCount(new Set(checkboxes.map((item) => item.value)).size);
      setSelectedCount(
        new Set(
          checkboxes
            .filter((checkbox) => checkbox.checked)
            .map((item) => item.value),
        ).size,
      );
    };

    syncState();

    const checkboxes = readCheckboxes(checkboxSelector);
    for (const checkbox of checkboxes) {
      checkbox.addEventListener("change", syncState);
    }

    return () => {
      for (const checkbox of checkboxes) {
        checkbox.removeEventListener("change", syncState);
      }
    };
  }, [checkboxSelector]);

  const toggleCheckboxes = (checked: boolean) => {
    const checkboxes = readCheckboxes(checkboxSelector);

    for (const checkbox of checkboxes) {
      checkbox.checked = checked;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => toggleCheckboxes(true)}
        disabled={availableCount === 0}
        className="h-9 rounded-[var(--radius-control)] px-3 text-[13px]"
      >
        Выделить все
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => toggleCheckboxes(false)}
        disabled={selectedCount === 0}
        className="h-9 rounded-[var(--radius-control)] px-3 text-[13px]"
      >
        Снять выбор
      </Button>
      <span className="text-xs text-[var(--muted)]">
        Выбрано {selectedCount} из {availableCount}
      </span>
    </div>
  );
}
