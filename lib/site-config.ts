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
];

export const companyContacts = {
  phone: "",
  email: "info@artisan.kg",
  address: "Бишкек",
  hours: "Пн–Сб 09:00–18:00",
  whatsapp: "",
  telegram: "artisan_sales_bot",
};

export const companyBranches: Array<{
  name: string;
  address: string;
  hours: string;
}> = [
  {
    name: "Artisan",
    address: "Бишкек",
    hours: "Пн–Сб 09:00–18:00",
  },
];
