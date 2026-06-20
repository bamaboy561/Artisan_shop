import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

import { PrismaClient, RoleCode } from "../generated/prisma";

if (process.env.ARTISAN_DEMO_MODE === "true") {
  throw new Error("Turn ARTISAN_DEMO_MODE off before production bootstrap.");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run production bootstrap.");
}

const adminEmail = process.env.ARTISAN_ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.ARTISAN_ADMIN_PASSWORD?.trim();

if (!adminEmail) {
  throw new Error("ARTISAN_ADMIN_EMAIL is required.");
}

if (!adminPassword || adminPassword.length < 8) {
  throw new Error("ARTISAN_ADMIN_PASSWORD must contain at least 8 characters.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL, { schema: "public" }),
});

const roles = [
  {
    code: RoleCode.CUSTOMER,
    name: "Клиент",
    description: "Покупатель с личным кабинетом, заказами и заявками.",
  },
  {
    code: RoleCode.DEALER,
    name: "Дилер",
    description: "Партнер с отдельными условиями и будущей B2B-логикой.",
  },
  {
    code: RoleCode.MANAGER,
    name: "Менеджер",
    description: "Обработка заявок, заказов, статусов и связи с клиентами.",
  },
  {
    code: RoleCode.ADMIN,
    name: "Администратор",
    description: "Управление каталогом, заказами, заявками и клиентами.",
  },
  {
    code: RoleCode.SUPER_ADMIN,
    name: "Супер-админ",
    description: "Полный доступ к рабочей платформе Artisan.",
  },
];

const baselineBrands = [
  {
    slug: "albero",
    name: "Albero",
    description:
      "Премиальные МДФ панели для выразительных фасадов, интерьерных акцентов и проектов с высоким требованием к поверхности.",
    country: "",
    website: null,
    logoUrl: "/brands/albero-logo.png",
  },
];

const calculatorMaterials = [
  {
    slug: "ldsp-10",
    label: "ЛДСП 10 мм",
    pricePerSqM: 540,
    cutRatePerMeter: 36,
    edgeRatePerMeter: 26,
    setupFee: 900,
    thicknessMm: 10,
    sortOrder: 8,
  },
  {
    slug: "ldsp-18",
    label: "ЛДСП 18 мм",
    pricePerSqM: 680,
    cutRatePerMeter: 40,
    edgeRatePerMeter: 30,
    setupFee: 980,
    thicknessMm: 18,
    sortOrder: 15,
  },
  {
    slug: "ldsp-16",
    label: "ЛДСП 16 мм",
    pricePerSqM: 610,
    cutRatePerMeter: 38,
    edgeRatePerMeter: 28,
    setupFee: 950,
    thicknessMm: 16,
    sortOrder: 10,
  },
  {
    slug: "mdf-10",
    label: "МДФ 10 мм",
    pricePerSqM: 620,
    cutRatePerMeter: 40,
    edgeRatePerMeter: 24,
    setupFee: 1000,
    thicknessMm: 10,
    sortOrder: 18,
  },
  {
    slug: "mdf-8",
    label: "МДФ 8 мм",
    pricePerSqM: 570,
    cutRatePerMeter: 39,
    edgeRatePerMeter: 20,
    setupFee: 980,
    thicknessMm: 8,
    sortOrder: 17,
  },
  {
    slug: "mdf-16",
    label: "МДФ 16 мм",
    pricePerSqM: 760,
    cutRatePerMeter: 42,
    edgeRatePerMeter: 34,
    setupFee: 1100,
    thicknessMm: 16,
    sortOrder: 20,
  },
  {
    slug: "mdf-agt-18",
    label: "МДФ AGT 18 мм",
    pricePerSqM: 1850,
    cutRatePerMeter: 52,
    edgeRatePerMeter: 0,
    setupFee: 1200,
    thicknessMm: 18,
    sortOrder: 30,
  },
  {
    slug: "countertop-38",
    label: "Столешница 38 мм",
    pricePerSqM: 2400,
    cutRatePerMeter: 70,
    edgeRatePerMeter: 0,
    setupFee: 1500,
    thicknessMm: 38,
    sortOrder: 40,
  },
  {
    slug: "countertop-40",
    label: "Столешница 40 мм",
    pricePerSqM: 2500,
    cutRatePerMeter: 72,
    edgeRatePerMeter: 0,
    setupFee: 1550,
    thicknessMm: 40,
    sortOrder: 42,
  },
  {
    slug: "hpl-3",
    label: "HPL panel 3 mm",
    pricePerSqM: 1850,
    cutRatePerMeter: 62,
    edgeRatePerMeter: 0,
    setupFee: 1250,
    thicknessMm: 3,
    sortOrder: 50,
  },
  {
    slug: "hpl-4",
    label: "HPL panel 4 mm",
    pricePerSqM: 2050,
    cutRatePerMeter: 66,
    edgeRatePerMeter: 0,
    setupFee: 1300,
    thicknessMm: 4,
    sortOrder: 52,
  },
  {
    slug: "hpl-6",
    label: "HPL panel 6 mm",
    pricePerSqM: 2400,
    cutRatePerMeter: 72,
    edgeRatePerMeter: 0,
    setupFee: 1450,
    thicknessMm: 6,
    sortOrder: 54,
  },
  {
    slug: "hpl-8",
    label: "HPL panel 8 mm",
    pricePerSqM: 2700,
    cutRatePerMeter: 76,
    edgeRatePerMeter: 0,
    setupFee: 1500,
    thicknessMm: 8,
    sortOrder: 56,
  },
  {
    slug: "hpl-10",
    label: "HPL panel 10 mm",
    pricePerSqM: 2950,
    cutRatePerMeter: 80,
    edgeRatePerMeter: 0,
    setupFee: 1550,
    thicknessMm: 10,
    sortOrder: 58,
  },
  {
    slug: "hpl-12",
    label: "HPL panel 12 mm",
    pricePerSqM: 3200,
    cutRatePerMeter: 85,
    edgeRatePerMeter: 0,
    setupFee: 1600,
    thicknessMm: 12,
    sortOrder: 60,
  },
];

