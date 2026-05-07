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

const calculatorMaterials = [
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
    slug: "mdf-16",
    label: "МДФ 16 мм",
    pricePerSqM: 760,
    cutRatePerMeter: 42,
    edgeRatePerMeter: 34,
    setupFee: 1100,
    thicknessMm: 16,
    sortOrder: 20,
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
