import {
  BannerPlacement,
  DiscountType,
  InventoryStatus,
  LoyaltyTier,
  LoyaltyTransactionType,
  MessengerType,
  OrderStatus,
  PageStatus,
  ProductOrderMode,
  ProductStatus,
  PromotionStatus,
  PromotionTargetType,
  PrismaClient,
  RequestStatus,
  RequestType,
  RoleCode,
} from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run prisma seed.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL, { schema: "public" }),
});

const roles = [
  {
    code: RoleCode.CUSTOMER,
    name: "Клиент",
    description: "Покупатель с доступом к личному кабинету и истории заказов.",
  },
  {
    code: RoleCode.DEALER,
    name: "Дилер",
    description:
      "Партнер с перспективой оптовых условий и отдельной ценовой логики.",
  },
  {
    code: RoleCode.MANAGER,
    name: "Менеджер",
    description:
      "Оператор, который обрабатывает заявки, заказы и комментарии клиентов.",
  },
  {
    code: RoleCode.ADMIN,
    name: "Администратор",
    description:
      "Сотрудник с доступом к каталогу, заказам, заявкам и контенту сайта.",
  },
  {
    code: RoleCode.SUPER_ADMIN,
    name: "Супер-админ",
    description: "Полный доступ ко всем разделам и системным настройкам.",
  },
];

const categories = [
  {
    slug: "ldsp",
    name: "ЛДСП",
    summary:
      "Плитные материалы для корпусной мебели с устойчивой геометрией и востребованными декорами.",
    indicator: "Swiss Krono",
    scenario: "Запрос цены и наличия",
    coverImage:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80",
    spotlight:
      "Базовый слой для кухни, гардероба и коммерческой мебели с быстрым подбором декора.",
    isFeatured: true,
    sortOrder: 10,
  },
  {
    slug: "mdf",
    name: "МДФ и панели",
    summary:
      "Фасадные и декоративные решения для жилых и коммерческих интерьеров с акцентом на фактуру.",
    indicator: "AGT",
    scenario: "Запрос спецификации",
    coverImage:
      "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1400&q=80",
    spotlight:
      "Материалы для сложных фасадов, акцентных плоскостей и более выразительной подачи проекта.",
    sortOrder: 20,
  },
  {
    slug: "edge",
    name: "Кромка",
    summary:
      "Совместимые толщины и точное совпадение цвета с плитными коллекциями под чистую сборку.",
    indicator: "0.4 / 1 / 2 мм",
    scenario: "Добавить к материалам",
    coverImage:
      "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1400&q=80",
    spotlight:
      "Точная комплектация под раскрой и финальную сборку без пересортицы.",
    sortOrder: 30,
  },
  {
    slug: "fittings",
    name: "Фурнитура",
    summary:
      "Петли, направляющие и механизмы для повседневной эксплуатации и проектной мебели.",
    indicator: "Hettich · Samet",
    scenario: "Покупка онлайн",
    coverImage:
      "https://images.unsplash.com/photo-1582582429416-47f57f66a8cf?auto=format&fit=crop&w=1400&q=80",
    spotlight:
      "Функциональные механизмы для кухни, гардероба и систем хранения.",
    sortOrder: 40,
  },
  {
    slug: "storage",
    name: "Организация пространства",
    summary:
      "Системы хранения и внутреннее наполнение шкафов для аккуратной организации пространства.",
    indicator: "Nuomi",
    scenario: "Покупка и повтор заказа",
    coverImage:
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1400&q=80",
    spotlight: "Наполнение, которое усиливает ценность готового проекта.",
    sortOrder: 50,
  },
  {
    slug: "worktops",
    name: "Столешницы",
    summary:
      "Коллекции для кухонь и рабочих зон с разными сценариями нагрузки и визуальным характером.",
    indicator: "Slotex",
    scenario: "Консультация и расчет",
    coverImage:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1400&q=80",
    spotlight:
      "Износостойкие поверхности для бытовых и коммерческих интерьеров.",
    sortOrder: 60,
  },
  {
    slug: "wall-panels",
    name: "Стеновые панели",
    summary:
      "Декоративные решения для интерьерных акцентов, мебельных объемов и выразительных фасадов.",
    indicator: "Extravert",
    scenario: "Запрос образцов",
    coverImage:
      "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1400&q=80",
    spotlight: "Материал для вау-подачи пространства и тактильной глубины.",
    sortOrder: 70,
  },
  {
    slug: "services",
    name: "Услуги распила",
    summary:
      "Распил по картам, кромление и сопутствующие операции с загрузкой файлов и быстрым запуском в работу.",
    indicator: "Онлайн-калькулятор",
    scenario: "Сложная заявка",
    coverImage:
      "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1400&q=80",
    spotlight: "От чертежа к готовому комплекту без лишних согласований.",
    sortOrder: 80,
  },
];

