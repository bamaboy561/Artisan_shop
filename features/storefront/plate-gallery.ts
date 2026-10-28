// У плит первым фото загружен интерьер, вторым — образец декора. Покупатель
// выбирает именно декор, поэтому для товаров с форматом листа образец
// показываем первым, а интерьер — вторым.
export function isSheetFormat(format: string) {
  const match = format.match(/(\d{3,4})\s*[×xх*]\s*(\d{3,4})/i);
  return Boolean(
    match && (Number(match[1]) * Number(match[2])) / 1_000_000 >= 1,
  );
}

export function orderedGallery(product: {
  image: string;
  gallery: string[];
  format: string;
}) {
  const gallery = product.gallery.length ? product.gallery : [product.image];

  if (!isSheetFormat(product.format) || gallery.length < 2) {
    return gallery;
  }

  return [gallery[1], gallery[0], ...gallery.slice(2)];
}

// Аббревиатуры материалов в названиях из 1С остаются заглавными.
const KEEP_UPPERCASE = new Set([
  "ЛДСП",
  "ДСП",
  "МДФ",
  "ХДФ",
  "ЛХДФ",
  "ПВХ",
  "АБС",
]);

/**
 * Названия из 1С часто набраны ЗАГЛАВНЫМИ: «DOLCE 200ММ РУЧКА ПОЛНАЯ».
 * Русские слова переводим в обычный регистр, латиницу (бренды, модели,
 * артикулы) и аббревиатуры материалов не трогаем. «Ножки(Опора)» получает
 * пробел перед скобкой. Название в базе не меняется, только на витрине.
 */
export function tidyProductName(name: string, titleCase = false) {
  const spaced = name
    .replace(/(\p{L})\(/gu, "$1 (")
    .replace(/\s+/g, " ")
    .trim();
  const letters = spaced.match(/\p{L}/gu) ?? [];
  const upper = letters.filter(
    (letter) => letter !== letter.toLowerCase(),
  ).length;

  if (letters.length < 6 || upper / letters.length < 0.8) return spaced;

  const lowered = spaced.replace(/[А-ЯЁ]+/g, (run, offset: number) => {
    if (KEEP_UPPERCASE.has(run)) return run;
    const word = run.toLowerCase();
    // Декоры плит — имена собственные: «ДУБ КОМИ» → «Дуб Коми».
    const startsWord = offset === 0 || /[\s(«"-]/.test(spaced[offset - 1]);
    return titleCase && startsWord
      ? word[0].toUpperCase() + word.slice(1)
      : word;
  });
  return /^[а-яё]/.test(lowered)
    ? lowered[0].toUpperCase() + lowered.slice(1)
    : lowered;
}

// «Дуб Коми 2.75*1.83» → «Дуб Коми»: размер листа на карточке и так
// показан отдельно, в названии он только мешает читать декор.
export function displayProductName(product: { name: string; format: string }) {
  if (!isSheetFormat(product.format)) return tidyProductName(product.name);
  const short = tidyProductName(product.name, true)
    .replace(/\s*\d[.,]\d{1,2}\s*[×xх*]\s*\d[.,]\d{1,2}(?:\s*м)?/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return short.length >= 3 ? short : tidyProductName(product.name, true);
}
