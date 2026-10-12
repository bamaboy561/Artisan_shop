import { CartView } from "@/app/(public)/cart/cart-view";
import { getPublicProducts } from "@/lib/server/catalog-public";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const products = await getPublicProducts();
  return <CartView products={products} />;
}
