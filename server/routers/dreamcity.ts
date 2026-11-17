import { z } from "zod";
import { and, asc, desc, eq, inArray, isNotNull, lte, notInArray, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { router, publicProcedure, protectedProcedure, passwordChangeProcedure, adminProcedure } from "../_core/trpc";
import { signStaffToken, safeUser } from "../_core/staff-auth";
import { canServeReadyOrder, kdsItemTransitionAllowed, orderStatusTransitionAllowed } from "../_core/order-policy";
import { getDb } from "../db";
import { appSettings, auditLogs, branches, categories, cashBoxes, driverLocations, expenses, inventoryItems, journalEntries, menuItems, orderItems, orders, shifts, users, promotions, returnOrders } from "../../drizzle/schema";
import { STAFF_ROLES, REPORT_ROLES, couponDiscount, knownStockBalance, locationFreshness, requireBranchAccess, requireRole, returnTransitionAllowed, assertUniqueOrderItems, idempotentOrderReplay } from "./dreamcity-contracts";

const failDb = () => new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة." });
const roles = (...allowed: string[]) => (role: string) => requireRole(role, allowed);
const staff = roles(...STAFF_ROLES);
const reportStaff = roles(...REPORT_ROLES);
const reportManagers = roles("admin", "manager", "accountant");
const getBranch = async (db: any, branchId?: number, branchCode?: string) => {
  const [b] = await db.select().from(branches).where(branchCode ? eq(branches.branchCode, branchCode) : eq(branches.id, branchId ?? -1)).limit(1);
  if (!b) throw new TRPCError({ code: "NOT_FOUND", message: "الفرع غير موجود." });
  return b;
};
const asObject = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
const splitMetadataSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("equal"), people: z.number().int().min(2).max(12) }).strict(),
  z.object({ mode: z.literal("items"), people: z.number().int().min(2).max(12), assignments: z.record(z.string().max(100), z.number().int().min(1).max(12)) }).strict(),
]);
const deliveryZonesSettingSchema = z.object({ zones: z.array(z.object({ code: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/), name: z.string().trim().min(1).max(120), fee: z.number().int().min(0).max(100_000_000), branchId: z.number().int().positive().optional(), isActive: z.boolean().optional() }).strict()).max(100) }).strict().refine((value) => new Set(value.zones.map((zone) => zone.code.toLowerCase())).size === value.zones.length, "رمز المنطقة يجب أن يكون فريداً.");
const loyaltyRedemptionSettingSchema = z.union([z.object({ pointsPerUnit: z.number().int().min(1).max(1_000_000), valuePerPoint: z.number().int().min(1).max(100_000_000) }).strict(), z.object({}).strict()]);
const loyaltyEarningSettingSchema = z.union([z.object({ spendPerPoint: z.number().int().min(1).max(100_000_000), pointsPerThreshold: z.number().int().min(1).max(1_000_000) }).strict(), z.object({}).strict()]);
const adminSettingSchema = z.object({ key: z.enum(["delivery_zones", "loyalty_redemption", "loyalty_earning"]), value: z.unknown() }).strict().superRefine((input, issue) => {
  const schema = input.key === "delivery_zones" ? deliveryZonesSettingSchema : input.key === "loyalty_redemption" ? loyaltyRedemptionSettingSchema : loyaltyEarningSettingSchema;
  if (!schema.safeParse(input.value).success) issue.addIssue({ code: "custom", path: ["value"], message: "قيمة إعداد المطعم غير صالحة." });
});

