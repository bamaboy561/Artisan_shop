// Сопоставление материала из проекта Базиса (или таблицы) с материалом
// сайта. От выбранного материала зависит формат листа, поэтому без
// сопоставления калькулятор раскраивал детали на лист, выбранный по
// умолчанию, и раскрой выходил неверным.

export type MatchablePreset = {
  id: string;
  label: string;
  sku: string;
  materialName: string;
  materialId: string;
  thicknessMm: number | null;
};

export type MaterialMatchConfidence = "code" | "name" | "thickness" | "none";

export type MaterialMatch = {
  presetId: string | null;
  confidence: MaterialMatchConfidence;
};

type MaterialKind = "ldsp" | "mdf" | "dvp" | "hpl" | "countertop";

function normalize(value: string) {
  return value
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[_]+/g, " ")
    .replace(/(\d)[.,](\d)/g, "$1.$2")
    .replace(/[^\p{L}\p{N}.]+/gu, " ")
    .trim();
}

function detectKind(text: string): MaterialKind | null {
  const value = normalize(text);

  if (/столеш/.test(value)) return "countertop";
  // \b в JS не считает кириллицу буквами, поэтому границы слов свои.
  if (/(?<![\p{L}\p{N}])(двп|хдф|hdf|оргалит)/u.test(value)) return "dvp";
  if (/(?<![\p{L}\p{N}])hpl(?![\p{L}\p{N}])|пластик/u.test(value)) {
    return "hpl";
  }
  if (/(?<![\p{L}\p{N}])(мдф|mdf)(?![\p{L}\p{N}])/u.test(value)) return "mdf";
  if (/(?<![\p{L}\p{N}])(лдсп|ldsp|дсп)(?![\p{L}\p{N}])/u.test(value)) {
    return "ldsp";
  }

  return null;
}

function kindOfMaterialId(materialId: string): MaterialKind | null {
  const id = materialId.toLowerCase();

  if (id.startsWith("ldsp")) return "ldsp";
  if (id.startsWith("mdf")) return "mdf";
  if (id.startsWith("hpl")) return "hpl";
  if (id.startsWith("countertop")) return "countertop";
  if (id.startsWith("dvp") || id.startsWith("hdf")) return "dvp";

  return null;
}

const STOP_WORDS = new Set([
  "лдсп",
  "дсп",
  "мдф",
  "двп",
  "хдф",
  "hdf",
  "mdf",
  "ldsp",
  "мм",
  "mm",
  "материал",
  "плита",
  "лист",
  "ламинированная",
  "ламинированный",
  "указан",
  "не",
]);

// Коды декоров: U6933, W1000, 4429, ST9 и т. п. По ним совпадение надёжнее
// всего, названия у поставщиков пишут по-разному.
function decorCodes(text: string) {
  return normalize(text)
    .split(/\s+/)
    .map((token) => token.replace(/\./g, ""))
    .filter((token) => /\d/.test(token) && /^[\p{L}\p{N}]{3,}$/u.test(token))
    .filter((token) => !/^\d{1,2}(мм|mm)?$/u.test(token));
}

function nameWords(text: string) {
  return normalize(text)
    .split(/\s+/)
    .filter(
      (token) =>
        token.length >= 3 && !/\d/.test(token) && !STOP_WORDS.has(token),
    );
}

function presetText(preset: MatchablePreset) {
  return normalize(`${preset.label} ${preset.materialName} ${preset.sku}`);
}

function isManualPreset(preset: MatchablePreset) {
  return preset.id.startsWith("manual:");
}

function sameThickness(preset: MatchablePreset, thickness: number) {
  if (!(thickness > 0) || !preset.thicknessMm) return true;
  return Math.abs(preset.thicknessMm - thickness) < 0.6;
}

function kindFits(preset: MatchablePreset, kind: MaterialKind | null): boolean {
  const presetKind =
    kindOfMaterialId(preset.materialId) ?? detectKind(presetText(preset));

  if (!kind) {
    // Тонкий лист без названия вида почти всегда ДВП/ХДФ, а не HPL.
    return presetKind !== "hpl" && presetKind !== "countertop";
  }

  return presetKind === kind || (presetKind === null && kind !== "dvp");
}

// В таблицах толщины нет отдельной колонкой: берём её из названия.
function thicknessFromName(material: string) {
  const match = normalize(material).match(
    /(?<![\p{L}\p{N}.])(\d{1,2}(?:\.\d)?)\s*(?:мм|mm)(?![\p{L}\p{N}])/u,
  );
  const value = match ? Number(match[1]) : 0;
  return value >= 2 && value <= 60 ? value : 0;
}

// Материалы сайта, подходящие по толщине и виду, лучшие первыми.
export function rankPresetsForMaterial<T extends MatchablePreset>(
  material: string,
  fileThickness: number,
  presets: T[],
): Array<{ preset: T; score: number; codeHit: boolean }> {
  const thickness =
    fileThickness > 0 ? fileThickness : thicknessFromName(material);
  const kind =
    detectKind(material) ?? (thickness > 0 && thickness <= 5 ? "dvp" : null);
  const codes = decorCodes(material);
  const words = nameWords(material);

  return presets
    .filter(
      (preset) => sameThickness(preset, thickness) && kindFits(preset, kind),
    )
    .map((preset, index) => {
      const text = presetText(preset);
      const compactText = text.replace(/[\s.]+/g, "");
      const textWords = new Set(text.split(/\s+/));
      const codeHits = codes.filter((code) => compactText.includes(code));
      const wordHits = words.filter(
        (word) =>
          textWords.has(word) ||
          [...textWords].some(
            (item) =>
              item.length >= 5 &&
              word.length >= 5 &&
              item.startsWith(word.slice(0, -1)),
          ),
      );
      const score =
        codeHits.length * 10 +
        wordHits.length * 3 +
        (isManualPreset(preset) ? 0 : 0.5) -
        index / 100_000;

      return { preset, score, codeHit: codeHits.length > 0 };
    })
    .sort((left, right) => right.score - left.score);
}

export function matchMaterialToPreset(
  material: string,
  thickness: number,
  presets: MatchablePreset[],
  currentPresetId: string | null = null,
): MaterialMatch {
  const ranked = rankPresetsForMaterial(material, thickness, presets);
  const best = ranked[0];

  if (!best) return { presetId: null, confidence: "none" };

  if (best.codeHit) {
    return { presetId: best.preset.id, confidence: "code" };
  }

  if (best.score >= 3) {
    return { presetId: best.preset.id, confidence: "name" };
  }

  // Совпала только толщина: оставляем выбранный клиентом материал, если он
  // подходит, иначе берём общий материал этой толщины.
  const current = ranked.find((item) => item.preset.id === currentPresetId);
  const generic =
    current ?? ranked.find((item) => isManualPreset(item.preset)) ?? best;

  return { presetId: generic.preset.id, confidence: "thickness" };
}
