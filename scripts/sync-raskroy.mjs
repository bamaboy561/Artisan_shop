// Копирует программу раскроя (репозиторий raspil) в public/raskroy, копия лежит в репозитории сайта.
// После изменений в программе: node scripts/sync-raskroy.mjs ../raspil и закоммитить public/raskroy.
// В index.html добавляется <base href="/raskroy/">, потому что сайт открывает
// программу по адресу /raskroy без косой черты в конце.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const from = resolve(process.argv[2] ?? "../raspil");
const to = resolve("public/raskroy");
if (!existsSync(join(from, "index.html")) || !existsSync(join(from, "src/core"))) {
  console.error(`Не найдена программа раскроя в ${from}`);
  process.exit(1);
}
rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });
for (const item of ["index.html", "manifest.webmanifest", "sw.js", "src", "css", "icons", "vendor"]) {
  if (existsSync(join(from, item))) cpSync(join(from, item), join(to, item), { recursive: true });
}
const index = join(to, "index.html");
writeFileSync(index, readFileSync(index, "utf8").replace("<head>", '<head>\n<base href="/raskroy/">'));
console.log(`Программа раскроя скопирована в ${to}`);
