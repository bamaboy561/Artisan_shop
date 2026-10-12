import { getPublicProductsBySlugs } from "@/lib/server/catalog-public";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    const body = await request.text();
    if (body.length > 60000)
      return Response.json({ error: "Request too large" }, { status: 413 });
    payload = JSON.parse(body);
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    !("slugs" in payload) ||
    !Array.isArray(payload.slugs) ||
    payload.slugs.length > 100 ||
    payload.slugs.some(
      (slug: unknown) =>
        typeof slug !== "string" || !slug.trim() || slug.length > 500,
    )
  ) {
    return Response.json({ error: "Invalid product list" }, { status: 400 });
  }
  try {
    const products = await getPublicProductsBySlugs([
      ...new Set<string>(payload.slugs),
    ]);
    return Response.json(
      { products },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "Cart product lookup failed",
      error instanceof Error ? error.name : "Unknown error",
    );
    return Response.json(
      { error: "Не удалось обновить цены и остатки. Попробуйте ещё раз." },
      { status: 503 },
    );
  }
}