const brands = [
  {
    slug: "swiss-krono",
    name: "Swiss Krono",
    description:
      "Плитные материалы и декоры для корпусной мебели, кухонь и коммерческих интерьеров.",
    country: "Швейцария / Польша",
    website: "https://www.swisskrono.com",
  },
  {
    slug: "hettich",
    name: "Hettich",
    description:
      "Немецкие механизмы и системы фурнитуры для мебели с высоким ресурсом работы.",
    country: "Германия",
    website: "https://www.hettich.com",
  },
  {
    slug: "nuomi",
    name: "Nuomi",
    description:
      "Системы хранения, аксессуары и наполнение шкафов для современных интерьеров.",
    country: "Китай",
  },
  {
    slug: "slotex",
    name: "Slotex",
    description:
      "Столешницы и декоративные поверхности для бытовых и коммерческих пространств.",
    country: "Россия",
    website: "https://slotex.ru",
  },
];

const deliveryMethods = [
  {
    code: "pickup",
    name: "Самовывоз",
    description: "Получение заказа на складе Artisan в согласованный слот.",
    price: 0,
  },
  {
    code: "city-delivery",
    name: "Доставка по городу",
    description: "Доставка до адреса клиента по городу и ближайшим районам.",
    price: 1500,
  },
  {
    code: "transport-company",
    name: "Транспортная компания",
    description: "Отгрузка через выбранную логистическую службу клиента.",
    price: 0,
  },
];

