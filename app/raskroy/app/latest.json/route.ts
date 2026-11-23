import { fetchAsset, latestRelease } from "@/lib/server/raskroy-releases";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS = { "Access-Control-Allow-Origin": "*" };

// Сведения о последней версии для проверки обновлений в установленной программе раскроя. Без входа.
export async function GET() {
  try {
    const release = await latestRelease();
    const asset = release.assets.find((a) => a.name === "latest.json");
    if (!asset) return Response.json({ ok: false, error: "no latest.json" }, { status: 404, headers: CORS });
    const text = await (await fetchAsset(asset)).text();
    JSON.parse(text); // отдаём только корректный JSON
    return new Response(text, {
      headers: {
        ...CORS,
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=600",
      },
    });
  } catch (error) {
    console.error("[raskroy] latest.json failed", error);
    return Response.json({ ok: false }, { status: 502, headers: CORS });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Methods": "GET, OPTIONS" } });
}
