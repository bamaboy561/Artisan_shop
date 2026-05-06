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
    description:
      "Уровень клиента, персональная скидка, бонусные баллы и ключевая активность",
  },
  { href: "/account/orders", label: "Заказы" },
  { href: "/account/requests", label: "Заявки" },
  { href: "/account/favorites", label: "Избранное" },
];

export const adminNavigation: NavItem[] = [
  {
    href: "/admin",
    label: "Дашборд",
    description:
      "Показатели, очередь заявок и быстрый доступ к основным модулям",
  },
  {
    href: "/admin/categories",
    label: "Категории",
    description: "Структура каталога и логика товарных групп",
  },
  {
    href: "/admin/brands",
    label: "Бренды",
    description: "Поставщики, коллекции и описание брендов",
  },
  {
    href: "/admin/products",
    label: "Товары",
    description: "Карточки, цены, режимы заказа и публикация",
  },
  {
    href: "/admin/users",
    label: "Клиенты",
    description: "Уровни, личные скидки, баллы и персональные условия",
  },
  { href: "/admin/orders", label: "Заказы" },
  { href: "/admin/requests", label: "Заявки" },
  {
    href: "/admin/promotions",
    label: "Акции",
    description: "Скидки, промокоды и коммерческие кампании",
  },
];

// TODO: Обновите контактные данные реальными значениями
export const companyContacts = {
  phone: "+996 555 000-000",
  email: "info@artisan.kg",
  address: "г. Бишкек, ул. Примерная 1",
  hours: "Пн–Сб 09:00–18:00",
  whatsapp: "+996555000000",
  telegram: "artisan_kg",
};

// TODO: Обновите филиалы реальными данными
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
