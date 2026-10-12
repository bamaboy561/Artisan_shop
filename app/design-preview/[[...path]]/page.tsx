import { notFound } from "next/navigation";
import { PreviewHome } from "@/features/design-preview/home";
import { PreviewCatalog } from "@/features/design-preview/catalog";
import { PreviewProduct } from "@/features/design-preview/product";
import { products } from "@/features/design-preview/data";

export default async function DesignPreviewPage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { path = [] } = await params;
  if (!path.length) return <PreviewHome />;
  if (path.length === 1 && path[0] === "catalog") return <PreviewCatalog />;
  if (path.length === 2 && path[0] === "product") {
    const product = products.find((item) => item.slug === path[1]);
    if (product) return <PreviewProduct key={product.slug} product={product} />;
  }
  notFound();
}