async function seedRoles() {
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

async function seedUsers() {
  const defaultPasswordHash = await hash("Artisan123!", 10);
  const superAdminRole = await prisma.role.findUniqueOrThrow({
    where: { code: RoleCode.SUPER_ADMIN },
  });
  const customerRole = await prisma.role.findUniqueOrThrow({
    where: { code: RoleCode.CUSTOMER },
  });
  const dealerRole = await prisma.role.findUniqueOrThrow({
    where: { code: RoleCode.DEALER },
  });
  const managerRole = await prisma.role.findUniqueOrThrow({
    where: { code: RoleCode.MANAGER },
  });

  await prisma.user.upsert({
    where: { email: "admin@artisan.local" },
    update: {
      firstName: "Artisan",
      lastName: "Admin",
      roleId: superAdminRole.id,
      phone: "+7 900 000-00-01",
      companyName: "Artisan",
      messengerType: MessengerType.TELEGRAM,
      messengerHandle: "@artisan_admin",
    },
    create: {
      email: "admin@artisan.local",
      firstName: "Artisan",
      lastName: "Admin",
      roleId: superAdminRole.id,
      phone: "+7 900 000-00-01",
      companyName: "Artisan",
      messengerType: MessengerType.TELEGRAM,
      messengerHandle: "@artisan_admin",
    },
  });

  await prisma.user.upsert({
    where: { email: "client@artisan.local" },
    update: {
      firstName: "Ирина",
      lastName: "Кузнецова",
      roleId: customerRole.id,
      phone: "+7 900 000-00-02",
      companyName: "Studio Form",
      messengerType: MessengerType.WHATSAPP,
      messengerHandle: "+79000000002",
      loyaltyTier: LoyaltyTier.GOLD,
      loyaltyPointsBalance: 1860,
      loyaltyPointsLifetime: 6840,
      personalDiscountPercent: 2,
    },
    create: {
      email: "client@artisan.local",
      firstName: "Ирина",
      lastName: "Кузнецова",
      roleId: customerRole.id,
      phone: "+7 900 000-00-02",
      companyName: "Studio Form",
      messengerType: MessengerType.WHATSAPP,
      messengerHandle: "+79000000002",
      loyaltyTier: LoyaltyTier.GOLD,
      loyaltyPointsBalance: 1860,
      loyaltyPointsLifetime: 6840,
      personalDiscountPercent: 2,
    },
  });

  await prisma.user.upsert({
    where: { email: "dealer@artisan.local" },
    update: {
      firstName: "Олег",
      lastName: "Сафин",
      roleId: dealerRole.id,
      phone: "+7 900 000-00-04",
      companyName: "Prime Interior",
      messengerType: MessengerType.TELEGRAM,
      messengerHandle: "@prime_interior",
      loyaltyTier: LoyaltyTier.PLATINUM,
      loyaltyPointsBalance: 9420,
      loyaltyPointsLifetime: 18400,
      personalDiscountPercent: 4,
    },
    create: {
      email: "dealer@artisan.local",
      firstName: "Олег",
      lastName: "Сафин",
      roleId: dealerRole.id,
      phone: "+7 900 000-00-04",
      companyName: "Prime Interior",
      messengerType: MessengerType.TELEGRAM,
      messengerHandle: "@prime_interior",
      loyaltyTier: LoyaltyTier.PLATINUM,
      loyaltyPointsBalance: 9420,
      loyaltyPointsLifetime: 18400,
      personalDiscountPercent: 4,
    },
  });

  await prisma.user.upsert({
    where: { email: "silver@artisan.local" },
    update: {
      firstName: "Мария",
      lastName: "Егорова",
      roleId: customerRole.id,
      phone: "+7 900 000-00-05",
      companyName: "Forma Lab",
      messengerType: MessengerType.WHATSAPP,
      messengerHandle: "+79000000005",
      loyaltyTier: LoyaltyTier.SILVER,
      loyaltyPointsBalance: 540,
      loyaltyPointsLifetime: 2140,
      personalDiscountPercent: 1,
    },
    create: {
      email: "silver@artisan.local",
      firstName: "Мария",
      lastName: "Егорова",
      roleId: customerRole.id,
      phone: "+7 900 000-00-05",
      companyName: "Forma Lab",
      messengerType: MessengerType.WHATSAPP,
      messengerHandle: "+79000000005",
      loyaltyTier: LoyaltyTier.SILVER,
      loyaltyPointsBalance: 540,
      loyaltyPointsLifetime: 2140,
      personalDiscountPercent: 1,
    },
  });

  await prisma.user.upsert({
    where: { email: "bronze@artisan.local" },
    update: {
      firstName: "Анна",
      lastName: "Лебедева",
      roleId: customerRole.id,
      phone: "+7 900 000-00-06",
      companyName: "Home Start",
      messengerType: MessengerType.PHONE,
      loyaltyTier: LoyaltyTier.BRONZE,
      loyaltyPointsBalance: 120,
      loyaltyPointsLifetime: 420,
      personalDiscountPercent: 0,
    },
    create: {
      email: "bronze@artisan.local",
      firstName: "Анна",
      lastName: "Лебедева",
      roleId: customerRole.id,
      phone: "+7 900 000-00-06",
      companyName: "Home Start",
      messengerType: MessengerType.PHONE,
      loyaltyTier: LoyaltyTier.BRONZE,
      loyaltyPointsBalance: 120,
      loyaltyPointsLifetime: 420,
      personalDiscountPercent: 0,
    },
  });

  await prisma.user.upsert({
    where: { email: "manager@artisan.local" },
    update: {
      firstName: "Алексей",
      lastName: "Миронов",
      roleId: managerRole.id,
      phone: "+7 900 000-00-03",
      companyName: "Artisan",
      messengerType: MessengerType.TELEGRAM,
      messengerHandle: "@artisan_manager",
    },
    create: {
      email: "manager@artisan.local",
      firstName: "Алексей",
      lastName: "Миронов",
      roleId: managerRole.id,
      phone: "+7 900 000-00-03",
      companyName: "Artisan",
      messengerType: MessengerType.TELEGRAM,
      messengerHandle: "@artisan_manager",
    },
  });

  await prisma.user.updateMany({
    where: {
      email: {
        in: [
          "admin@artisan.local",
          "manager@artisan.local",
          "client@artisan.local",
          "dealer@artisan.local",
          "silver@artisan.local",
          "bronze@artisan.local",
        ],
      },
    },
    data: {
      hashedPassword: defaultPasswordHash,
      isActive: true,
    },
  });
}

async function seedCategories() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
  }
}

