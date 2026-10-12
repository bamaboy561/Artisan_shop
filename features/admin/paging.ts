export function paginateItems<T>(
  items: T[],
  pageParam: string | string[] | undefined,
  pageSize: number,
) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const requestedPage = Number.parseInt(
    String(Array.isArray(pageParam) ? pageParam[0] : (pageParam ?? "1")),
    10,
  );
  const currentPage =
    Number.isFinite(requestedPage) && requestedPage >= 1
      ? Math.min(requestedPage, totalPages)
      : 1;

  return {
    items: items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    currentPage,
    totalPages,
  };
}

export function withPageParam(href: string, page: number) {
  return page > 1
    ? `${href}${href.includes("?") ? "&" : "?"}page=${page}`
    : href;
}
