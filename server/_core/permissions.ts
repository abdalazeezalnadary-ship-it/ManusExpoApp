export const PERMISSION_KEYS = [
  "orders.create", "orders.read", "orders.update", "orders.assign",
  "menu.read", "menu.write", "kitchen.read", "kitchen.update", "kitchen.assign",
  "inventory.read", "inventory.write", "fleet.read", "driver.operate",
  "shifts.manage", "finance.read", "expenses.create", "returns.read", "returns.create", "returns.manage",
  "promotions.read", "promotions.write", "admin.manage",
] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];
export const ROLE_KEYS = ["user", "admin", "manager", "cashier", "chef", "waiter", "driver", "inventory", "accountant", "customer"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];
export type RoleGrants = Record<PermissionKey, RoleKey[]>;

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  "orders.create": "إنشاء الطلبات", "orders.read": "عرض طلبات الفرع", "orders.update": "تحديث حالات الطلبات", "orders.assign": "تعيين الموصلين",
  "menu.read": "عرض إدارة المنيو", "menu.write": "تعديل الأصناف والأسعار", "kitchen.read": "عرض شاشة المطبخ", "kitchen.update": "تحديث حالة أصناف المطبخ", "kitchen.assign": "تعيين الشيفات",
  "inventory.read": "عرض المخزون", "inventory.write": "إدارة المخزون", "fleet.read": "عرض الأسطول", "driver.operate": "تنفيذ عمليات الموصل", "shifts.manage": "إدارة الورديات", "finance.read": "عرض التقارير المالية التشغيلية", "expenses.create": "تسجيل المصروفات", "returns.read": "عرض المرتجعات", "returns.create": "إنشاء طلب إرجاع", "returns.manage": "تحديث حالات المرتجعات", "promotions.read": "عرض الكوبونات", "promotions.write": "إنشاء الكوبونات", "admin.manage": "إدارة النظام والحسابات والفروع والتدقيق",
};
export const ROLE_LABELS: Record<RoleKey, string> = { user: "مستخدم", admin: "مدير عام", manager: "مدير فرع", cashier: "كاشير", chef: "شيف مطبخ", waiter: "مضيف صالة", driver: "موصل طلبات", inventory: "مسؤول مخزون", accountant: "محاسب", customer: "عميل" };
const staff = ["admin", "manager", "cashier", "chef", "waiter", "driver", "inventory"] as RoleKey[];
const reportStaff = [...staff, "accountant"] as RoleKey[];
export const DEFAULT_ROLE_GRANTS: RoleGrants = {
  "orders.create": ["user", "customer", ...staff],
  "orders.read": staff,
  "orders.update": staff,
  "orders.assign": ["admin", "manager"],
  "menu.read": ["admin", "manager"],
  "menu.write": ["admin", "manager"],
  "kitchen.read": ["admin", "manager", "cashier", "chef", "waiter"],
  "kitchen.update": ["admin", "manager", "chef", "waiter"],
  "kitchen.assign": ["admin", "manager", "chef"],
  "inventory.read": ["admin", "manager", "inventory"],
  "inventory.write": ["admin", "manager", "inventory"],
  "fleet.read": ["admin", "manager"],
  "driver.operate": ["driver"],
  "shifts.manage": ["admin", "manager", "cashier", "chef", "waiter", "driver", "inventory"],
  "finance.read": reportStaff,
  "expenses.create": staff,
  "returns.read": [...staff, "customer", "user"],
  "returns.create": [...staff, "customer", "user"],
  "returns.manage": ["admin", "manager"],
  "promotions.read": reportStaff,
  "promotions.write": ["admin", "manager"],
  "admin.manage": ["admin"],
};
const ROUTE_PERMISSIONS: Record<string, PermissionKey> = {
  "orders.create": "orders.create", "orders.list": "orders.read", "orders.assignDriver": "orders.assign", "orders.updateStatus": "orders.update",
  "menu.manageList": "menu.read", "menu.updateItem": "menu.write",
  "kds.list": "kitchen.read", "kds.updateItemStatus": "kitchen.update", "kds.availableChefs": "kitchen.assign", "kds.assignChef": "kitchen.assign",
  "inventory.list": "inventory.read", "inventory.lowStock": "inventory.read", "inventory.upsert": "inventory.write",
  "driver.fleet": "fleet.read", "driver.assignedOrders": "driver.operate", "driver.locationUpdate": "driver.operate", "driver.completeDelivery": "driver.operate",
  "shifts.start": "shifts.manage", "shifts.end": "shifts.manage", "shifts.zReport": "finance.read",
  "expenses.create": "expenses.create", "expenses.list": "finance.read",
  "returns.list": "returns.read", "returns.create": "returns.create", "returns.update": "returns.manage",
  "promotions.list": "promotions.read", "promotions.create": "promotions.write",
};

export function permissionForProcedure(path: string): PermissionKey | null {
  if (path.startsWith("admin.")) return "admin.manage";
  return ROUTE_PERMISSIONS[path] ?? null;
}

export function parseRoleGrants(value: unknown): RoleGrants | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const parsed = {} as RoleGrants;
  for (const key of PERMISSION_KEYS) {
    const roles = source[key];
    if (!Array.isArray(roles) || roles.some((role) => typeof role !== "string" || !(ROLE_KEYS as readonly string[]).includes(role))) return null;
    parsed[key] = [...new Set(roles as RoleKey[])];
  }
  if (Object.keys(source).some((key) => !(PERMISSION_KEYS as readonly string[]).includes(key))) return null;
  return parsed;
}

export function hasRolePermission(role: string, permission: PermissionKey, grants: RoleGrants): boolean {
  if (role === "admin") return true;
  return grants[permission]?.includes(role as RoleKey) ?? false;
}
