"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { DashboardNav } from "@/components/layout/dashboard-nav";
import type { NavItem } from "@/types/navigation";

type SidebarContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error("Sidebar trigger must be used inside AdminSidebarProvider");
  }
  return ctx;
}

export function AdminSidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  // Lock body scroll when drawer is open.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  return (
    <SidebarContext.Provider value={{ open, setOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

type AdminSidebarPanelProps = {
  items: NavItem[];
  actions?: ReactNode;
};

export function AdminSidebarPanel({ items, actions }: AdminSidebarPanelProps) {
  const { open, setOpen } = useSidebar();

  return (
    <>
      <div
        role="presentation"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/45 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[88vw] flex-col overflow-hidden bg-[#111210] text-white shadow-[0_30px_80px_rgba(0,0,0,0.45)] transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:w-full lg:max-w-none lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_8%,rgba(197,89,53,0.22),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0))]" />

        <div className="relative flex h-full flex-col px-4 py-4 lg:py-5">
          <div className="flex items-center justify-between gap-3">
            <Link href="/admin" className="flex items-center gap-3 px-1">
              <span className="flex size-12 items-center justify-center rounded-xl bg-white text-[22px] font-black text-[#151513] shadow-[0_10px_30px_rgba(255,255,255,0.08)]">
                A
              </span>
              <span>
                <span className="block text-xl leading-none font-semibold">
                  Artisan
                </span>
                <span className="mt-1 block text-xs text-white/62">
                  Панель управления
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex size-9 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Закрыть меню"
            >
              <X className="size-5" strokeWidth={1.75} />
            </button>
          </div>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 lg:mt-8">
            <DashboardNav
              items={items}
              variant="admin"
              onItemClick={() => setOpen(false)}
            />
          </div>

          {actions ? (
            <div className="mt-4 border-t border-white/8 pt-4 lg:mt-6 lg:pt-5">
              {actions}
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}

export function AdminSidebarTrigger() {
  const { open, setOpen } = useSidebar();
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#e6e2dc] bg-white text-[#2b2a28] shadow-sm transition hover:border-[#cfc9bf] lg:hidden"
      aria-label="Открыть меню навигации"
      aria-expanded={open}
    >
      <Menu className="size-5" strokeWidth={1.75} />
    </button>
  );
}