async function seedBrands() {
  for (const brand of brands) {
    await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: brand,
      create: brand,
    });
  }
}

async function seedDeliveryMethods() {
  for (const method of deliveryMethods) {
    await prisma.deliveryMethod.upsert({
      where: { code: method.code },
      update: method,
      create: method,
    });
  }
}

async function seedProducts() {
  const ldspCategory = await prisma.category.findUniqueOrThrow({
    where: { slug: "ldsp" },
  });
  const fittingsCategory = await prisma.category.findUniqueOrThrow({
    where: { slug: "fittings" },
  });
  const worktopsCategory = await prisma.category.findUniqueOrThrow({
    where: { slug: "worktops" },
  });

  const swissKronoBrand = await prisma.brand.findUniqueOrThrow({
    where: { slug: "swiss-krono" },
  });
  const hettichBrand = await prisma.brand.findUniqueOrThrow({
    where: { slug: "hettich" },
  });
  const slotexBrand = await prisma.brand.findUniqueOrThrow({
    where: { slug: "slotex" },
  });

  await prisma.product.upsert({
    where: { slug: "swiss-krono-gerion" },
    update: {
      sku: "SK-GERION-16",
      name: "Swiss Krono Герион",
      summary:
        "Светлый бетонный декор для современной корпусной мебели, кухонь и рабочих пространств.",
      description:
        "Плитный материал для проектов, где нужен нейтральный светлый тон, стабильная партия и быстрый подбор кромки.",
      categoryId: ldspCategory.id,
      brandId: swissKronoBrand.id,
      status: ProductStatus.ACTIVE,
      orderMode: ProductOrderMode.REQUEST_PRICE,
      inventoryStatus: InventoryStatus.IN_STOCK,
      price: 3500,
      format: "2800 x 2070 мм, 16 мм",
      isFeatured: true,
      images: {
        deleteMany: {},
        create: [
          {
            url: "https://images.unsplash.com/photo-1618221469555-7f3ad97540d6?auto=format&fit=crop&w=1200&q=80",
            alt: "Swiss Krono Герион",
            sortOrder: 10,
          },
        ],
      },
      attributes: {
        deleteMany: {},
        create: [
          { name: "Толщина", value: "16 мм", sortOrder: 10 },
          { name: "Формат листа", value: "2800 x 2070 мм", sortOrder: 20 },
          { name: "Сценарий заказа", value: "Запрос цены", sortOrder: 30 },
        ],
      },
    },
    create: {
      slug: "swiss-krono-gerion",
      sku: "SK-GERION-16",
      name: "Swiss Krono Герион",
      summary:
        "Светлый бетонный декор для современной корпусной мебели, кухонь и рабочих пространств.",
      description:
        "Плитный материал для проектов, где нужен нейтральный светлый тон, стабильная партия и быстрый подбор кромки.",
      categoryId: ldspCategory.id,
      brandId: swissKronoBrand.id,
      status: ProductStatus.ACTIVE,
      orderMode: ProductOrderMode.REQUEST_PRICE,
      inventoryStatus: InventoryStatus.IN_STOCK,
      price: 3500,
      format: "2800 x 2070 мм, 16 мм",
      isFeatured: true,
      images: {
        create: [
          {
            url: "https://images.unsplash.com/photo-1618221469555-7f3ad97540d6?auto=format&fit=crop&w=1200&q=80",
            alt: "Swiss Krono Герион",
            sortOrder: 10,
          },
        ],
      },
      attributes: {
        create: [
          { name: "Толщина", value: "16 мм", sortOrder: 10 },
          { name: "Формат листа", value: "2800 x 2070 мм", sortOrder: 20 },
          { name: "Сценарий заказа", value: "Запрос цены", sortOrder: 30 },
        ],
      },
    },
  });

  await prisma.product.upsert({
    where: { slug: "hettich-sensys-8645i" },
    update: {
      sku: "HT-SENSYS-8645",
      name: "Hettich Sensys 8645i",
      summary:
        "Петля с мягким доводчиком для кухонных и шкафных фасадов с высоким ресурсом работы.",
      description:
        "Подходит для ежедневной проектной эксплуатации и быстрой комплектации фасадов под готовый заказ.",
      categoryId: fittingsCategory.id,
      brandId: hettichBrand.id,
      status: ProductStatus.ACTIVE,
      orderMode: ProductOrderMode.CART,
      inventoryStatus: InventoryStatus.IN_STOCK,
      price: 308,
      format: "1 шт.",
      isFeatured: true,
      images: {
        deleteMany: {},
        create: [
          {
            url: "https://images.unsplash.com/photo-1582582429416-47f57f66a8cf?auto=format&fit=crop&w=1200&q=80",
            alt: "Hettich Sensys 8645i",
            sortOrder: 10,
          },
        ],
      },
      attributes: {
        deleteMany: {},
        create: [
          { name: "Тип", value: "Петля с доводчиком", sortOrder: 10 },
          { name: "Открывание", value: "110°", sortOrder: 20 },
          { name: "Сценарий заказа", value: "Покупка онлайн", sortOrder: 30 },
        ],
      },
    },
    create: {
      slug: "hettich-sensys-8645i",
      sku: "HT-SENSYS-8645",
      name: "Hettich Sensys 8645i",
      summary:
        "Петля с мягким доводчиком для кухонных и шкафных фасадов с высоким ресурсом работы.",
      description:
        "Подходит для ежедневной проектной эксплуатации и быстрой комплектации фасадов под готовый заказ.",
      categoryId: fittingsCategory.id,
      brandId: hettichBrand.id,
      status: ProductStatus.ACTIVE,
      orderMode: ProductOrderMode.CART,
      inventoryStatus: InventoryStatus.IN_STOCK,
      price: 308,
      format: "1 шт.",
      isFeatured: true,
      images: {
        create: [
          {
            url: "https://images.unsplash.com/photo-1582582429416-47f57f66a8cf?auto=format&fit=crop&w=1200&q=80",
            alt: "Hettich Sensys 8645i",
            sortOrder: 10,
          },
        ],
      },
      attributes: {
        create: [
          { name: "Тип", value: "Петля с доводчиком", sortOrder: 10 },
          { name: "Открывание", value: "110°", sortOrder: 20 },
          { name: "Сценарий заказа", value: "Покупка онлайн", sortOrder: 30 },
        ],
      },
    },
  });

  await prisma.product.upsert({
    where: { slug: "slotex-stone-graphite" },
    update: {
      sku: "SL-STONE-GRAPHITE",
      name: "Slotex Stone Graphite",
      summary:
        "Столешница для выразительных кухонь и рабочих зон с устойчивой к износу поверхностью.",
      description:
        "Подходит для бытовых и коммерческих проектов, где важны визуальный характер и практичность поверхности.",
      categoryId: worktopsCategory.id,
      brandId: slotexBrand.id,
      status: ProductStatus.ACTIVE,
      orderMode: ProductOrderMode.REQUEST_PRICE,
      inventoryStatus: InventoryStatus.ON_REQUEST,
      price: 12800,
      format: "3050 x 600 мм",
      isFeatured: true,
      images: {
        deleteMany: {},
        create: [
          {
            url: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
            alt: "Slotex Stone Graphite",
            sortOrder: 10,
          },
        ],
      },
      attributes: {
        deleteMany: {},
        create: [
          { name: "Формат", value: "3050 x 600 мм", sortOrder: 10 },
          {
            name: "Поверхность",
            value: "Износостойкий пластик",
            sortOrder: 20,
          },
          {
            name: "Сценарий заказа",
            value: "Консультация и расчет",
            sortOrder: 30,
          },
        ],
      },
    },
    create: {
      slug: "slotex-stone-graphite",
      sku: "SL-STONE-GRAPHITE",
      name: "Slotex Stone Graphite",
      summary:
        "Столешница для выразительных кухонь и рабочих зон с устойчивой к износу поверхностью.",
      description:
        "Подходит для бытовых и коммерческих проектов, где важны визуальный характер и практичность поверхности.",
      categoryId: worktopsCategory.id,
      brandId: slotexBrand.id,
      status: ProductStatus.ACTIVE,
      orderMode: ProductOrderMode.REQUEST_PRICE,
      inventoryStatus: InventoryStatus.ON_REQUEST,
      price: 12800,
      format: "3050 x 600 мм",
      isFeatured: true,
      images: {
        create: [
          {
            url: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
            alt: "Slotex Stone Graphite",
            sortOrder: 10,
          },
        ],
      },
      attributes: {
        create: [
          { name: "Формат", value: "3050 x 600 мм", sortOrder: 10 },
          {
            name: "Поверхность",
            value: "Износостойкий пластик",
            sortOrder: 20,
          },
          {
            name: "Сценарий заказа",
            value: "Консультация и расчет",
            sortOrder: 30,
          },
        ],
      },
    },
  });
}

