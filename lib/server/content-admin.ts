import { getDb } from "@/lib/db";

export async function getAdminContentOverview() {
  const db = getDb();

  const [pages, banners] = await Promise.all([
    db.sitePage.findMany({
      orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
    }),
    db.banner.findMany({
      orderBy: [
        { placement: "asc" },
        { sortOrder: "asc" },
        { updatedAt: "desc" },
      ],
    }),
  ]);

  return { pages, banners };
}
