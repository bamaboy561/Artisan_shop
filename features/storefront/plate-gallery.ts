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
