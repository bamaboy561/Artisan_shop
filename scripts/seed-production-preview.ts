import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  if (process.env.ARTISAN_DEMO_MODE !== "true")
    throw new Error(
      "Preview fixtures require explicit ARTISAN_DEMO_MODE=true; no database is used.",
    );
  const directory = path.join(process.cwd(), ".artisan-runtime");
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, "requests.json");
  const plansFile = path.join(directory, "production-plans.json");
  async function readJson<T>(filePath: string, fallback: T): Promise<T> {
    try {
      return JSON.parse(await readFile(filePath, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
      throw error;
    }
  }
  const existing = await readJson<Array<{ id: string }>>(file, []);
  const plans = await readJson<Record<string, unknown>>(plansFile, {});
  const now = Date.now();
  const stages = [
    "ACCEPTED",
    "CUTTING",
    "EDGING",
    "DRILLING",
    "READY_FOR_PICKUP",
  ];
  const materials = [
    "МДФ Albero 18 мм, 2800 × 2070",
    "ЛДСП Swiss Krono Дуб натуральный 18 мм, 2800 × 2070",
    "Панель AGT 18 мм, 2800 × 1220",
    "HPL компакт 10 мм, 3050 × 1300",
  ];
  const clients = [
    "Иванова Марина",
    "ОсОО Мебельная мастерская Александра Константинова",
    "Абдраимов Азамат",
    "Петров Сергей",
  ];
  let added = 0;
  for (let i = 0; i < 126; i++) {
    const id = `demo-production-${String(i + 1).padStart(3, "0")}`;
    if (existing.some((item) => item.id === id)) continue;
    const createdAt = new Date(now - (126 - i) * 3600_000).toISOString();
    const stage = stages[i % stages.length];
    existing.push({
      id,
      number: `ДЕМО-${String(i + 1).padStart(3, "0")}`,
      type: "CUTTING_SERVICE",
      status: "IN_PROGRESS",
      subject: materials[i % 4],
      material: materials[i % 4],
      contactName: clients[i % 4],
      contactPhone: "+996000000000",
      contactEmail: null,
      message: "Демонстрационная заявка. Не передавать в производство.",
      cuttingStage: stage,
      cuttingSheetCount: 2 + (i % 12),
      cuttingEdgeMeters: 10 + (i % 30),
      edgeOption: "ПВХ 0,8 × 22 мм, в цвет материала",
      cuttingPickupCell: stage === "READY_FOR_PICKUP" ? `A-${i + 1}` : null,
      cuttingStageUpdatedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
      files: [],
      manager: {
        id: "demo-super-admin",
        firstName: "Демо",
        lastName: "Менеджер",
        email: "admin@artisan.local",
      },
    } as { id: string });
    if (i % 4 !== 0)
      plans[id] = {
        dueDate: new Date(now + ((i % 5) - 2) * 86400_000).toLocaleDateString(
          "en-CA",
          { timeZone: "Asia/Bishkek" },
        ),
        version: 1,
        events: [],
      };
    added++;
  }
  await writeFile(file, JSON.stringify(existing, null, 2), "utf8");
  await writeFile(plansFile, JSON.stringify(plans, null, 2), "utf8");
  console.log(
    `Added ${added} demo production requests; existing records preserved. No database access.`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