async function seedPagesAndSettings() {
  await prisma.sitePage.upsert({
    where: { slug: "about" },
    update: {
      title: "О компании",
      excerpt:
        "Artisan собирает каталог, сервис и сопровождение заказов в единую рабочую систему.",
      body: "Страница о компании будет редактироваться через админку после подключения CMS-потока.",
      status: PageStatus.PUBLISHED,
      seoTitle: "О компании Artisan",
      seoDescription:
        "Artisan — материалы, фурнитура и услуги для мебельных проектов.",
    },
    create: {
      slug: "about",
      title: "О компании",
      excerpt:
        "Artisan собирает каталог, сервис и сопровождение заказов в единую рабочую систему.",
      body: "Страница о компании будет редактироваться через админку после подключения CMS-потока.",
      status: PageStatus.PUBLISHED,
      seoTitle: "О компании Artisan",
      seoDescription:
        "Artisan — материалы, фурнитура и услуги для мебельных проектов.",
    },
  });

  await prisma.banner.upsert({
    where: { key: "home-hero-primary" },
    update: {
      placement: BannerPlacement.HOME_HERO,
      title: "Материалы и сервис для мебельных проектов",
      subtitle:
        "Каталог, калькулятор распила и сервисные сценарии в одной коммерческой системе.",
      ctaLabel: "Открыть каталог",
      ctaHref: "/catalog",
      imageUrl:
        "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=2000&q=80",
      isActive: true,
      sortOrder: 10,
    },
    create: {
      key: "home-hero-primary",
      placement: BannerPlacement.HOME_HERO,
      title: "Материалы и сервис для мебельных проектов",
      subtitle:
        "Каталог, калькулятор распила и сервисные сценарии в одной коммерческой системе.",
      ctaLabel: "Открыть каталог",
      ctaHref: "/catalog",
      imageUrl:
        "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=2000&q=80",
      isActive: true,
      sortOrder: 10,
    },
  });

  await prisma.siteSetting.upsert({
    where: { key: "contact.primary" },
    update: {
      value: {
        phone: "+7 (999) 000-00-00",
        email: "hello@artisan.local",
        whatsapp: "https://wa.me/79990000000",
        telegram: "https://t.me/artisan_local",
      },
      description: "Основные контактные данные сайта.",
    },
    create: {
      key: "contact.primary",
      value: {
        phone: "+7 (999) 000-00-00",
        email: "hello@artisan.local",
        whatsapp: "https://wa.me/79990000000",
        telegram: "https://t.me/artisan_local",
      },
      description: "Основные контактные данные сайта.",
    },
  });
}

