import { contentTypeOf, fetchAsset, latestRelease } from "@/lib/server/raskroy-releases";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Установщик программы раскроя из последнего выпуска. Без входа; отдаются только файлы из списка выпуска.
export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  try {
    const release = await latestRelease();
    const asset = release.assets.find((a) => a.name === name);
    if (!asset) return new Response("Not found", { status: 404 });
    const res = await fetchAsset(asset);
    const ascii = asset.name.replace(/[^\x20-\x7e]|["\\]/g, "_");
    return new Response(res.body, {
      headers: {
        "Content-Type": contentTypeOf(asset.name),
        "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(asset.name)}`,
        ...(asset.size ? { "Content-Length": String(asset.size) } : {}),
        "Cache-Control": "public, max-age=600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("[raskroy] download failed", name, error);
    return new Response("Download failed", { status: 502 });
  }
}
