import type { ReactNode } from "react";
import Link from "next/link";
import { Home, LogOut } from "lucide-react";
import { ProductionMobileMenu } from "./mobile-menu";
import { signOutAction } from "@/app/auth/actions";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import type { NavItem } from "@/types/navigation";
import styles from "./frame.module.css";

export function ProductionFrame({
  title,
  name,
  role,
  items,
  children,
}: {
  title: string;
  name: string;
  role: string;
  items: NavItem[];
  children: ReactNode;
}) {
  const account = (
    <div className={styles.account}>
      <strong>{name}</strong>
      <span>{role}</span>
      <form action={signOutAction}>
        <button type="submit">
          <LogOut size={16} /> Выйти
        </button>
      </form>
    </div>
  );
  return (
    <div className={styles.frame}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/admin/production">
          Artisan<span>Производство</span>
        </Link>
        <DashboardNav items={items} variant="admin" />
        <Link className={styles.home} href="/">
          <Home size={17} />
          На сайт
        </Link>
        {account}
      </aside>
      <div className={styles.main}>
        <header className={styles.header}>
          <Link href="/admin/production" className={styles.mobileBrand}>
            Artisan
          </Link>
          <span className={styles.title}>{title}</span>
          <Link
            className={styles.homeIcon}
            href="/"
            aria-label="На сайт"
            title="На сайт"
          >
            <Home size={18} />
          </Link>
          <ProductionMobileMenu>
            <DashboardNav items={items} variant="admin" />
            {account}
          </ProductionMobileMenu>
        </header>
        <main id="main-content" className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