export const dreamcityRouter = router({
  auth: router({
    me: publicProcedure.query(({ ctx }) => safeUser(ctx.user)),
    login: publicProcedure.input(z.object({ phone: z.string().trim().min(7).max(32), password: z.string().min(1) })).mutation(async ({ input }) => {
      const db = await getDb(); if (!db) throw failDb();
      const [u] = await db.select().from(users).where(eq(users.phone, input.phone)).limit(1);
      if (!u?.passwordHash || !u.isAvailable || !(await bcrypt.compare(input.password, u.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "بيانات الدخول غير صحيحة." });
      const token = await signStaffToken(u); await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, u.id)); return { token, user: safeUser(u) };
    }),
    register: publicProcedure.input(z.object({ phone: z.string().trim().min(7).max(32), password: z.string().min(10).max(128), name: z.string().trim().min(1).max(120) })).mutation(async ({ input }) => {
      const db = await getDb(); if (!db) throw failDb(); const hash = await bcrypt.hash(input.password, 12);
      try {
        const result = await db.insert(users).values({ openId: `customer:${input.phone}`, phone: input.phone, name: input.name, passwordHash: hash, role: "customer", loginMethod: "phone", mustChangePassword: false });
        const id = Number((result as any).insertId); const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1); if (!u) throw failDb(); return { token: await signStaffToken(u), user: safeUser(u) };
      } catch (e: any) { if (e?.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "رقم الهاتف مسجل مسبقاً." }); throw e; }
    }),
    changePassword: passwordChangeProcedure.input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(10).max(128) })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw failDb(); const [u] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!u?.passwordHash || !(await bcrypt.compare(input.currentPassword, u.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "كلمة المرور الحالية غير صحيحة." });
      const passwordHash = await bcrypt.hash(input.newPassword, 12); await db.update(users).set({ passwordHash, mustChangePassword: false }).where(eq(users.id, u.id)); return { success: true };
    }),
    logout: publicProcedure.mutation(() => ({ success: true as const })),
  }),
  branches: router({
    list: publicProcedure.query(async () => { const db = await getDb(); if (!db) throw failDb(); return db.select({ id: branches.id, branchCode: branches.branchCode, name: branches.name, city: branches.city, address: branches.address, serviceType: branches.serviceType, phone: branches.phone, isActive: branches.isActive }).from(branches).where(eq(branches.isActive, true)).orderBy(asc(branches.id)); }),
    deliveryZones: publicProcedure.input(z.object({ branchCode: z.string().trim().min(1).max(64) })).query(async ({ input }) => {
      const db = await getDb(); if (!db) throw failDb(); const branch = await getBranch(db, undefined, input.branchCode);
      const [setting] = await db.select().from(appSettings).where(eq(appSettings.settingKey, "delivery_zones")).limit(1);
      const config = asObject(setting?.value); const entries = Array.isArray(setting?.value) ? setting.value : Array.isArray(config?.zones) ? config.zones : [];
      return entries.map(asObject).filter((zone): zone is Record<string, unknown> => !!zone && zone.isActive !== false && typeof zone.code === "string" && typeof zone.name === "string" && Number.isSafeInteger(zone.fee) && Number(zone.fee) >= 0 && (zone.branchId == null || Number(zone.branchId) === branch.id)).map((zone) => ({ code: String(zone.code), name: String(zone.name), fee: Number(zone.fee) }));
    }),
  }),
  checkout: router({
    loyaltyInfo: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb(); if (!db) throw failDb(); const [customer] = await db.select({ points: users.points }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
      const [redemptionSetting] = await db.select().from(appSettings).where(eq(appSettings.settingKey, "loyalty_redemption")).limit(1);
      const [earningSetting] = await db.select().from(appSettings).where(eq(appSettings.settingKey, "loyalty_earning")).limit(1);
      const redemption = asObject(redemptionSetting?.value); const earning = asObject(earningSetting?.value);
      const pointsPerUnit = Number(redemption?.pointsPerUnit); const valuePerPoint = Number(redemption?.valuePerPoint);
      return { points: Number(customer?.points ?? 0), redemption: { enabled: Number.isSafeInteger(pointsPerUnit) && pointsPerUnit > 0 && Number.isSafeInteger(valuePerPoint) && valuePerPoint > 0, pointsPerUnit: Number.isSafeInteger(pointsPerUnit) ? pointsPerUnit : null, valuePerPoint: Number.isSafeInteger(valuePerPoint) ? valuePerPoint : null }, earning: { enabled: Number.isSafeInteger(Number(earning?.spendPerPoint)) && Number(earning?.spendPerPoint) > 0 && Number.isSafeInteger(Number(earning?.pointsPerThreshold)) && Number(earning?.pointsPerThreshold) > 0 } };
    }),
  }),
  menu: router({
    list: publicProcedure.input(z.object({ branchId: z.number().int().positive().optional(), branchCode: z.string().optional(), categoryId: z.number().int().positive().optional(), search: z.string().trim().max(100).optional() }).optional()).query(async ({ input }) => {
      const db = await getDb(); if (!db) throw failDb(); const b = await getBranch(db, input?.branchId, input?.branchCode ?? "dream-city-main"); const filters: any[] = [eq(menuItems.branchId, b.id), eq(menuItems.isAvailable, true)];
      if (input?.categoryId) filters.push(eq(menuItems.categoryId, input.categoryId)); if (input?.search) filters.push(sql`${menuItems.name} LIKE ${`%${input.search}%`}`);
      return db.select({ id: menuItems.id, sku: menuItems.sku, name: menuItems.name, price: menuItems.price, currency: menuItems.currency, station: menuItems.station, stock: menuItems.stock, categoryId: menuItems.categoryId, categoryName: categories.name, isAvailable: menuItems.isAvailable }).from(menuItems).innerJoin(categories, eq(categories.id, menuItems.categoryId)).where(and(...filters)).orderBy(asc(categories.sortOrder), asc(menuItems.id));
    }),
    manageList: protectedProcedure.input(z.object({ branchId: z.number().int().positive().optional(), search: z.string().trim().max(100).optional() }).optional()).query(async ({ ctx, input }) => {
      roles("admin", "manager")(ctx.user.role); const db = await getDb(); if (!db) throw failDb(); const branchId = ctx.user.role === "admin" ? input?.branchId : ctx.user.branchId;
      if (!branchId) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر فرعاً لعرض المنيو." }); requireBranchAccess(ctx.user.role, ctx.user.branchId, branchId);
      return db.select({ id: menuItems.id, sku: menuItems.sku, name: menuItems.name, price: menuItems.price, currency: menuItems.currency, station: menuItems.station, stock: menuItems.stock, categoryId: menuItems.categoryId, categoryName: categories.name, isAvailable: menuItems.isAvailable, branchId: menuItems.branchId }).from(menuItems).innerJoin(categories, eq(categories.id, menuItems.categoryId)).where(and(eq(menuItems.branchId, branchId), input?.search ? sql`${menuItems.name} LIKE ${`%${input.search}%`}` : undefined)).orderBy(asc(categories.sortOrder), asc(menuItems.id));
    }),
    updateItem: protectedProcedure.input(z.object({ id: z.number().int().positive(), branchId: z.number().int().positive().optional(), name: z.string().trim().min(1).max(180), price: z.number().int().positive().max(1_000_000_000), station: z.enum(["grill", "hot", "fry", "salad", "beverages", "desserts"]), isAvailable: z.boolean() })).mutation(async ({ ctx, input }) => {
      roles("admin", "manager")(ctx.user.role); const db = await getDb(); if (!db) throw failDb(); const [item] = await db.select().from(menuItems).where(eq(menuItems.id, input.id)).limit(1);
      if (!item) throw new TRPCError({ code: "NOT_FOUND" }); requireBranchAccess(ctx.user.role, ctx.user.branchId, item.branchId);
      if (input.branchId && input.branchId !== item.branchId) throw new TRPCError({ code: "FORBIDDEN" });
      await db.transaction(async (tx: any) => { await tx.update(menuItems).set({ name: input.name, price: input.price, station: input.station, isAvailable: input.isAvailable }).where(eq(menuItems.id, item.id)); await tx.insert(auditLogs).values({ actorId: ctx.user.id, branchId: item.branchId, action: "MENU_ITEM_UPDATED", entityType: "menu_item", entityId: String(item.id), details: { name: input.name, oldPrice: item.price, newPrice: input.price, station: input.station, isAvailable: input.isAvailable } }); });
      return { success: true };
    }),
  }),
  orders: router({
    create: protectedProcedure.input(z.object({ clientOrderId: z.string().trim().min(8).max(128), branchId: z.number().int().positive().optional(), branchCode: z.string().trim().min(1).max(64).optional(), orderType: z.enum(["delivery", "pickup", "dine_in"]), items: z.array(z.object({ menuItemId: z.number().int().positive().optional(), menuItemCode: z.string().trim().min(1).max(100).optional(), quantity: z.number().int().min(1).max(100) }).refine(x => !!x.menuItemId || !!x.menuItemCode)).min(1).max(100), tableNumber: z.string().trim().min(1).max(32).optional(), deliveryDetails: z.object({ customerName: z.string().trim().min(1).max(120), phone: z.string().regex(/^7\d{8}$/), address: z.string().trim().min(1).max(300) }).strict().optional(), splitMetadata: splitMetadataSchema.optional(), couponCode: z.string().trim().min(1).max(64).optional(), loyaltyPoints: z.number().int().positive().optional(), deliveryZoneCode: z.string().trim().min(1).max(64).optional() }).superRefine((input, issue) => {
      if (input.orderType === "delivery" && !input.deliveryDetails) issue.addIssue({ code: "custom", path: ["deliveryDetails"], message: "بيانات التوصيل مطلوبة." });
      if (input.orderType === "delivery" && !input.deliveryZoneCode) issue.addIssue({ code: "custom", path: ["deliveryZoneCode"], message: "منطقة التوصيل مطلوبة." });
      if (input.orderType !== "delivery" && (input.deliveryDetails || input.deliveryZoneCode)) issue.addIssue({ code: "custom", path: ["deliveryDetails"], message: "بيانات التوصيل لا تناسب نوع الطلب." });
      if (input.orderType === "dine_in" && !input.tableNumber) issue.addIssue({ code: "custom", path: ["tableNumber"], message: "رقم الطاولة مطلوب." });
      if (input.splitMetadata?.mode === "items" && Object.values(input.splitMetadata.assignments).some(person => person > input.splitMetadata!.people)) issue.addIssue({ code: "custom", path: ["splitMetadata", "assignments"], message: "تخصيص الأصناف يتجاوز عدد الأشخاص." });
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw failDb();
      const [existing] = await db.select().from(orders).where(eq(orders.clientOrderId, input.clientOrderId)).limit(1);
      if (existing) return idempotentOrderReplay(existing, ctx.user.id);
      const branch = await getBranch(db, input.branchId, input.branchCode);
      if (ctx.user.role !== "customer" && ctx.user.role !== "user") { staff(ctx.user.role); requireBranchAccess(ctx.user.role, ctx.user.branchId, branch.id); }
      try {
        return await db.transaction(async (tx: any) => {
          const predicates = input.items.map(i => i.menuItemId ? eq(menuItems.id, i.menuItemId) : eq(menuItems.sku, i.menuItemCode!));
          const rows = await tx.select().from(menuItems).where(and(eq(menuItems.branchId, branch.id), or(...predicates), eq(menuItems.isAvailable, true)));
          assertUniqueOrderItems(input.items);
          const keys = input.items.map(i => i.menuItemId ?? i.menuItemCode!);
          if (rows.length !== new Set(keys).size) throw new TRPCError({ code: "BAD_REQUEST", message: "يتضمن الطلب صنفاً غير متاح." });
          let subtotal = 0;
          const chosen = input.items.map(i => { const item = rows.find((r: any) => r.id === i.menuItemId || r.sku === i.menuItemCode); if (!item) throw new TRPCError({ code: "BAD_REQUEST" }); const lineTotal = item.price * i.quantity; subtotal += lineTotal; return { item, quantity: i.quantity, lineTotal }; });
          let discount = 0;
          if (input.couponCode) {
            const [promotion] = await tx.select().from(promotions).where(eq(promotions.code, input.couponCode.toUpperCase())).limit(1);
            if (!promotion) throw new TRPCError({ code: "BAD_REQUEST", message: "الكوبون غير موجود أو غير مهيأ." });
            discount = couponDiscount(promotion, branch.id, subtotal);
          }
          let deliveryFee = 0;
          if (input.deliveryZoneCode) {
            const [setting] = await tx.select().from(appSettings).where(eq(appSettings.settingKey, "delivery_zones")).limit(1);
            const zones = asObject(setting?.value); const entries = Array.isArray(setting?.value) ? setting.value : Array.isArray(zones?.zones) ? zones!.zones as unknown[] : [];
            const zone = entries.map(asObject).find((z: any) => z?.code === input.deliveryZoneCode && z?.isActive !== false && (z.branchId == null || z.branchId === branch.id));
            if (!zone || !Number.isSafeInteger(zone.fee) || Number(zone.fee) < 0) throw new TRPCError({ code: "BAD_REQUEST", message: "منطقة التوصيل ورسومها غير مهيأة رسمياً." }); deliveryFee = Number(zone.fee);
          }
          let loyaltyDiscount = 0; let pointsToRedeem = 0;
          if (input.loyaltyPoints) {
            const [setting] = await tx.select().from(appSettings).where(eq(appSettings.settingKey, "loyalty_redemption")).limit(1); const cfg = asObject(setting?.value);
            const pointsPerUnit = cfg?.pointsPerUnit; const valuePerPoint = cfg?.valuePerPoint;
            if (!Number.isSafeInteger(pointsPerUnit) || Number(pointsPerUnit) < 1 || !Number.isSafeInteger(valuePerPoint) || Number(valuePerPoint) < 1) throw new TRPCError({ code: "BAD_REQUEST", message: "استبدال نقاط الولاء غير مهيأ رسمياً." });
            const [customer] = await tx.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
            if (!customer || customer.points < input.loyaltyPoints) throw new TRPCError({ code: "BAD_REQUEST", message: "رصيد نقاط الولاء غير كافٍ." });
            const redeemableUnits = Math.min(Math.floor(input.loyaltyPoints / Number(pointsPerUnit)), Math.floor(Math.max(0, subtotal - discount) / Number(valuePerPoint)));
            pointsToRedeem = redeemableUnits * Number(pointsPerUnit);
            loyaltyDiscount = redeemableUnits * Number(valuePerPoint);
            if (loyaltyDiscount <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "عدد النقاط لا يحقق الحد الأدنى للاستبدال." });
          }
          const total = subtotal - discount - loyaltyDiscount + deliveryFee;
          if (input.loyaltyPoints && ctx.user.role !== "customer" && ctx.user.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "نقاط الولاء متاحة لحسابات العملاء فقط." });
          const inserted = await tx.insert(orders).values({ clientOrderId: input.clientOrderId, userId: ctx.user.id, branchId: branch.id, orderType: input.orderType, tableNumber: input.tableNumber ?? null, deliveryDetails: input.deliveryDetails ?? null, splitMetadata: input.splitMetadata ?? null, couponCode: input.couponCode ?? null, discountAmount: discount + loyaltyDiscount, deliveryFee, loyaltyPointsRedeemed: pointsToRedeem, subtotal, total, paymentMethod: "cash", paymentStatus: "unpaid" });
          const orderId = Number(inserted.insertId);
          for (const c of chosen) {
            await tx.insert(orderItems).values({ orderId, menuItemId: c.item.id, itemName: c.item.name, quantity: c.quantity, unitPrice: c.item.price, lineTotal: c.lineTotal, station: c.item.station });
            if (knownStockBalance(c.item.stock)) {
              const r = await tx.update(menuItems).set({ stock: sql`${menuItems.stock} - ${c.quantity}` }).where(and(eq(menuItems.id, c.item.id), eq(menuItems.branchId, branch.id), isNotNull(menuItems.stock), sql`${menuItems.stock} >= ${c.quantity}`));
              if (Number(r.affectedRows ?? 0) !== 1) throw new TRPCError({ code: "CONFLICT", message: `المخزون المعروف للصنف ${c.item.name} غير كافٍ.` });
              await tx.insert(auditLogs).values({ actorId: ctx.user.id, branchId: branch.id, action: "INVENTORY_DEDUCTED", entityType: "menuItem", entityId: String(c.item.id), idempotencyKey: `deduct-${orderId}-menu-${c.item.id}`, details: { orderId, quantity: c.quantity, sku: c.item.sku } });
            }
            // inventoryItemId is an explicit one-to-one stock binding; no recipe is inferred.
            if (c.item.inventoryItemId) {
              const [stock] = await tx.select().from(inventoryItems).where(and(eq(inventoryItems.id, c.item.inventoryItemId), eq(inventoryItems.branchId, branch.id))).limit(1);
              if (stock && knownStockBalance(stock.quantity)) {
                const r = await tx.update(inventoryItems).set({ quantity: sql`${inventoryItems.quantity} - ${c.quantity}` }).where(and(eq(inventoryItems.id, stock.id), eq(inventoryItems.branchId, branch.id), isNotNull(inventoryItems.quantity), sql`${inventoryItems.quantity} >= ${c.quantity}`));
                if (Number(r.affectedRows ?? 0) !== 1) throw new TRPCError({ code: "CONFLICT", message: `المخزون المرتبط المعروف للصنف ${c.item.name} غير كافٍ.` });
                await tx.insert(auditLogs).values({ actorId: ctx.user.id, branchId: branch.id, action: "INVENTORY_DEDUCTED", entityType: "inventoryItem", entityId: String(stock.id), idempotencyKey: `deduct-${orderId}-inventory-${stock.id}-${c.item.id}`, details: { orderId, quantity: c.quantity, sku: c.item.sku, binding: "menuItem.inventoryItemId" } });
              }
            }
          }
          if (pointsToRedeem) {
            const r = await tx.update(users).set({ points: sql`${users.points} - ${pointsToRedeem}` }).where(and(eq(users.id, ctx.user.id), sql`${users.points} >= ${pointsToRedeem}`));
            if (Number(r.affectedRows ?? 0) !== 1) throw new TRPCError({ code: "CONFLICT", message: "تغير رصيد النقاط؛ أعد المحاولة." });
          }
          const [created] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1); return created;
        });
      } catch (e: any) {
        if (e?.code === "ER_DUP_ENTRY") { const [retry] = await db.select().from(orders).where(eq(orders.clientOrderId, input.clientOrderId)).limit(1); if (retry && retry.userId === ctx.user.id) return retry; if (retry) throw new TRPCError({ code: "CONFLICT", message: "معرف الطلب مستخدم." }); }
        throw e;
      }
    }),
    mine: protectedProcedure.query(async ({ ctx }) => { const db = await getDb(); if (!db) throw failDb(); return db.select().from(orders).where(eq(orders.userId, ctx.user.id)).orderBy(desc(orders.createdAt)); }),
    receipt: protectedProcedure.input(z.object({ orderId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw failDb(); const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.userId !== ctx.user.id) { staff(ctx.user.role); requireBranchAccess(ctx.user.role, ctx.user.branchId, order.branchId); }
      const [branch] = await db.select().from(branches).where(eq(branches.id, order.branchId)).limit(1);
      const items = await db.select({ id: orderItems.id, menuItemId: orderItems.menuItemId, itemName: orderItems.itemName, currentName: menuItems.name, quantity: orderItems.quantity, unitPrice: orderItems.unitPrice, lineTotal: orderItems.lineTotal, station: orderItems.station }).from(orderItems).innerJoin(menuItems, eq(menuItems.id, orderItems.menuItemId)).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.id));
      return { order, branch: branch ?? null, items };
    }),
    track: protectedProcedure.input(z.object({ orderId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw failDb(); const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1); if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.userId !== ctx.user.id) { staff(ctx.user.role); requireBranchAccess(ctx.user.role, ctx.user.branchId, order.branchId); }
      const [location] = order.driverId ? await db.select().from(driverLocations).where(and(eq(driverLocations.driverId, order.driverId), eq(driverLocations.branchId, order.branchId))).orderBy(desc(driverLocations.recordedAt)).limit(1) : [];
      return { order, driverLocation: location ? { latitude: location.latitude, longitude: location.longitude, recordedAt: location.recordedAt, ageMs: locationFreshness(location.recordedAt).ageMs, isLive: locationFreshness(location.recordedAt).isLive } : null };
    }),
    assignDriver: protectedProcedure.input(z.object({ orderId: z.number().int().positive(), driverId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      roles("admin", "manager")(ctx.user.role); const db = await getDb(); if (!db) throw failDb();
      const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1); if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.user.role === "manager") requireBranchAccess(ctx.user.role, ctx.user.branchId, order.branchId);
      const [driver] = await db.select().from(users).where(and(eq(users.id, input.driverId), eq(users.role, "driver"), eq(users.branchId, order.branchId), eq(users.isAvailable, true))).limit(1);
      if (!driver) throw new TRPCError({ code: "BAD_REQUEST", message: "الموصل غير متاح لهذا الفرع." });
      await db.transaction(async (tx: any) => { await tx.update(orders).set({ driverId: driver.id }).where(eq(orders.id, order.id)); await tx.insert(auditLogs).values({ actorId: ctx.user.id, branchId: order.branchId, action: "DRIVER_ASSIGNED", entityType: "order", entityId: String(order.id), details: { driverId: driver.id } }); }); return { success: true };
    }),
    list: protectedProcedure.input(z.object({ branchId: z.number().optional(), status: z.string().optional() }).optional()).query(async ({ ctx, input }) => { staff(ctx.user.role); const db = await getDb(); if (!db) throw failDb(); const branchId = ctx.user.role === "admin" || ctx.user.role === "manager" ? input?.branchId : ctx.user.branchId; if (!branchId) throw new TRPCError({ code: "FORBIDDEN", message: "لا يوجد فرع مرتبط بالحساب." }); requireBranchAccess(ctx.user.role, ctx.user.branchId, branchId); return db.select().from(orders).where(and(eq(orders.branchId, branchId), input?.status ? eq(orders.status, input.status as any) : undefined)).orderBy(desc(orders.createdAt)).limit(200); }),
    updateStatus: protectedProcedure.input(z.object({ orderId: z.number().int().positive(), status: z.enum(["confirmed", "preparing", "ready", "out_for_delivery", "completed", "cancelled"]) })).mutation(async ({ ctx, input }) => {
      staff(ctx.user.role); const db = await getDb(); if (!db) throw failDb(); const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1); if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      requireBranchAccess(ctx.user.role, ctx.user.branchId, order.branchId);
      if (order.status === input.status) return order;
      if (!orderStatusTransitionAllowed({ role: ctx.user.role, from: order.status, to: input.status, orderType: order.orderType, paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus, assignedDriverId: order.driverId, actorId: ctx.user.id })) {
        throw new TRPCError({ code: "FORBIDDEN", message: "انتقال حالة الطلب غير مسموح لهذا الدور أو من الحالة الحالية." });
      }
      return db.transaction(async (tx: any) => {
        const paymentStatus = input.status === "completed" && order.paymentMethod === "cash" ? "paid" : order.paymentStatus;
        const changed = await tx.update(orders).set({ status: input.status, paymentStatus }).where(and(eq(orders.id, order.id), eq(orders.status, order.status)));
        if (Number(changed.affectedRows ?? 0) !== 1) throw new TRPCError({ code: "CONFLICT", message: "تغيرت حالة الطلب؛ حدّث القائمة ثم أعد المحاولة." });
        await tx.insert(auditLogs).values({ actorId: ctx.user.id, branchId: order.branchId, action: "ORDER_STATUS_UPDATED", entityType: "order", entityId: String(order.id), idempotencyKey: `order-status-${order.id}-${input.status}`, details: { from: order.status, to: input.status } });
        let pointsEarned = 0;
        if (input.status === "completed" && order.status !== "completed") {
          const [setting] = await tx.select().from(appSettings).where(eq(appSettings.settingKey, "loyalty_earning")).limit(1); const config = asObject(setting?.value);
          const spendPerPoint = Number(config?.spendPerPoint); const pointsPerThreshold = Number(config?.pointsPerThreshold);
          if (Number.isSafeInteger(spendPerPoint) && spendPerPoint > 0 && Number.isSafeInteger(pointsPerThreshold) && pointsPerThreshold > 0) {
            pointsEarned = Math.floor(order.total / spendPerPoint) * pointsPerThreshold;
            if (pointsEarned > 0) {
              await tx.update(users).set({ points: sql`${users.points} + ${pointsEarned}` }).where(eq(users.id, order.userId));
              await tx.insert(auditLogs).values({ actorId: ctx.user.id, branchId: order.branchId, action: "LOYALTY_POINTS_EARNED", entityType: "user", entityId: String(order.userId), idempotencyKey: `loyalty-earn-order-${order.id}`, details: { orderId: order.id, points: pointsEarned } });
            }
          }
        }
        return { ...order, status: input.status, paymentStatus, pointsEarned };
      });
    }),
  }),
  kds: router({
    list: protectedProcedure.input(z.object({ station: z.string().optional(), branchId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
      roles("admin", "manager", "chef", "cashier", "waiter")(ctx.user.role); const db = await getDb(); if (!db) throw failDb();
      const branchId = ctx.user.role === "admin" ? input?.branchId : ctx.user.branchId; if (!branchId && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      if (branchId) requireBranchAccess(ctx.user.role, ctx.user.branchId, branchId);
      const visibleStatuses = ctx.user.role === "waiter" ? ["ready"] as const : ctx.user.role === "chef" ? ["pending", "confirmed", "preparing"] as const : ["pending", "confirmed", "preparing", "ready"] as const;
      return db.select({ orderItem: orderItems, order: orders, menuItem: menuItems, chef: { id: users.id, name: users.name } }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).innerJoin(menuItems, eq(menuItems.id, orderItems.menuItemId)).leftJoin(users, eq(users.id, orderItems.assignedChefId)).where(and(branchId ? eq(orders.branchId, branchId) : undefined, inArray(orders.status, visibleStatuses), ctx.user.role === "waiter" ? notInArray(orders.orderType, ["delivery"]) : undefined, input?.station ? eq(orderItems.station, input.station) : undefined, ctx.user.role === "chef" ? or(sql`${orderItems.assignedChefId} IS NULL`, eq(orderItems.assignedChefId, ctx.user.id)) : undefined)).orderBy(asc(orders.createdAt));
    }),
    availableChefs: protectedProcedure.input(z.object({ branchId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
      roles("admin", "manager")(ctx.user.role); const db = await getDb(); if (!db) throw failDb(); const branchId = ctx.user.role === "admin" ? input?.branchId : ctx.user.branchId;
      if (ctx.user.role === "manager" && !branchId) throw new TRPCError({ code: "FORBIDDEN" }); if (branchId) requireBranchAccess(ctx.user.role, ctx.user.branchId, branchId);
      return db.select({ id: users.id, name: users.name, branchId: users.branchId }).from(users).where(and(eq(users.role, "chef"), eq(users.isAvailable, true), branchId ? eq(users.branchId, branchId) : undefined)).orderBy(asc(users.name));
    }),
    updateItemStatus: protectedProcedure.input(z.object({ orderItemId: z.number().int().positive(), status: z.enum(["preparing", "cooking", "ready", "served"]) })).mutation(async ({ ctx, input }) => {
      roles("admin", "manager", "chef", "waiter")(ctx.user.role); const db = await getDb(); if (!db) throw failDb(); const [row] = await db.select({ item: orderItems, order: orders }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).where(eq(orderItems.id, input.orderItemId)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" }); requireBranchAccess(ctx.user.role, ctx.user.branchId, row.order.branchId);
      if (ctx.user.role === "chef" && row.item.assignedChefId != null && row.item.assignedChefId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "هذا الصنف مسند إلى شيف آخر." });
      const current = row.item.kdsStatus ?? "pending";
      const servingReadyOrder = input.status === "served" && canServeReadyOrder(ctx.user.role, row.order.status, row.order.orderType);
      if (!["pending", "confirmed", "preparing"].includes(row.order.status) && !servingReadyOrder) throw new TRPCError({ code: "BAD_REQUEST", message: "حالة الطلب لا تسمح بتحديث المطبخ." });
      if (input.status === "served" && row.order.orderType === "delivery") throw new TRPCError({ code: "BAD_REQUEST", message: "طلب التوصيل يُستكمل من لوحة الموصل." });
      if (current === input.status) return { success: true };
      if (!kdsItemTransitionAllowed({ role: ctx.user.role, from: current, to: input.status, assignedChefId: row.item.assignedChefId, actorId: ctx.user.id })) throw new TRPCError({ code: "FORBIDDEN", message: "انتقال حالة الصنف غير مسموح لهذا الدور أو الشيف." });
      await db.transaction(async (tx: any) => {
        const changed = await tx.update(orderItems).set({ kdsStatus: input.status, ...(ctx.user.role === "chef" && row.item.assignedChefId == null ? { assignedChefId: ctx.user.id, assignedAt: new Date() } : {}) }).where(and(eq(orderItems.id, input.orderItemId), row.item.kdsStatus == null ? sql`${orderItems.kdsStatus} IS NULL` : eq(orderItems.kdsStatus, row.item.kdsStatus)));
        if (Number(changed.affectedRows ?? 0) !== 1) throw new TRPCError({ code: "CONFLICT", message: "تغيرت حالة الصنف؛ حدّث القائمة." });
        await tx.insert(auditLogs).values({ actorId: ctx.user.id, branchId: row.order.branchId, action: "KDS_ITEM_STATUS_UPDATED", entityType: "order_item", entityId: String(input.orderItemId), idempotencyKey: `kds-item-${input.orderItemId}-${input.status}`, details: { from: current, to: input.status } });

        if (input.status === "cooking" || input.status === "preparing") {
          const orderChanged = await tx.update(orders).set({ status: "preparing" }).where(and(eq(orders.id, row.order.id), inArray(orders.status, ["pending", "confirmed"])));
          if (Number(orderChanged.affectedRows ?? 0) === 1) await tx.insert(auditLogs).values({ actorId: ctx.user.id, branchId: row.order.branchId, action: "ORDER_STATUS_UPDATED", entityType: "order", entityId: String(row.order.id), idempotencyKey: `kds-order-${row.order.id}-preparing`, details: { from: row.order.status, to: "preparing" } });
        }

        if (input.status === "ready") {
          const [remaining] = await tx.select({ id: orderItems.id }).from(orderItems).where(and(eq(orderItems.orderId, row.order.id), notInArray(orderItems.kdsStatus, ["ready", "served"]))).limit(1);
          if (!remaining) {
            const orderChanged = await tx.update(orders).set({ status: "ready" }).where(and(eq(orders.id, row.order.id), inArray(orders.status, ["pending", "confirmed", "preparing"])));
            if (Number(orderChanged.affectedRows ?? 0) === 1) await tx.insert(auditLogs).values({ actorId: ctx.user.id, branchId: row.order.branchId, action: "ORDER_STATUS_UPDATED", entityType: "order", entityId: String(row.order.id), idempotencyKey: `kds-order-${row.order.id}-ready`, details: { from: row.order.status, to: "ready" } });
          }
        }
      });
      return { success: true };
    }),
    assignChef: protectedProcedure.input(z.object({ orderItemId: z.number().int().positive(), chefId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
      roles("admin", "manager", "chef")(ctx.user.role); const db = await getDb(); if (!db) throw failDb();
      const [row] = await db.select({ item: orderItems, order: orders }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).where(eq(orderItems.id, input.orderItemId)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" }); requireBranchAccess(ctx.user.role, ctx.user.branchId, row.order.branchId);
      const chefId = ctx.user.role === "chef" ? ctx.user.id : input.chefId;
      if (!chefId) throw new TRPCError({ code: "BAD_REQUEST", message: "حدد شيفاً متاحاً." });
      const [chef] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, chefId), eq(users.role, "chef"), eq(users.branchId, row.order.branchId), eq(users.isAvailable, true))).limit(1);
      if (!chef) throw new TRPCError({ code: "BAD_REQUEST", message: "الشيف غير متاح لهذا الفرع." });
      await db.transaction(async (tx: any) => { await tx.update(orderItems).set({ assignedChefId: chefId, assignedAt: new Date() }).where(eq(orderItems.id, input.orderItemId)); await tx.insert(auditLogs).values({ actorId: ctx.user.id, branchId: row.order.branchId, action: "CHEF_ASSIGNED", entityType: "order_item", entityId: String(input.orderItemId), details: { chefId } }); });
      return { success: true, chefId };
    }),
  }),
  inventory: router({
    list: protectedProcedure.query(async ({ ctx }) => { roles("admin", "manager", "inventory")(ctx.user.role); const db = await getDb(); if (!db) throw failDb(); if (ctx.user.role !== "admin" && !ctx.user.branchId) throw new TRPCError({ code: "FORBIDDEN" }); return db.select().from(inventoryItems).where(ctx.user.role === "admin" ? undefined : eq(inventoryItems.branchId, ctx.user.branchId!)).orderBy(asc(inventoryItems.name)); }),
    lowStock: protectedProcedure.query(async ({ ctx }) => { roles("admin", "manager", "inventory")(ctx.user.role); const db = await getDb(); if (!db) throw failDb(); return db.select().from(inventoryItems).where(and(ctx.user.role === "admin" ? undefined : eq(inventoryItems.branchId, ctx.user.branchId!), isNotNull(inventoryItems.quantity), isNotNull(inventoryItems.lowStockThreshold), lte(inventoryItems.quantity, inventoryItems.lowStockThreshold))).orderBy(asc(inventoryItems.name)); }),
    upsert: protectedProcedure.input(z.object({ id: z.number().int().positive().optional(), branchId: z.number().int().positive().optional(), name: z.string().trim().min(1).max(180), unit: z.string().trim().min(1).max(32), quantity: z.number().nonnegative().nullable().optional(), lowStockThreshold: z.number().nonnegative().nullable().optional(), unitCost: z.number().int().nonnegative().nullable().optional(), supplier: z.string().trim().max(180).nullable().optional(), replenishedAt: z.coerce.date().nullable().optional() })).mutation(async ({ ctx, input }) => {
      roles("admin", "manager", "inventory")(ctx.user.role); const db = await getDb(); if (!db) throw failDb(); const branchId = ctx.user.role === "admin" ? input.branchId : ctx.user.branchId; if (!branchId) throw new TRPCError({ code: "BAD_REQUEST", message: "الفرع مطلوب." });
      const values = { name: input.name, unit: input.unit, quantity: input.quantity === undefined ? undefined : input.quantity === null ? null : String(input.quantity), lowStockThreshold: input.lowStockThreshold === undefined ? undefined : input.lowStockThreshold === null ? null : String(input.lowStockThreshold), unitCost: input.unitCost, supplier: input.supplier, replenishedAt: input.replenishedAt };
      if (input.id) { await db.update(inventoryItems).set(values).where(and(eq(inventoryItems.id, input.id), eq(inventoryItems.branchId, branchId))); return { id: input.id }; }
      const r = await db.insert(inventoryItems).values({ branchId, ...values, quantity: input.quantity == null ? null : String(input.quantity), lowStockThreshold: input.lowStockThreshold == null ? null : String(input.lowStockThreshold) }); return { id: Number((r as any).insertId) };
    }),
  }),
  driver: router({
    assignedOrders: protectedProcedure.query(async ({ ctx }) => { roles("driver")(ctx.user.role); const db = await getDb(); if (!db) throw failDb(); return db.select().from(orders).where(and(eq(orders.driverId, ctx.user.id), inArray(orders.status, ["ready", "out_for_delivery"]))).orderBy(desc(orders.createdAt)); }),
    locationUpdate: protectedProcedure.input(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })).mutation(async ({ ctx, input }) => { roles("driver")(ctx.user.role); const db = await getDb(); if (!db) throw failDb(); await db.insert(driverLocations).values({ driverId: ctx.user.id, branchId: ctx.user.branchId, latitude: input.lat, longitude: input.lng }); return { success: true }; }),
    fleet: protectedProcedure.query(async ({ ctx }) => { roles("admin", "manager")(ctx.user.role); const db = await getDb(); if (!db) throw failDb(); const drivers = await db.select({ driverId: users.id, name: users.name, branchId: users.branchId }).from(users).where(and(eq(users.role, "driver"), ctx.user.role === "manager" ? eq(users.branchId, ctx.user.branchId!) : undefined)); return Promise.all(drivers.map(async (driver: any) => { const [loc] = await db.select().from(driverLocations).where(and(eq(driverLocations.driverId, driver.driverId), eq(driverLocations.branchId, driver.branchId))).orderBy(desc(driverLocations.recordedAt)).limit(1); const freshness = locationFreshness(loc?.recordedAt ?? null); return { ...driver, latitude: loc?.latitude ?? null, longitude: loc?.longitude ?? null, recordedAt: loc?.recordedAt ?? null, ageMs: freshness.ageMs, isLive: freshness.isLive }; })); }),
    completeDelivery: protectedProcedure.input(z.object({ orderId: z.number().int().positive(), cashCollected: z.number().int().nonnegative() })).mutation(async ({ ctx, input }) => {
      roles("driver")(ctx.user.role); const db = await getDb(); if (!db) throw failDb();
      const [order] = await db.select().from(orders).where(and(eq(orders.id, input.orderId), eq(orders.driverId, ctx.user.id))).limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.status === "completed") return { success: true, status: "completed", idempotent: true };
      if (order.status !== "out_for_delivery") throw new TRPCError({ code: "CONFLICT", message: "يجب بدء التوصيل قبل تأكيد التسليم." });
      if (order.paymentMethod === "cash" && input.cashCollected !== order.total) throw new TRPCError({ code: "BAD_REQUEST", message: "يجب مطابقة النقد المستلم مع إجمالي الطلب." });
      if (order.paymentMethod !== "cash" && input.cashCollected !== 0) throw new TRPCError({ code: "BAD_REQUEST", message: "لا تسجل تحصيلاً نقدياً لطلب غير نقدي." });
      let pointsEarned = 0;
      await db.transaction(async (tx: any) => {
        const paymentStatus = order.paymentMethod === "cash" ? "paid" : order.paymentStatus;
        const changed = await tx.update(orders).set({ status: "completed", paymentStatus }).where(and(eq(orders.id, order.id), eq(orders.status, "out_for_delivery")));
        if (Number(changed.affectedRows ?? 0) !== 1) throw new TRPCError({ code: "CONFLICT", message: "تغيرت حالة الطلب؛ حدّث القائمة." });
        await tx.insert(auditLogs).values({ actorId: ctx.user.id, branchId: order.branchId, action: "ORDER_STATUS_UPDATED", entityType: "order", entityId: String(order.id), idempotencyKey: `order-status-${order.id}-completed`, details: { from: order.status, to: "completed" } });
        if (order.paymentMethod === "cash") {
          await tx.insert(journalEntries).values({ branchId: order.branchId, userId: ctx.user.id, entryType: "driver_settlement", amount: input.cashCollected, referenceType: "order", referenceId: order.id, idempotencyKey: `driver-order-cash-${order.id}` }).onDuplicateKeyUpdate({ set: { idempotencyKey: `driver-order-cash-${order.id}` } });
          await tx.insert(auditLogs).values({ actorId: ctx.user.id, branchId: order.branchId, action: "DRIVER_CASH_SETTLED", entityType: "order", entityId: String(order.id), idempotencyKey: `driver-cash-audit-${order.id}`, details: { amount: input.cashCollected } }).onDuplicateKeyUpdate({ set: { idempotencyKey: `driver-cash-audit-${order.id}` } });
        }
        const [setting] = await tx.select().from(appSettings).where(eq(appSettings.settingKey, "loyalty_earning")).limit(1); const config = asObject(setting?.value);
        const spendPerPoint = Number(config?.spendPerPoint); const pointsPerThreshold = Number(config?.pointsPerThreshold);
        if (Number.isSafeInteger(spendPerPoint) && spendPerPoint > 0 && Number.isSafeInteger(pointsPerThreshold) && pointsPerThreshold > 0) {
          pointsEarned = Math.floor(order.total / spendPerPoint) * pointsPerThreshold;
          if (pointsEarned > 0) { await tx.update(users).set({ points: sql`${users.points} + ${pointsEarned}` }).where(eq(users.id, order.userId)); await tx.insert(auditLogs).values({ actorId: ctx.user.id, branchId: order.branchId, action: "LOYALTY_POINTS_EARNED", entityType: "user", entityId: String(order.userId), idempotencyKey: `loyalty-earn-order-${order.id}`, details: { orderId: order.id, points: pointsEarned } }); }
        }
      });
      return { success: true, status: "completed", cashCollected: input.cashCollected, pointsEarned };
    }),
  }),
  shifts: router({
    current: protectedProcedure.query(async ({ ctx }) => { const db = await getDb(); if (!db) throw failDb(); return (await db.select().from(shifts).where(and(eq(shifts.userId, ctx.user.id), eq(shifts.status, "open"))).orderBy(desc(shifts.startedAt)).limit(1))[0] ?? null; }),
    my: protectedProcedure.query(async ({ ctx }) => { const db = await getDb(); if (!db) throw failDb(); return (await db.select().from(shifts).where(and(eq(shifts.userId, ctx.user.id), eq(shifts.status, "open"))).orderBy(desc(shifts.startedAt)).limit(1))[0] ?? null; }),
    start: protectedProcedure.input(z.object({ branchId: z.number().optional(), openingCash: z.number().int().nonnegative().optional(), notes: z.string().max(500).optional() })).mutation(async ({ ctx, input }) => { staff(ctx.user.role); const db = await getDb(); if (!db) throw failDb(); const branchId = ctx.user.role === "admin" || ctx.user.role === "manager" ? input.branchId : ctx.user.branchId; if (!branchId) throw new TRPCError({ code: "BAD_REQUEST", message: "الفرع مطلوب." }); requireBranchAccess(ctx.user.role, ctx.user.branchId, branchId); const [open] = await db.select().from(shifts).where(and(eq(shifts.userId, ctx.user.id), eq(shifts.status, "open"))).limit(1); if (open) throw new TRPCError({ code: "CONFLICT", message: "لديك وردية مفتوحة." }); const r = await db.insert(shifts).values({ userId: ctx.user.id, branchId, openingCash: input.openingCash ?? null, notes: input.notes ?? null }); return { id: Number((r as any).insertId) }; }),
    end: protectedProcedure.input(z.object({ shiftId: z.number().int().positive(), closingCash: z.number().int().nonnegative(), notes: z.string().max(500).optional() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw failDb(); const [s] = await db.select().from(shifts).where(eq(shifts.id, input.shiftId)).limit(1); if (!s || s.status !== "open" || s.userId !== ctx.user.id && ctx.user.role !== "admin" && ctx.user.role !== "manager") throw new TRPCError({ code: "FORBIDDEN" }); if (ctx.user.role === "manager") requireBranchAccess(ctx.user.role, ctx.user.branchId, s.branchId); await db.update(shifts).set({ status: "closed", endedAt: new Date(), closingCash: input.closingCash, notes: input.notes ?? s.notes }).where(eq(shifts.id, s.id)); return { success: true }; }),
    zReport: protectedProcedure.input(z.object({ branchId: z.number().optional(), from: z.date().optional(), to: z.date().optional() }).optional()).query(async ({ ctx, input }) => { reportStaff(ctx.user.role); const db = await getDb(); if (!db) throw failDb(); const branchId = ctx.user.role === "admin" || ctx.user.role === "manager" ? input?.branchId : ctx.user.branchId; if (!branchId) throw new TRPCError({ code: "FORBIDDEN" }); requireBranchAccess(ctx.user.role, ctx.user.branchId, branchId); const from = input?.from ?? new Date(new Date().setHours(0, 0, 0, 0)); const to = input?.to ?? new Date(); const sold = await db.select({ method: orders.paymentMethod, total: sql<number>`COALESCE(SUM(${orders.total}),0)`, count: sql<number>`COUNT(*)` }).from(orders).where(and(eq(orders.branchId, branchId), eq(orders.status, "completed"), sql`${orders.createdAt} BETWEEN ${from} AND ${to}`)).groupBy(orders.paymentMethod); const salesTotal = sold.reduce((n: number, r: any) => n + Number(r.total ?? 0), 0); const cashSales = sold.filter((r: any) => r.method === "cash").reduce((n: number, r: any) => n + Number(r.total ?? 0), 0); const electronicSales = sold.filter((r: any) => ["electronic", "card", "online", "wallet", "bank_transfer"].includes((r.method ?? "").toLowerCase())).reduce((n: number, r: any) => n + Number(r.total ?? 0), 0); const unclassifiedSales = salesTotal - cashSales - electronicSales; const spent = await db.select({ total: sql<number>`COALESCE(SUM(${expenses.amount}),0)` }).from(expenses).where(and(eq(expenses.branchId, branchId), sql`${expenses.createdAt} BETWEEN ${from} AND ${to}`)); const boxes = await db.select().from(cashBoxes).where(and(eq(cashBoxes.branchId, branchId), eq(cashBoxes.isActive, true))); const settlements = await db.select({ total: sql<number>`COALESCE(SUM(${journalEntries.amount}),0)` }).from(journalEntries).where(and(eq(journalEntries.branchId, branchId), eq(journalEntries.entryType, "driver_settlement"), sql`${journalEntries.createdAt} BETWEEN ${from} AND ${to}`)); return { branchId, from, to, salesTotal, cashSales, electronicSales, unclassifiedSales, completedOrders: sold.reduce((n: number, r: any) => n + Number(r.count ?? 0), 0), expenses: Number(spent[0]?.total ?? 0), expectedNetCash: cashSales - Number(spent[0]?.total ?? 0), driverSettlements: Number(settlements[0]?.total ?? 0), activeCashBoxes: boxes }; }),
  }),
  expenses: router({
    create: protectedProcedure.input(z.object({ amount: z.number().int().positive(), reason: z.string().trim().min(1).max(2000), shiftId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => { staff(ctx.user.role); if (!ctx.user.branchId) throw new TRPCError({ code: "FORBIDDEN", message: "لا يوجد فرع مرتبط بالحساب." }); const db = await getDb(); if (!db) throw failDb(); if (input.shiftId) { const [shift] = await db.select().from(shifts).where(and(eq(shifts.id, input.shiftId), eq(shifts.userId, ctx.user.id), eq(shifts.branchId, ctx.user.branchId), eq(shifts.status, "open"))).limit(1); if (!shift) throw new TRPCError({ code: "FORBIDDEN", message: "الوردية غير مفتوحة أو لا تخص المستخدم." }); } const r = await db.transaction(async (tx: any) => { const ins = await tx.insert(expenses).values({ branchId: ctx.user.branchId, userId: ctx.user.id, shiftId: input.shiftId ?? null, amount: input.amount, reason: input.reason }); const id = Number(ins.insertId); await tx.insert(auditLogs).values({ actorId: ctx.user.id, branchId: ctx.user.branchId, action: "EXPENSE_CREATED", entityType: "expense", entityId: String(id), details: { amount: input.amount, reason: input.reason, shiftId: input.shiftId ?? null } }); return id; }); return { id: r }; }),
    list: protectedProcedure.input(z.object({ branchId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => { reportStaff(ctx.user.role); const db = await getDb(); if (!db) throw failDb(); const branchId = ctx.user.role === "admin" || ctx.user.role === "manager" || ctx.user.role === "accountant" ? input?.branchId ?? ctx.user.branchId : ctx.user.branchId; if (!branchId) throw new TRPCError({ code: "FORBIDDEN" }); requireBranchAccess(ctx.user.role, ctx.user.branchId, branchId); return db.select().from(expenses).where(eq(expenses.branchId, branchId)).orderBy(desc(expenses.createdAt)).limit(500); }),
  }),
  returns: router({
    create: protectedProcedure.input(z.object({ orderId: z.number().int().positive(), reason: z.string().trim().min(1).max(2000), amount: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw failDb(); const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1); if (!order || order.status !== "completed" || input.amount > order.total) throw new TRPCError({ code: "BAD_REQUEST", message: "الطلب أو مبلغ الإرجاع غير صالح." }); const isOwner = order.userId === ctx.user.id; if (!isOwner) { staff(ctx.user.role); requireBranchAccess(ctx.user.role, ctx.user.branchId, order.branchId); } const id = await db.transaction(async (tx: any) => { const r = await tx.insert(returnOrders).values({ orderId: order.id, userId: ctx.user.id, reason: input.reason, amount: input.amount, status: "requested" }); const returnId = Number(r.insertId); await tx.insert(auditLogs).values({ actorId: ctx.user.id, branchId: order.branchId, action: "RETURN_CREATED", entityType: "return", entityId: String(returnId), details: { orderId: order.id, amount: input.amount } }); return returnId; }); return { id, status: "requested" as const }; }),
    list: protectedProcedure.input(z.object({ branchId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw failDb(); if ((STAFF_ROLES as readonly string[]).includes(ctx.user.role)) { staff(ctx.user.role); const branchId = ctx.user.role === "admin" || ctx.user.role === "manager" ? input?.branchId : ctx.user.branchId; if (!branchId) throw new TRPCError({ code: "FORBIDDEN" }); requireBranchAccess(ctx.user.role, ctx.user.branchId, branchId); return db.select({ returnOrder: returnOrders, order: orders }).from(returnOrders).innerJoin(orders, eq(orders.id, returnOrders.orderId)).where(eq(orders.branchId, branchId)).orderBy(desc(returnOrders.createdAt)).limit(500); } return db.select().from(returnOrders).where(eq(returnOrders.userId, ctx.user.id)).orderBy(desc(returnOrders.createdAt)).limit(200); }),
    update: protectedProcedure.input(z.object({ returnId: z.number().int().positive(), status: z.enum(["requested", "pending", "approved", "rejected", "processed"]) })).mutation(async ({ ctx, input }) => { roles("admin", "manager")(ctx.user.role); const db = await getDb(); if (!db) throw failDb(); const [r] = await db.select({ ret: returnOrders, order: orders }).from(returnOrders).innerJoin(orders, eq(orders.id, returnOrders.orderId)).where(eq(returnOrders.id, input.returnId)).limit(1); if (!r) throw new TRPCError({ code: "NOT_FOUND" }); requireBranchAccess(ctx.user.role, ctx.user.branchId, r.order.branchId); if (!returnTransitionAllowed(r.ret.status, input.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "انتقال حالة الإرجاع غير مسموح." }); await db.transaction(async (tx: any) => { await tx.update(returnOrders).set({ status: input.status }).where(eq(returnOrders.id, input.returnId)); await tx.insert(auditLogs).values({ actorId: ctx.user.id, branchId: r.order.branchId, action: "RETURN_STATUS_UPDATED", entityType: "return", entityId: String(input.returnId), details: { from: r.ret.status, to: input.status } }); }); return { success: true, status: input.status }; }),
  }),
  promotions: router({
    list: protectedProcedure.input(z.object({ branchId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => { reportStaff(ctx.user.role); const db = await getDb(); if (!db) throw failDb(); const branchId = ctx.user.role === "admin" || ctx.user.role === "manager" ? input?.branchId : ctx.user.branchId; if (ctx.user.role !== "admin" && ctx.user.role !== "manager" && !ctx.user.branchId) throw new TRPCError({ code: "FORBIDDEN" }); if (branchId) requireBranchAccess(ctx.user.role, ctx.user.branchId, branchId); return db.select().from(promotions).where(branchId ? or(eq(promotions.branchId, branchId), sql`${promotions.branchId} IS NULL`) : undefined).orderBy(asc(promotions.name)); }),
    create: protectedProcedure.input(z.object({ branchId: z.number().int().positive().optional(), name: z.string().trim().min(1).max(180), code: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/), description: z.string().max(2000).optional(), discountPercent: z.number().int().min(1).max(100).optional(), discountAmount: z.number().int().positive().optional(), minimumOrder: z.number().int().nonnegative().default(0), startsAt: z.date().optional(), endsAt: z.date().optional(), isActive: z.boolean().default(false) }).refine(v => !!v.discountPercent !== !!v.discountAmount, "حدد نوع خصم واحداً فقط").refine(v => !v.startsAt || !v.endsAt || v.endsAt >= v.startsAt, "فترة الصلاحية غير صحيحة")).mutation(async ({ ctx, input }) => { roles("admin", "manager")(ctx.user.role); const db = await getDb(); if (!db) throw failDb(); const branchId = ctx.user.role === "admin" ? input.branchId ?? null : ctx.user.branchId; if (ctx.user.role === "manager") { if (!branchId) throw new TRPCError({ code: "BAD_REQUEST", message: "الفرع مطلوب." }); requireBranchAccess(ctx.user.role, ctx.user.branchId, branchId); } try { const r = await db.insert(promotions).values({ branchId, name: input.name, code: input.code.toUpperCase(), description: input.description ?? null, discountPercent: input.discountPercent ?? null, discountAmount: input.discountAmount ?? null, minimumOrder: input.minimumOrder, startsAt: input.startsAt ?? null, endsAt: input.endsAt ?? null, isActive: input.isActive }); const id = Number((r as any).insertId); await db.insert(auditLogs).values({ actorId: ctx.user.id, branchId, action: "PROMOTION_CREATED", entityType: "promotion", entityId: String(id), details: { code: input.code.toUpperCase(), isActive: input.isActive } }); return { id }; } catch (e: any) { if (e?.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "رمز الكوبون مسجل مسبقاً." }); throw e; } }),
  }),
  admin: router({
    exportBackup: adminProcedure.input(z.object({ branchId: z.number().int().positive().optional() }).optional()).mutation(async ({ input }) => {
      const db = await getDb(); if (!db) throw failDb(); const branchId = input?.branchId; const branchFilter = branchId ? eq(branches.id, branchId) : undefined;
      const branchRows = await db.select().from(branches).where(branchFilter);
      if (branchId && branchRows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "الفرع غير موجود." });
      const orderFilter = branchId ? eq(orders.branchId, branchId) : undefined;
      const [userRows, categoryRows, menuRows, orderRows, inventoryRows, promotionRows, shiftRows, boxRows, expenseRows, journalRows, auditRows, locationRows, settingRows] = await Promise.all([
        db.select({ id: users.id, openId: users.openId, phone: users.phone, name: users.name, email: users.email, role: users.role, branchId: users.branchId, points: users.points, isAvailable: users.isAvailable, mustChangePassword: users.mustChangePassword, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).where(branchId ? eq(users.branchId, branchId) : undefined),
        db.select().from(categories),
        db.select().from(menuItems).where(branchId ? eq(menuItems.branchId, branchId) : undefined),
        db.select().from(orders).where(orderFilter),
        db.select().from(inventoryItems).where(branchId ? eq(inventoryItems.branchId, branchId) : undefined),
        db.select().from(promotions).where(branchId ? or(sql`${promotions.branchId} IS NULL`, eq(promotions.branchId, branchId)) : undefined),
        db.select().from(shifts).where(branchId ? eq(shifts.branchId, branchId) : undefined),
        db.select().from(cashBoxes).where(branchId ? eq(cashBoxes.branchId, branchId) : undefined),
        db.select().from(expenses).where(branchId ? eq(expenses.branchId, branchId) : undefined),
        db.select().from(journalEntries).where(branchId ? eq(journalEntries.branchId, branchId) : undefined),
        db.select().from(auditLogs).where(branchId ? eq(auditLogs.branchId, branchId) : undefined),
        db.select().from(driverLocations).where(branchId ? eq(driverLocations.branchId, branchId) : undefined),
        db.select({ settingKey: appSettings.settingKey, value: appSettings.value, updatedAt: appSettings.updatedAt }).from(appSettings).where(inArray(appSettings.settingKey, ["delivery_zones", "loyalty_earning", "loyalty_redemption"])),
      ]);
      const orderIds = orderRows.map((order) => order.id);
      const orderItemRows = orderIds.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)) : [];
      const returnRows = orderIds.length ? await db.select().from(returnOrders).where(inArray(returnOrders.orderId, orderIds)) : [];
      return { schemaVersion: 1, exportedAt: new Date().toISOString(), scope: branchId ? { branchId, branch: branchRows[0] } : { branchId: null, branch: null }, data: { branches: branchRows, users: userRows, categories: categoryRows, menuItems: menuRows, orders: orderRows, orderItems: orderItemRows, inventoryItems: inventoryRows, promotions: promotionRows, returnOrders: returnRows, shifts: shiftRows, cashBoxes: boxRows, expenses: expenseRows, journalEntries: journalRows, auditLogs: auditRows, driverLocations: locationRows, settings: settingRows } };
    }),
    settings: adminProcedure.query(async () => { const db = await getDb(); if (!db) throw failDb(); return db.select().from(appSettings); }),
    setSetting: adminProcedure.input(adminSettingSchema).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw failDb(); await db.transaction(async (tx: any) => { await tx.insert(appSettings).values({ settingKey: input.key, value: input.value, updatedBy: ctx.user.id }).onDuplicateKeyUpdate({ set: { value: input.value, updatedBy: ctx.user.id } }); await tx.insert(auditLogs).values({ actorId: ctx.user.id, action: "APP_SETTING_UPDATED", entityType: "app_setting", entityId: input.key, details: { key: input.key } }); }); return { success: true }; }),
    users: adminProcedure.query(async () => { const db = await getDb(); if (!db) throw failDb(); return db.select({ id: users.id, phone: users.phone, name: users.name, role: users.role, branchId: users.branchId, points: users.points, isAvailable: users.isAvailable, mustChangePassword: users.mustChangePassword, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).orderBy(asc(users.id)).limit(500); }),
    createStaff: adminProcedure.input(z.object({ phone: z.string().trim().regex(/^7\d{8}$/), name: z.string().trim().min(1).max(120), role: z.enum(["manager", "cashier", "chef", "waiter", "driver", "inventory", "accountant"]), branchId: z.number().int().positive(), temporaryPassword: z.string().min(10).max(128) }).strict()).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw failDb(); await getBranch(db, input.branchId); const passwordHash = await bcrypt.hash(input.temporaryPassword, 12); try { const result = await db.transaction(async (tx: any) => { const inserted = await tx.insert(users).values({ openId: `staff:${input.phone}`, phone: input.phone, name: input.name, passwordHash, role: input.role, branchId: input.branchId, loginMethod: "phone", mustChangePassword: true }); const id = Number(inserted.insertId); await tx.insert(auditLogs).values({ actorId: ctx.user.id, branchId: input.branchId, action: "STAFF_CREATED", entityType: "user", entityId: String(id), details: { role: input.role } }); return id; }); return { id: result }; } catch (error: any) { if (error?.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "رقم الهاتف مسجل مسبقاً." }); throw error; } }),
    audit: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(200).default(100) }).optional()).query(async ({ input }) => { const db = await getDb(); if (!db) throw failDb(); return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(input?.limit ?? 100); }),
    setAvailability: adminProcedure.input(z.object({ userId: z.number().int().positive(), isAvailable: z.boolean() })).mutation(async ({ ctx, input }) => { if (input.userId === ctx.user.id && !input.isAvailable) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن إيقاف الحساب الإداري المستخدم حالياً." }); const db = await getDb(); if (!db) throw failDb(); const [target] = await db.select({ branchId: users.branchId }).from(users).where(eq(users.id, input.userId)).limit(1); if (!target) throw new TRPCError({ code: "NOT_FOUND" }); await db.transaction(async (tx: any) => { await tx.update(users).set({ isAvailable: input.isAvailable }).where(eq(users.id, input.userId)); await tx.insert(auditLogs).values({ actorId: ctx.user.id, branchId: target.branchId, action: "STAFF_AVAILABILITY_UPDATED", entityType: "user", entityId: String(input.userId), details: { isAvailable: input.isAvailable } }); }); return { success: true }; }),
  }),
});
