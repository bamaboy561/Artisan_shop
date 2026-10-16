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

// «Дуб Коми 2.75*1.83» → «Дуб Коми»: размер листа на карточке и так
// показан отдельно, в названии он только мешает читать декор.
export function displayProductName(product: { name: string; format: string }) {
  if (!isSheetFormat(product.format)) return product.name;
  const short = product.name
    .replace(/\s*\d[.,]\d{1,2}\s*[×xх*]\s*\d[.,]\d{1,2}(?:\s*м)?/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return short.length >= 3 ? short : product.name;
}
