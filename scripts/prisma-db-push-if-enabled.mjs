import { execFileSync } from "node:child_process";

if (process.env.ARTISAN_RUN_PRISMA_PUSH !== "1") {
  console.log("Prisma db push skipped.");
  process.exit(0);
}

console.log("Applying Prisma schema with db push...");

const npx = process.platform === "win32" ? "npx.cmd" : "npx";

execFileSync(npx, ["prisma", "db", "push"], {
  env: process.env,
  stdio: "inherit",
});
