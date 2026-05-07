import type { NavItem } from "@/types/navigation";

export const companyName = "Artisan";

export const siteDescription =
  "Artisan — материалы, распил и проектные заявки в одной системе.";

export const primaryNavigation: NavItem[] = [
  { href: "/catalog", label: "Каталог" },
  { href: "/calculator", label: "Калькулятор" },
  { href: "/services", label: "Услуги" },
  { href: "/brands", label: "Бренды" },
  { href: "/about", label: "О компании" },
  { href: "/contacts", label: "Контакты" },
];

export const accountNavigation: NavItem[] = [
  {
    href: "/account",
    label: "Обзор",
    description: "Уровень, скидка и основная активность клиента.",
  },
  {
    href: "/account/orders",
    label: "Заказы",
    description: "Производство, готовность и выдача.",
  },
  {
    href: "/account/requests",
    label: "Заявки",
    description: "Расчёт, консультации и распил.",
  },
  {
    href: "/account/favorites",
    label: "Избранное",
    description: "Сохранённые товары и подборки.",
  },
];

export const adminNavigation: NavItem[] = [
  {
    href: "/admin",
    label: "Главная",
    description: "Очереди и показатели.",
  },
  {
    href: "/admin/launch",
    label: "Запуск",
    description: "Готовность production-контура.",
  },
  {
    href: "/admin/orders",
    label: "Заказы",
    description: "Производство и выдача.",
  },
  {
    href: "/admin/requests",
    label: "Запросы на расчёт",
    description: "Расчёт и входящий поток.",
  },
  {
    href: "/admin/cutting",
    label: "Распил",
    description: "Очередь, файлы, карта и ведомость.",
  },
  {
    href: "/admin/categories",
    label: "Каталог",
    description: "Структура каталога.",
  },
  {
    href: "/admin/products",
    label: "Материалы",
    description: "Карточки и публикация.",
  },
  {
    href: "/admin/brands",
    label: "Бренды",
    description: "Поставщики и коллекции.",
  },
  {
    href: "/admin/users",
    label: "Клиенты",
    description: "Уровни, скидки и баллы.",
  },
  {
    href: "/admin/promotions",
    label: "Акции",
    description: "Промо и механики.",
  },
  {
    href: "/admin/calculator",
    label: "Калькулятор",
    description: "Материалы, цены и форматы листов.",
  },
];

export const companyContacts = {
  phone: "+996 552 788 188",
  phoneTel: "+996552788188",
  email: "info@artisan.kg",
  address: "г. Бишкек, ул. Кулатова 3/1",
  hours: "Пн–Пт 09:00–17:00",
  whatsapp: "https://wa.me/996552788188",
  telegram: "",
};

export type CompanyBranchSchedule = {
  // Days are 0–6 starting Sunday (matches Date.getDay()).
  days: number[];
  open: number; // hour (0–23, local Bishkek time)
  close: number; // hour (0–23, local Bishkek time)
};

export type CompanyBranch = {
  slug: string;
  name: string;
  address: string;
  hours: string;
  mapUrl: string;
  schedule: CompanyBranchSchedule[];
  services: string[];
};

const WEEKDAYS = [1, 2, 3, 4, 5];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export const companyBranches: CompanyBranch[] = [
  {
    slug: "main",
    name: "Главный филиал",
    address: "г. Бишкек, ул. Кулатова 3/1",
    hours: "Пн–Пт 09:00–17:00",
    mapUrl:
      "https://2gis.kg/bishkek/search/%D0%9A%D1%83%D0%BB%D0%B0%D1%82%D0%BE%D0%B2%D0%B0%203%2F1",
    schedule: [{ days: WEEKDAYS, open: 9, close: 17 }],
    services: ["Консультация", "Образцы", "Самовывоз"],
  },
  {
    slug: "stroypark",
    name: "Стройпарк",
    address: "г. Бишкек, ул. Кулатова 2",
    hours: "Ежедневно 09:00–18:00",
    mapUrl:
      "https://2gis.kg/bishkek/search/%D0%9A%D1%83%D0%BB%D0%B0%D1%82%D0%BE%D0%B2%D0%B0%202",
    schedule: [{ days: ALL_DAYS, open: 9, close: 18 }],
    services: ["Подбор декоров", "Образцы", "Розничный отпуск"],
  },
  {
    slug: "monolit",
    name: "Монолит",
    address: "г. Бишкек, ул. Льва Толстого 36к",
    hours: "Ежедневно 09:00–18:00",
    mapUrl:
      "https://2gis.kg/bishkek/search/%D0%9B%D1%8C%D0%B2%D0%B0%20%D0%A2%D0%BE%D0%BB%D1%81%D1%82%D0%BE%D0%B3%D0%BE%2036%D0%BA",
    schedule: [{ days: ALL_DAYS, open: 9, close: 18 }],
    services: ["Самовывоз", "Кромка", "Расходники"],
  },
];