const sheetFormats = [
  {
    slug: "2800x2070",
    label: "2800 × 2070 мм",
    widthMm: 2800,
    heightMm: 2070,
    sortOrder: 10,
  },
  {
    slug: "2750x1830",
    label: "2750 × 1830 мм",
    widthMm: 2750,
    heightMm: 1830,
    sortOrder: 20,
  },
  {
    slug: "2800x1220",
    label: "2800 × 1220 мм",
    widthMm: 2800,
    heightMm: 1220,
    sortOrder: 30,
  },
  {
    slug: "4100x600",
    label: "4100 × 600 мм",
    widthMm: 4100,
    heightMm: 600,
    sortOrder: 40,
  },
  {
    slug: "4100x1200",
    label: "4100 × 1200 мм",
    widthMm: 4100,
    heightMm: 1200,
    sortOrder: 50,
  },
  {
    slug: "4200x600",
    label: "4200 × 600 мм",
    widthMm: 4200,
    heightMm: 600,
    sortOrder: 55,
  },
  {
    slug: "4200x1200",
    label: "4200 × 1200 мм",
    widthMm: 4200,
    heightMm: 1200,
    sortOrder: 58,
  },
  {
    slug: "3050x1300",
    label: "3050 × 1300 мм",
    widthMm: 3050,
    heightMm: 1300,
    sortOrder: 60,
  },
  {
    slug: "3050x1320",
    label: "3050 x 1320 mm",
    widthMm: 3050,
    heightMm: 1320,
    sortOrder: 70,
  },
  {
    slug: "3660x1320",
    label: "3660 x 1320 mm",
    widthMm: 3660,
    heightMm: 1320,
    sortOrder: 80,
  },
  {
    slug: "4200x1320",
    label: "4200 x 1320 mm",
    widthMm: 4200,
    heightMm: 1320,
    sortOrder: 90,
  },
];

const deliveryMethods = [
  {
    code: "pickup",
    name: "Самовывоз",
    description: "Выдача заказа со склада Artisan.",
    price: 0,
  },
  {
    code: "manager-delivery",
    name: "Доставка по согласованию",
    description: "Менеджер уточнит адрес, сроки и стоимость доставки.",
    price: 0,
  },
];

async function bootstrapRoles() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        description: role.description,
      },
      create: role,
    });
  }
}

async function bootstrapAdmin() {
  const role = await prisma.role.findUniqueOrThrow({
    where: { code: RoleCode.SUPER_ADMIN },
  });
  const hashedPassword = await hash(adminPassword!, 10);

  await prisma.user.upsert({
    where: { email: adminEmail! },
    update: {
      hashedPassword,
      firstName: process.env.ARTISAN_ADMIN_FIRST_NAME?.trim() || "Artisan",
      lastName: process.env.ARTISAN_ADMIN_LAST_NAME?.trim() || "Admin",
      isActive: true,
      roleId: role.id,
    },
    create: {
      email: adminEmail!,
      hashedPassword,
      firstName: process.env.ARTISAN_ADMIN_FIRST_NAME?.trim() || "Artisan",
      lastName: process.env.ARTISAN_ADMIN_LAST_NAME?.trim() || "Admin",
      isActive: true,
      roleId: role.id,
    },
  });
}

async function bootstrapBrands() {
  for (const brand of baselineBrands) {
    await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: {
        name: brand.name,
        description: brand.description,
        country: brand.country,
        website: brand.website,
        logoUrl: brand.logoUrl,
      },
      create: brand,
    });
  }
}

async function bootstrapCalculator() {
  for (const material of calculatorMaterials) {
    await prisma.calculatorMaterial.upsert({
      where: { slug: material.slug },
      update: { ...material, isActive: true },
      create: { ...material, isActive: true },
    });
  }

  for (const sheet of sheetFormats) {
    await prisma.calculatorSheetFormat.upsert({
      where: { slug: sheet.slug },
      update: { ...sheet, isActive: true },
      create: { ...sheet, isActive: true },
    });
  }
}

async function bootstrapDelivery() {
  for (const method of deliveryMethods) {
    await prisma.deliveryMethod.upsert({
      where: { code: method.code },
      update: { ...method, isActive: true },
      create: { ...method, isActive: true },
    });
  }
}

async function main() {
  await bootstrapRoles();
  await bootstrapAdmin();
  await bootstrapBrands();
  await bootstrapCalculator();
  await bootstrapDelivery();

  console.log("Production bootstrap completed.");
  console.log(`Admin account: ${adminEmail}`);
}

main()
  .catch((error) => {
    console.error("Production bootstrap failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
