import { execFileSync } from "node:child_process";

if (process.env.ARTISAN_RUN_PRISMA_PUSH !== "1") {
  console.log("Prisma db push skipped.");
  process.exit(0);
}

console.log("Applying Prisma schema with db push...");

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const args = ["prisma", "db", "push"];

if (process.env.ARTISAN_ACCEPT_PRISMA_DATA_LOSS === "1") {
  console.log("Explicit Prisma data-loss acknowledgement enabled.");
  args.push("--accept-data-loss");
}

execFileSync(npx, args, {
  env: process.env,
  stdio: "inherit",
});
