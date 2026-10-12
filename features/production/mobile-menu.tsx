"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Menu } from "lucide-react";
import styles from "./frame.module.css";

export function ProductionMobileMenu({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node))
        ref.current.open = false;
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, []);
  return (
    <details ref={ref} className={styles.menu}>
      <summary aria-label="Открыть меню производства">
        <Menu size={20} />
      </summary>
      <nav
        aria-label="Меню производства"
        onClick={(event) => {
          if ((event.target as Element).closest("a") && ref.current)
            ref.current.open = false;
        }}
      >
        {children}
      </nav>
    </details>
  );
}
