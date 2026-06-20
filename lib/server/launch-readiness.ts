import "server-only";

import { ProductStatus, RoleCode } from "@/generated/prisma";
import { hasDatabaseUrl, isDemoModeEnabled, getDb } from "@/lib/db";
import { getTelegramConfigurationStatus } from "@/lib/server/commercial-integrations";

export type LaunchCheckStatus = "ready" | "warning" | "blocked";

export type LaunchReadinessCheck = {
  key: string;
  title: string;
  description: string;
  status: LaunchCheckStatus;
  href?: string;
  actionLabel?: string;
  value?: string;
};

export type LaunchReadiness = {
  checks: LaunchReadinessCheck[];
  readyCount: number;
  warningCount: number;
  blockedCount: number;
  score: number;
};

function makeScore(checks: LaunchReadinessCheck[]) {
  if (checks.length === 0) {
    return 0;
  }

  const points = checks.reduce((sum, check) => {
    if (check.status === "ready") return sum + 1;
    if (check.status === "warning") return sum + 0.5;
    return sum;
  }, 0);

  return Math.round((points / checks.length) * 100);
}

export async function getLaunchReadiness(): Promise<LaunchReadiness> {
  const demoMode = isDemoModeEnabled();
  const databaseReady = hasDatabaseUrl();
  const checks: LaunchReadinessCheck[] = [
    {
      key: "database",
      title: "PostgreSQL подключен",
      description: databaseReady
        ? "Приложение работает с живой базой данных."
        : "Для запуска нужен DATABASE_URL и выключенный demo-режим.",
      status: databaseReady ? "ready" : "blocked",
      value: databaseReady ? "Готово" : "Нет подключения",
    },
    {
      key: "demo-mode",
      title: "Demo-режим выключен",
      description: demoMode
        ? "Для боевого запуска выключите ARTISAN_DEMO_MODE, иначе данные не будут считаться production-контуром."
        : "Сайт не использует demo-режим для операционной работы.",
      status: demoMode ? "blocked" : "ready",
      value: demoMode ? "Включен" : "Выключен",
    },
  ];

  if (!databaseReady) {
    const readyCount = checks.filter(
      (check) => check.status === "ready",
    ).length;
    const warningCount = checks.filter(
      (check) => check.status === "warning",
    ).length;
    const blockedCount = checks.filter(
      (check) => check.status === "blocked",
    ).length;

    return {
      checks,
      readyCount,
      warningCount,
      blockedCount,
      score: makeScore(checks),
    };
  }

  const db = getDb();
  const [
    adminUsers,
    categories,
    brands,
    activeProducts,
    calculatorMaterials,
    sheetFormats,
    deliveryMethods,
  ] = await Promise.all([
    db.user.count({
      where: {
        isActive: true,
        role: { code: { in: [RoleCode.ADMIN, RoleCode.SUPER_ADMIN] } },
      },
    }),
    db.category.count(),
    db.brand.count(),
    db.product.count({ where: { status: ProductStatus.ACTIVE } }),
    db.calculatorMaterial.count({ where: { isActive: true } }),
    db.calculatorSheetFormat.count({ where: { isActive: true } }),
    db.deliveryMethod.count({ where: { isActive: true } }),
  ]);
  const telegramStatus = getTelegramConfigurationStatus();
  const configuredTelegramThreads = Object.values(
    telegramStatus.threadsConfigured,
  ).filter(Boolean).length;

  checks.push(
    {
      key: "admin",
      title: "Есть администратор",
      description:
        adminUsers > 0
          ? "Команда может войти в админку и управлять сайтом."
          : "Создайте первого администратора через production bootstrap.",
      status: adminUsers > 0 ? "ready" : "blocked",
      href: "/admin/users",
      actionLabel: "Клиенты и роли",
      value: `${adminUsers}`,
    },
    {
      key: "catalog-structure",
      title: "Структура каталога создана",
      description:
        categories > 0 && brands > 0
          ? "Категории и бренды готовы для наполнения товарами."
          : "Добавьте реальные категории и бренды перед публикацией каталога.",
      status: categories > 0 && brands > 0 ? "ready" : "warning",
      href: categories === 0 ? "/admin/categories" : "/admin/brands",
      actionLabel: categories === 0 ? "Категории" : "Бренды",
      value: `${categories} кат. / ${brands} брендов`,
    },
    {
      key: "products",
      title: "Опубликованы товары",
      description:
        activeProducts > 0
          ? "Публичный каталог уже показывает реальные позиции."
          : "Каталог пуст. Это нормально для подготовки, но перед запуском нужны опубликованные товары.",
      status: activeProducts > 0 ? "ready" : "warning",
      href: "/admin/products",
      actionLabel: "Материалы",
      value: `${activeProducts}`,
    },
    {
      key: "calculator",
      title: "Калькулятор настроен",
      description:
        calculatorMaterials > 0 && sheetFormats > 0
          ? "Есть активные материалы, цены и форматы листов для расчета распила."
          : "Добавьте материалы и форматы листов, иначе расчет будет работать только на fallback-конфиге.",
      status: calculatorMaterials > 0 && sheetFormats > 0 ? "ready" : "warning",
      href: "/admin/calculator",
      actionLabel: "Калькулятор",
      value: `${calculatorMaterials} мат. / ${sheetFormats} форм.`,
    },
    {
      key: "delivery",
      title: "Доставка и выдача",
      description:
        deliveryMethods > 0
          ? "Есть активные варианты самовывоза или доставки."
          : "Добавьте хотя бы один вариант выдачи заказа.",
      status: deliveryMethods > 0 ? "ready" : "warning",
      value: `${deliveryMethods}`,
    },
    {
      key: "telegram",
      title: "Telegram-уведомления",
      description: telegramStatus.enabled
        ? configuredTelegramThreads >= 2
          ? "Новые заявки, распил и заказы могут уходить в отдельные темы Telegram."
          : "Бот включен, но отдельные темы для распила и заказов еще не заданы."
        : `Укажите ${telegramStatus.missingEnv.join(", ")} в Vercel Environment Variables.`,
      status:
        telegramStatus.enabled && configuredTelegramThreads >= 2
          ? "ready"
          : "warning",
      value: telegramStatus.enabled
        ? `Включено · тем: ${configuredTelegramThreads}/3`
        : "Не настроено",
    },
  );

  const readyCount = checks.filter((check) => check.status === "ready").length;
  const warningCount = checks.filter(
    (check) => check.status === "warning",
  ).length;
  const blockedCount = checks.filter(
    (check) => check.status === "blocked",
  ).length;

  return {
    checks,
    readyCount,
    warningCount,
    blockedCount,
    score: makeScore(checks),
  };
}
