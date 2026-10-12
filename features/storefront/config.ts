export function isPremiumStorefront() {
  return process.env.ARTISAN_STOREFRONT_DESIGN !== "classic";
}
