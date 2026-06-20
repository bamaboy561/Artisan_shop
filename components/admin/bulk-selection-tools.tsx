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

      setAvailableCount(checkboxes.length);
      setSelectedCount(
        checkboxes.filter((checkbox) => checkbox.checked).length,
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
        className="rounded-full px-3 text-[10px] tracking-[0.12em]"
      >
        Выделить все
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => toggleCheckboxes(false)}
        disabled={selectedCount === 0}
        className="rounded-full px-3 text-[10px] tracking-[0.12em]"
      >
        Снять выбор
      </Button>
      <span className="text-xs text-[var(--muted)]">
        Выбрано {selectedCount} из {availableCount}
      </span>
    </div>
  );
}