async function seedPromotions() {
  const product = await prisma.product.findUniqueOrThrow({
    where: { slug: "swiss-krono-gerion" },
  });

  await prisma.promotion.upsert({
    where: { slug: "kitchen-start" },
    update: {
      name: "Старт кухни",
      description:
        "Акция на стартовую комплектацию плитного материала для новых кухонных проектов.",
      status: PromotionStatus.ACTIVE,
      targetType: PromotionTargetType.PRODUCT,
      discountType: DiscountType.PERCENT,
      discountValue: 10,
      isHighlighted: true,
      badgeText: "-10% до конца месяца",
      startsAt: new Date("2026-04-01T00:00:00.000Z"),
      endsAt: new Date("2026-04-30T23:59:59.000Z"),
      products: {
        deleteMany: {},
        create: [{ productId: product.id }],
      },
    },
    create: {
      slug: "kitchen-start",
      name: "Старт кухни",
      description:
        "Акция на стартовую комплектацию плитного материала для новых кухонных проектов.",
      status: PromotionStatus.ACTIVE,
      targetType: PromotionTargetType.PRODUCT,
      discountType: DiscountType.PERCENT,
      discountValue: 10,
      isHighlighted: true,
      badgeText: "-10% до конца месяца",
      startsAt: new Date("2026-04-01T00:00:00.000Z"),
      endsAt: new Date("2026-04-30T23:59:59.000Z"),
      products: {
        create: [{ productId: product.id }],
      },
    },
  });

  await prisma.promotion.upsert({
    where: { slug: "artisan-online-1000" },
    update: {
      name: "Онлайн-заказ Artisan",
      description:
        "Промокод для быстрого оформления заказа через сайт с фиксированной скидкой.",
      status: PromotionStatus.ACTIVE,
      targetType: PromotionTargetType.ORDER,
      discountType: DiscountType.FIXED_AMOUNT,
      discountValue: 1000,
      promoCode: "ARTISAN1000",
      minOrderTotal: 15000,
      usageLimit: 50,
      isHighlighted: true,
      badgeText: "1000 ₽ на заказ онлайн",
      startsAt: new Date("2026-04-01T00:00:00.000Z"),
      endsAt: new Date("2026-05-31T23:59:59.000Z"),
    },
    create: {
      slug: "artisan-online-1000",
      name: "Онлайн-заказ Artisan",
      description:
        "Промокод для быстрого оформления заказа через сайт с фиксированной скидкой.",
      status: PromotionStatus.ACTIVE,
      targetType: PromotionTargetType.ORDER,
      discountType: DiscountType.FIXED_AMOUNT,
      discountValue: 1000,
      promoCode: "ARTISAN1000",
      minOrderTotal: 15000,
      usageLimit: 50,
      isHighlighted: true,
      badgeText: "1000 ₽ на заказ онлайн",
      startsAt: new Date("2026-04-01T00:00:00.000Z"),
      endsAt: new Date("2026-05-31T23:59:59.000Z"),
    },
  });
}

