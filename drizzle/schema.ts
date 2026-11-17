import {
  boolean,
  decimal,
  double,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const branches = mysqlTable("branches", {
  id: int("id").autoincrement().primaryKey(),
  branchCode: varchar("branchCode", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 180 }).notNull(),
  city: varchar("city", { length: 100 }),
  address: text("address"),
  serviceType: text("serviceType"),
  phone: varchar("phone", { length: 32 }),
  latitude: double("latitude"),
  longitude: double("longitude"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 128 }).unique(),
  phone: varchar("phone", { length: 32 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: mysqlEnum("role", ["user", "admin", "manager", "cashier", "chef", "waiter", "driver", "inventory", "accountant", "customer"]).default("user").notNull(),
  branchId: int("branchId").references(() => branches.id),
  points: int("points").default(0).notNull(),
  walletBalance: int("walletBalance").default(0).notNull(),
  isAvailable: boolean("isAvailable").default(true).notNull(),
  mustChangePassword: boolean("mustChangePassword").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (table) => [index("users_branch_role_idx").on(table.branchId, table.role)]);
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  sourceKey: varchar("sourceKey", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 180 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  station: varchar("station", { length: 64 }),
  isActive: boolean("isActive").default(true).notNull(),
});

export const inventoryItems = mysqlTable("inventoryItems", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull().references(() => branches.id),
  name: varchar("name", { length: 180 }).notNull(),
  unit: varchar("unit", { length: 32 }).notNull(),
  quantity: decimal("quantity", { precision: 14, scale: 3 }),
  lowStockThreshold: decimal("lowStockThreshold", { precision: 14, scale: 3 }),
  unitCost: int("unitCost"),
  supplier: varchar("supplier", { length: 180 }),
  replenishedAt: timestamp("replenishedAt"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("inventory_branch_name_uq").on(table.branchId, table.name)]);

export const menuItems = mysqlTable("menuItems", {
  id: int("id").autoincrement().primaryKey(),
  sku: varchar("sku", { length: 100 }).notNull().unique(),
  branchId: int("branchId").notNull().references(() => branches.id),
  categoryId: int("categoryId").notNull().references(() => categories.id),
  inventoryItemId: int("inventoryItemId").references(() => inventoryItems.id),
  name: varchar("name", { length: 220 }).notNull(),
  price: int("price").notNull(),
  currency: varchar("currency", { length: 3 }).default("YER").notNull(),
  station: varchar("station", { length: 64 }),
  stock: int("stock"),
  isAvailable: boolean("isAvailable").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("menu_branch_category_idx").on(table.branchId, table.categoryId)]);

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  clientOrderId: varchar("clientOrderId", { length: 128 }).notNull().unique(),
  userId: int("userId").notNull().references(() => users.id),
  branchId: int("branchId").notNull().references(() => branches.id),
  orderType: mysqlEnum("orderType", ["delivery", "pickup", "dine_in"]).notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "preparing", "ready", "out_for_delivery", "completed", "cancelled"]).default("pending").notNull(),
  tableNumber: varchar("tableNumber", { length: 32 }),
  deliveryDetails: json("deliveryDetails").$type<Record<string, unknown> | null>(),
  splitMetadata: json("splitMetadata").$type<Record<string, unknown> | null>(),
  couponCode: varchar("couponCode", { length: 64 }),
  discountAmount: int("discountAmount").default(0).notNull(),
  deliveryFee: int("deliveryFee").default(0).notNull(),
  loyaltyPointsRedeemed: int("loyaltyPointsRedeemed").default(0).notNull(),
  subtotal: int("subtotal").notNull(),
  total: int("total").notNull(),
  currency: varchar("currency", { length: 3 }).default("YER").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 32 }),
  paymentStatus: varchar("paymentStatus", { length: 32 }).default("unpaid").notNull(),
  driverId: int("driverId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("orders_branch_status_idx").on(table.branchId, table.status), index("orders_user_idx").on(table.userId)]);

export const orderItems = mysqlTable("orderItems", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id),
  menuItemId: int("menuItemId").notNull().references(() => menuItems.id),
  itemName: varchar("itemName", { length: 220 }),
  quantity: int("quantity").notNull(),
  unitPrice: int("unitPrice").notNull(),
  lineTotal: int("lineTotal").notNull(),
  kdsStatus: varchar("kdsStatus", { length: 32 }).default("pending").notNull(),
  station: varchar("station", { length: 64 }),
  assignedChefId: int("assignedChefId").references(() => users.id),
  assignedAt: timestamp("assignedAt"),
}, (table) => [index("order_items_order_idx").on(table.orderId)]);

export const driverLocations = mysqlTable("driverLocations", {
  id: int("id").autoincrement().primaryKey(),
  driverId: int("driverId").notNull().references(() => users.id),
  branchId: int("branchId").references(() => branches.id),
  latitude: double("latitude").notNull(),
  longitude: double("longitude").notNull(),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
}, (table) => [index("driver_location_latest_idx").on(table.driverId, table.recordedAt)]);

export const shifts = mysqlTable("shifts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  branchId: int("branchId").notNull().references(() => branches.id),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
  openingCash: int("openingCash"),
  closingCash: int("closingCash"),
  notes: text("notes"),
  status: varchar("status", { length: 20 }).default("open").notNull(),
}, (table) => [index("shift_open_idx").on(table.branchId, table.status)]);

export const cashBoxes = mysqlTable("cashBoxes", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull().references(() => branches.id),
  name: varchar("name", { length: 100 }).notNull(),
  balance: int("balance").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
});

export const expenses = mysqlTable("expenses", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull().references(() => branches.id),
  shiftId: int("shiftId").references(() => shifts.id),
  userId: int("userId").notNull().references(() => users.id),
  amount: int("amount").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const journalEntries = mysqlTable("journalEntries", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull().references(() => branches.id),
  cashBoxId: int("cashBoxId").references(() => cashBoxes.id),
  shiftId: int("shiftId").references(() => shifts.id),
  userId: int("userId").references(() => users.id),
  entryType: varchar("entryType", { length: 32 }).notNull(),
  amount: int("amount").notNull(),
  referenceType: varchar("referenceType", { length: 40 }),
  referenceId: int("referenceId"),
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const promotions = mysqlTable("promotions", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").references(() => branches.id),
  name: varchar("name", { length: 180 }).notNull(),
  code: varchar("code", { length: 64 }).unique(),
  description: text("description"),
  discountPercent: int("discountPercent"),
  discountAmount: int("discountAmount"),
  minimumOrder: int("minimumOrder").default(0).notNull(),
  startsAt: timestamp("startsAt"),
  endsAt: timestamp("endsAt"),
  isActive: boolean("isActive").default(false).notNull(),
});

export const returnOrders = mysqlTable("returnOrders", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id),
  userId: int("userId").notNull().references(() => users.id),
  reason: text("reason").notNull(),
  amount: int("amount").notNull(),
  status: mysqlEnum("status", ["requested", "pending", "approved", "rejected", "processed"]).default("requested").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const appSettings = mysqlTable("appSettings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 120 }).notNull().unique(),
  value: json("value").$type<unknown>(),
  updatedBy: int("updatedBy").references(() => users.id),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  actorId: int("actorId").references(() => users.id),
  branchId: int("branchId").references(() => branches.id),
  action: varchar("action", { length: 64 }).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: varchar("entityId", { length: 128 }),
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).unique(),
  details: json("details").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
