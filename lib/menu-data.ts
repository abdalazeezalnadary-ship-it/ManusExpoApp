import seed from "@/drizzle/seed/menu.json";

export type MenuCategory = {
  number: number;
  key: string;
  name: string;
  stations: string[];
};

export type MenuProduct = {
  id: string;
  name: string;
  priceYER: number;
  station: string;
  stock: number | null;
  isAvailable: boolean;
  categoryKey: string;
  categoryName: string;
};

const categoryRows = seed.categories as Array<{
  number: number;
  key: string;
  name: string;
  stations: string[];
  items: Omit<MenuProduct, "categoryKey" | "categoryName">[];
}>;

export const MENU_CATEGORIES: MenuCategory[] = categoryRows.map(
  ({ number, key, name, stations }) => ({ number, key, name, stations }),
);

export const MENU_PRODUCTS: MenuProduct[] = categoryRows.flatMap((category) =>
  category.items.map((item) => ({
    ...item,
    categoryKey: category.key,
    categoryName: category.name,
  })),
);

export const MENU_BY_CODE = new Map(MENU_PRODUCTS.map((item) => [item.id, item]));