async function seedOperations() {
  const customer = await prisma.user.findUniqueOrThrow({
    where: { email: "client@artisan.local" },
  });
  const manager = await prisma.user.findUniqueOrThrow({
    where: { email: "manager@artisan.local" },
  });
  const deliveryMethod = await prisma.deliveryMethod.findUniqueOrThrow({
    where: { code: "city-delivery" },
  });
  const product = await prisma.product.findUniqueOrThrow({
    where: { slug: "swiss-krono-gerion" },
  });

  await prisma.order.upsert({
    where: { number: "A-1001" },
    update: {
      userId: customer.id,
      managerId: manager.id,
      status: OrderStatus.CONFIRMED,
      contactName: "Ирина Кузнецова",
      contactPhone: "+7 900 000-00-02",
      contactEmail: "client@artisan.local",
      companyName: "Studio Form",
      deliveryMethodId: deliveryMethod.id,
      comment: "Подтвердить отгрузку после согласования раскроя.",
      subtotal: 14000,
      discountTotal: 1400,
      deliveryTotal: 1500,
      total: 14100,
      items: {
        deleteMany: {},
        create: [
          {
            productId: product.id,
            quantity: 4,
            unitPrice: 3500,
            discountAmount: 1400,
            total: 12600,
            snapshotName: "Swiss Krono Герион",
            snapshotSku: "SK-GERION-16",
            snapshotBrand: "Swiss Krono",
          },
        ],
      },
    },
    create: {
      number: "A-1001",
      userId: customer.id,
      managerId: manager.id,
      status: OrderStatus.CONFIRMED,
      contactName: "Ирина Кузнецова",
      contactPhone: "+7 900 000-00-02",
      contactEmail: "client@artisan.local",
      companyName: "Studio Form",
      deliveryMethodId: deliveryMethod.id,
      comment: "Подтвердить отгрузку после согласования раскроя.",
      subtotal: 14000,
      discountTotal: 1400,
      deliveryTotal: 1500,
      total: 14100,
      items: {
        create: [
          {
            productId: product.id,
            quantity: 4,
            unitPrice: 3500,
            discountAmount: 1400,
            total: 12600,
            snapshotName: "Swiss Krono Герион",
            snapshotSku: "SK-GERION-16",
            snapshotBrand: "Swiss Krono",
          },
        ],
      },
    },
  });

  await prisma.request.upsert({
    where: { number: "R-2001" },
    update: {
      type: RequestType.CUTTING_SERVICE,
      status: RequestStatus.IN_REVIEW,
      subject: "Расчет распила для кухни",
      message:
        "Нужен предварительный расчет по раскрою и кромлению с учетом двух вариантов материала.",
      userId: customer.id,
      managerId: manager.id,
      productId: product.id,
      contactName: "Ирина Кузнецова",
      contactPhone: "+7 900 000-00-02",
      contactEmail: "client@artisan.local",
      messengerType: MessengerType.WHATSAPP,
      messengerHandle: "+79000000002",
      material: "ЛДСП 16 мм",
      edgeOption: "ABS 1 мм",
      deliveryNeeded: true,
      addressText: "г. Бишкек, ул. Кулатова, 3/1",
      estimatedBudget: 24000,
      files: {
        deleteMany: {},
        create: [
          {
            fileName: "kitchen-cut-map.pdf",
            fileUrl: "https://example.com/files/kitchen-cut-map.pdf",
            mimeType: "application/pdf",
            size: 420000,
          },
        ],
      },
    },
    create: {
      number: "R-2001",
      type: RequestType.CUTTING_SERVICE,
      status: RequestStatus.IN_REVIEW,
      subject: "Расчет распила для кухни",
      message:
        "Нужен предварительный расчет по раскрою и кромлению с учетом двух вариантов материала.",
      userId: customer.id,
      managerId: manager.id,
      productId: product.id,
      contactName: "Ирина Кузнецова",
      contactPhone: "+7 900 000-00-02",
      contactEmail: "client@artisan.local",
      messengerType: MessengerType.WHATSAPP,
      messengerHandle: "+79000000002",
      material: "ЛДСП 16 мм",
      edgeOption: "ABS 1 мм",
      deliveryNeeded: true,
      addressText: "г. Бишкек, ул. Кулатова, 3/1",
      estimatedBudget: 24000,
      files: {
        create: [
          {
            fileName: "kitchen-cut-map.pdf",
            fileUrl: "https://example.com/files/kitchen-cut-map.pdf",
            mimeType: "application/pdf",
            size: 420000,
          },
        ],
      },
    },
  });
}

