// Кромка «в тон» к плите: у плиты и кромки одно название декора, только
// у кромки рядом слова «Кромка», «ПВХ», размеры и артикулы. Сравниваем
// слова названия без них.
const ignoredWords = new Set([
  "кромка",
  "пвх",
  "abs",
  "лдсп",
  "мдф",
  "мм",
  "матовый",
  "рулон",
  "e",
  "е",
  "vl",
]);

export function decorWords(name: string) {
  return name
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(
      (word) => word.length > 1 && !/\d/.test(word) && !ignoredWords.has(word),
    );
}

export function findMatchingEdges<
  T extends { name: string; slug: string; inStock: boolean },
>(plateName: string, edges: T[], limit = 4) {
  const plate = decorWords(plateName);

  if (plate.length === 0) return [];

  return edges
    .map((edge) => {
      const words = new Set(decorWords(edge.name));
      const fits = plate.every((word) => words.has(word));
      return { edge, fits, extra: words.size - new Set(plate).size };
    })
    .filter((item) => item.fits)
    .sort(
      (left, right) =>
        Number(right.edge.inStock) - Number(left.edge.inStock) ||
        left.extra - right.extra,
    )
    .slice(0, limit)
    .map((item) => item.edge);
}
