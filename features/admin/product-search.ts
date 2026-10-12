type SearchProduct = {
  name: string;
  sku: string;
  brand?: { name: string } | null;
  category?: { name: string } | null;
  brandName?: string;
  categoryName?: string;
};

export function normalizeProductSearch(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/(\d)[,.](\d)/g, "$1.$2")
    .replace(/(\d)\s*[xх×*]\s*(?=\d)/g, "$1 ")
    .replace(/(\d)(?=мм(?!\p{L}))/gu, "$1 ")
    .replace(/[^\p{L}\p{N}.]+/gu, " ")
    .trim();
}

function compact(value: string) {
  return normalizeProductSearch(value).replace(/[^\p{L}\p{N}]/gu, "");
}

// One mistyped letter is allowed in words, never in numeric identifiers.
function nearWord(left: string, right: string) {
  if (left.length < 5 || /\d/.test(left + right)) return false;
  if (Math.abs(left.length - right.length) > 1) return false;
  let a = 0;
  let b = 0;
  let edits = 0;
  while (a < left.length && b < right.length) {
    if (left[a] === right[b]) {
      a++;
      b++;
      continue;
    }
    if (++edits > 1) return false;
    if (left.length <= right.length) b++;
    if (left.length >= right.length) a++;
  }
  return edits + (left.length - a) + (right.length - b) <= 1;
}

export function productSearchScore(product: SearchProduct, query: string) {
  const normalized = normalizeProductSearch(query.slice(0, 500));
  if (!normalized) return 1;
  const sku = compact(product.sku);
  const article = compact(query);
  if (sku && article === sku) return 1000;
  if (sku && article.length >= 3 && sku.includes(article)) return 900;
  const text = normalizeProductSearch(
    [
      product.name,
      product.sku,
      product.brand?.name,
      product.category?.name,
      product.brandName,
      product.categoryName,
    ]
      .filter(Boolean)
      .join(" "),
  );
  if (` ${text} `.includes(` ${normalized} `)) return 800;
  const words = text.split(/\s+/);
  const terms = [...new Set(normalized.split(/\s+/))].filter(
    (term) => !["арт", "артикул", "мм", "шт"].includes(term),
  );
  if (!terms.length) return 0;
  let matched = 0;
  let exact = 0;
  for (const term of terms) {
    if (
      words.some(
        (word) => word === term || (!/\d/.test(term) && word.startsWith(term)),
      )
    ) {
      matched++;
      exact++;
    } else if (words.some((word) => nearWord(term, word))) {
      matched++;
    }
  }
  if (matched === terms.length) return 500 + (exact / terms.length) * 100;
  if (matched >= 2 && matched / terms.length >= 0.75)
    return 100 + (matched / terms.length) * 100 + exact;
  return 0;
}

export function rankProductSearch<T extends SearchProduct>(
  products: T[],
  query: string,
) {
  if (!query.trim()) return products;
  return products
    .map((product, index) => ({
      product,
      index,
      score: productSearchScore(product, query),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ product }) => product);
}
