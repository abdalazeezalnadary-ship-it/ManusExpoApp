import { eq } from "drizzle-orm";
import menu from "../drizzle/seed/menu.json";
import { branches, categories, menuItems } from "../drizzle/schema";
import { getDb } from "../server/db";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is required and the database must be reachable.");

  const branchSeeds = [
    {
      branchCode: "dream-city-main",
      name: "المركز الرئيسي: مطاعم دريم سيتي",
      city: "تعز",
      address: "تعز - الحوبان - أمام حديقة دريم لاند",
      serviceType: "متكامل (صالة عوائل، صالة شباب، سفري، وتوصيل)",
      latitude: null,
      longitude: null,
      isActive: true,
    },
    {
      branchCode: "crispy-meals",
      name: "كرسبي ميلز (Crispy Meals)",
      city: "تعز",
      address: "تعز - الحوبان - أمام حديقة الحيوانات - مول جوهرة تعز - الدور الرابع",
      serviceType: "وجبات سريعة، سفري، وتوصيل",
      latitude: null,
      longitude: null,
      isActive: true,
    },
  ];

  for (const branch of branchSeeds) {
    await db.insert(branches).values(branch).onDuplicateKeyUpdate({
      set: {
        name: branch.name,
        city: branch.city,
        address: branch.address,
        serviceType: branch.serviceType,
        isActive: true,
      },
    });
  }

  const [mainBranch] = await db.select().from(branches)
    .where(eq(branches.branchCode, "dream-city-main")).limit(1);
  if (!mainBranch) throw new Error("Main branch could not be initialized.");

  const categoryIds = new Map<string, number>();
  for (const [sortOrder, category] of menu.categories.entries()) {
    await db.insert(categories).values({
      sourceKey: category.key,
      name: category.name,
      sortOrder,
      station: category.stations?.[0] ?? null,
      isActive: true,
    }).onDuplicateKeyUpdate({
      set: {
        name: category.name,
        sortOrder,
        station: category.stations?.[0] ?? null,
        isActive: true,
      },
    });
    const [row] = await db.select().from(categories)
      .where(eq(categories.sourceKey, category.key)).limit(1);
    if (!row) throw new Error("A menu category could not be initialized.");
    categoryIds.set(category.key, row.id);
  }

  let count = 0;
  for (const category of menu.categories) {
    const categoryId = categoryIds.get(category.key);
    if (!categoryId) throw new Error("A category reference is missing.");
    for (const item of category.items) {
      await db.insert(menuItems).values({
        sku: item.id,
        branchId: mainBranch.id,
        categoryId,
        name: item.name,
        price: item.priceYER,
        currency: "YER",
        station: item.station,
        stock: item.stock ?? null,
        isAvailable: item.isAvailable,
      }).onDuplicateKeyUpdate({
        set: {
          branchId: mainBranch.id,
          categoryId,
          name: item.name,
          price: item.priceYER,
          currency: "YER",
          station: item.station,
          stock: item.stock ?? null,
          isAvailable: item.isAvailable,
        },
      });
      count += 1;
    }
  }

  console.log(`Seeded ${branchSeeds.length} branches and ${count} official main-branch menu items. No user accounts were created.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Menu seed failed.");
  process.exit(1);
});
