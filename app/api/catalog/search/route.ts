import { searchPublicProducts } from "@/lib/server/catalog-public";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length > 200)
    return Response.json({ error: "Query too long" }, { status: 400 });
  try {
    const products = await searchPublicProducts(query);
    return Response.json(
      { products },
      { headers: { "Cache-Control": "public, max-age=30" } },
    );
  } catch {
    return Response.json({ error: "Search unavailable" }, { status: 503 });
  }
}