async function seedLoyalty() {
  const customer = await prisma.user.findUniqueOrThrow({
    where: { email: "client@artisan.local" },
  });
  const order = await prisma.order.findUniqueOrThrow({
    where: { number: "A-1001" },
  });

  await prisma.loyaltyTransaction.deleteMany({
    where: {
      userId: customer.id,
    },
  });

  await prisma.loyaltyTransaction.create({
    data: {
      userId: customer.id,
      type: LoyaltyTransactionType.BONUS_ACCRUAL,
      points: 6180,
      balanceAfter: 6180,
      title: "История прошлых проектов",
      description: "Перенос накопленных баллов из предыдущих заказов.",
      createdAt: new Date("2026-03-10T09:00:00.000Z"),
    },
  });

  await prisma.loyaltyTransaction.create({
    data: {
      userId: customer.id,
      type: LoyaltyTransactionType.REDEMPTION,
      points: -4980,
      balanceAfter: 1200,
      title: "Частичное списание баллов",
      description: "Использование бонусов в предыдущем заказе.",
      createdAt: new Date("2026-03-28T09:00:00.000Z"),
    },
  });

  await prisma.loyaltyTransaction.create({
    data: {
      userId: customer.id,
      orderId: order.id,
      type: LoyaltyTransactionType.ORDER_ACCRUAL,
      points: 660,
      balanceAfter: 1860,
      title: "Баллы за заказ",
      description: "Начисление после подтверждения заказа A-1001.",
      createdAt: new Date("2026-04-17T09:00:00.000Z"),
    },
  });
}

async function main() {
  await seedRoles();
  await seedUsers();
  await seedCategories();
  await seedBrands();
  await seedDeliveryMethods();
  await seedProducts();
  await seedPagesAndSettings();
  await seedPromotions();
  await seedOperations();
  await seedLoyalty();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Prisma seed failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
