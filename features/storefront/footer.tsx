import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { companyContacts } from "@/lib/site-config";
import s from "./storefront.module.css";

export function StorefrontFooter() {
  return (
    <footer className={s.footer}>
      <div className={s.container}>
        <div>
          <Link href="/" className={s.wordmark}>
            ARTISAN
          </Link>
          <p>Материалы. Фурнитура. Возможности.</p>
          <div className={s.footerLinks}>
            <Link href="/about">О компании</Link>
            <Link href="/contacts">Контакты</Link>
            <Link href="/privacy">Конфиденциальность</Link>
          </div>
        </div>
        <div>
          <p>
            <MapPin size={16} />
            {companyContacts.address}
          </p>
          <a href={`tel:${companyContacts.phoneTel}`}>
            {companyContacts.phone}
          </a>
          <p>{companyContacts.hours}</p>
        </div>
        <a
          href={companyContacts.whatsapp}
          target="_blank"
          rel="noreferrer"
          className={s.textLink}
        >
          Написать в WhatsApp <ArrowUpRight size={18} />
        </a>
      </div>
    </footer>
  );
}
