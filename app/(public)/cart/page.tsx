import { CartView } from "@/app/(public)/cart/cart-view";
import { getPublicProducts } from "@/lib/server/catalog-public";

export default async function CartPage() {
  const products = await getPublicProducts();
  return <CartView products={products} />;
}
