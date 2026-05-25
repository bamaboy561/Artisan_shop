export type CatalogCategory = {
  slug: string;
  name: string;
  summary: string;
  description?: string;
  indicator: string;
  scenario: string;
  coverImage: string;
  spotlight: string;
  seoTitle?: string;
  seoDescription?: string;
  updatedAt?: Date;
};

export type CatalogSection = {
  slug: string;
  name: string;
  description: string;
  routeHint?: string;
};

export type BrandCatalogAssignment = {
  slug: string;
  name: string;
  sectionSlug: string;
  sectionName: string;
  subcategories: string[];
  contentStatus: "active" | "planned";
};

export type ProductSpecification = {
  key: string;
  value: string;
};

export type ProductBundleItem = {
  label: string;
  productSlug?: string;
  productName?: string;
  productSku?: string;
  brand?: string;
  image?: string;
  quantity?: number;
  unitPrice?: number;
  lineTotal?: number;
};

export type CalculatorMaterialId = "ldsp-16" | "mdf-16";

export type CalculatorSheetPresetId = "2800x2070" | "2750x1830" | "2800x1220";

export type CalculatorProductContext = {
  slug: string;
  name: string;
  brand: string;
  calculatorMaterialId: CalculatorMaterialId;
  sheetPresetId: CalculatorSheetPresetId;
};

export type FeaturedProduct = {
  slug: string;
  name: string;
  brand: string;
  brandSlug: string;
  categorySlug: string;
  categoryName: string;
  image: string;
  gallery: string[];
  price?: number;
  oldPrice?: number;
  sku: string;
  inStock: boolean;
  format: string;
  summary: string;
  description: string;
  seoTitle?: string;
  seoDescription?: string;
  action: string;
  purchaseMode: "cart" | "request";
  availabilityText: string;
  specifications: ProductSpecification[];
  isBundle: boolean;
  bundleItems: ProductBundleItem[];
  isPromotional?: boolean;
  decorGroup?: string;
  decorGroupSlug?: string;
  searchText: string;
  sourceUrl?: string;
  calculatorMaterialId?: CalculatorMaterialId;
  sheetPresetId?: CalculatorSheetPresetId;
  updatedAt?: Date;
};

export type Brand = {
  slug: string;
  name: string;
  description: string;
  country: string;
  logoUrl?: string;
  homeBannerImages?: string[];
  productCount: number;
  highlight: string;
  categorySlug: string;
  updatedAt?: Date;
};

export type PartnerBrand = {
  slug: string;
  name: string;
  label: string;
  description: string;
  previewLabels: string[];
};
