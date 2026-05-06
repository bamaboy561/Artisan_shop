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
    label: "Дашборд",
    description: "Очереди и показатели.",
  },
  {
    href: "/admin/categories",
    label: "Категории",
    description: "Структура каталога.",
  },
  {
    href: "/admin/brands",
    label: "Бренды",
    description: "Поставщики и коллекции.",
  },
  {
    href: "/admin/products",
    label: "Товары",
    description: "Карточки и публикация.",
  },
  {
    href: "/admin/users",
    label: "Клиенты",
    description: "Уровни, скидки и баллы.",
  },
  {
    href: "/admin/orders",
    label: "Заказы",
    description: "Производство и выдача.",
  },
  {
    href: "/admin/requests",
    label: "Заявки",
    description: "Расчёт и входящий поток.",
  },
  {
    href: "/admin/promotions",
    label: "Акции",
    description: "Промо и механики.",
  },
];

// TODO: Обновите контактные данные реальными значениями.
export const companyContacts = {
  phone: "+996 555 000-000",
  email: "info@artisan.kg",
  address: "г. Бишкек, ул. Примерная 1",
  hours: "Пн–Сб 09:00–18:00",
  whatsapp: "+996555000000",
  telegram: "artisan_kg",
};

// TODO: Обновите филиалы реальными данными.
export const companyBranches: Array<{
  name: string;
  address: string;
  hours: string;
}> = [
  {
    name: "Шоурум Artisan",
    address: "г. Бишкек, ул. Примерная 1",
    hours: "Пн–Сб 09:00–18:00",
  },
];
