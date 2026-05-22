import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma";

const useDirectUrl = process.argv.includes("--direct");
const envName = useDirectUrl ? "DIRECT_URL" : "DATABASE_URL";
const connectionString =
  (useDirectUrl ? process.env.DIRECT_URL : process.env.DATABASE_URL) ??
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(`${envName} is not set.`);
}

const resolvedConnectionString: string = connectionString;

function getSafeHost(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "unknown-host";
  }
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(resolvedConnectionString, { schema: "public" }),
});

async function main() {
  const [databaseVersion] = await prisma.$queryRaw<Array<{ version: string }>>`
    select version()
  `;
  const [roles, users, categories, brands, products, orders, requests] =
    await Promise.all([
      prisma.role.count(),
      prisma.user.count(),
      prisma.category.count(),
      prisma.brand.count(),
      prisma.product.count(),
      prisma.order.count(),
      prisma.request.count(),
    ]);

  console.log("Database connection OK.");
  console.log(`Connection: ${envName}`);
  console.log(`Host: ${getSafeHost(resolvedConnectionString)}`);
  console.log(
    `PostgreSQL: ${databaseVersion?.version.split(" ").slice(0, 2).join(" ") ?? "unknown"}`,
  );
  console.table({
    roles,
    users,
    categories,
    brands,
    products,
    orders,
    requests,
  });
}

main()
  .catch((error) => {
    console.error("Database health check failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
