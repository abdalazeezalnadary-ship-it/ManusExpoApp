import { TRPCError } from "@trpc/server";

export const STAFF_ROLES = ["admin", "manager", "cashier", "chef", "waiter", "driver", "inventory"] as const;
export const REPORT_ROLES = [...STAFF_ROLES, "accountant"] as const;

export function requireRole(role: string, allowed: readonly string[]) {
  if (!allowed.includes(role)) throw new TRPCError({ code: "FORBIDDEN", message: "غير مصرح بهذا الإجراء." });
}

export function requireBranchAccess(role: string, userBranchId: number | null, targetBranchId: number) {
  if (role !== "admin" && userBranchId !== targetBranchId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن الوصول إلى بيانات فرع آخر." });
  }
}

export function assertUniqueOrderItems(items: readonly { menuItemId?: number; menuItemCode?: string }[]) {
  const keys = items.map(item => item.menuItemId ?? item.menuItemCode);
  if (new Set(keys).size !== keys.length) throw new TRPCError({ code: "BAD_REQUEST", message: "لا تكرر الصنف نفسه في الطلب." });
}

export function idempotentOrderReplay<T extends { userId: number }>(existing: T, callerId: number): T {
  if (existing.userId !== callerId) throw new TRPCError({ code: "CONFLICT", message: "معرف الطلب مستخدم." });
  return existing;
}

export function knownStockBalance(balance: unknown): balance is number | string {
  if (balance === null || balance === undefined || balance === "") return false;
  const value = Number(balance);
  return Number.isFinite(value) && value >= 0;
}

export function couponDiscount(promotion: { isActive: boolean; branchId: number | null; minimumOrder: number; discountPercent: number | null; discountAmount: number | null; startsAt: Date | null; endsAt: Date | null }, branchId: number, subtotal: number, now = new Date()): number {
  if (!promotion.isActive || (promotion.branchId !== null && promotion.branchId !== branchId)) throw new TRPCError({ code: "BAD_REQUEST", message: "الكوبون غير صالح لهذا الفرع." });
  if (promotion.startsAt && promotion.startsAt > now || promotion.endsAt && promotion.endsAt < now) throw new TRPCError({ code: "BAD_REQUEST", message: "الكوبون خارج فترة الصلاحية." });
  if (subtotal < promotion.minimumOrder) throw new TRPCError({ code: "BAD_REQUEST", message: "الطلب أقل من الحد الأدنى للكوبون." });
  if (promotion.discountPercent !== null && promotion.discountPercent > 0) return Math.min(subtotal, Math.floor(subtotal * Math.min(100, promotion.discountPercent) / 100));
  if (promotion.discountAmount !== null && promotion.discountAmount > 0) return Math.min(subtotal, promotion.discountAmount);
  throw new TRPCError({ code: "BAD_REQUEST", message: "قيمة خصم الكوبون غير مهيأة." });
}

export function returnTransitionAllowed(from: string, to: string): boolean {
  const transitions: Record<string, readonly string[]> = {
    requested: ["pending", "approved", "rejected"],
    pending: ["approved", "rejected"],
    approved: ["processed"],
    rejected: [],
    processed: [],
  };
  return transitions[from]?.includes(to) ?? false;
}

export function locationFreshness(recordedAt: Date | null, now = new Date(), liveWindowMs = 30_000) {
  if (!recordedAt) return { ageMs: null, isLive: false };
  const ageMs = Math.max(0, now.getTime() - recordedAt.getTime());
  return { ageMs, isLive: ageMs <= liveWindowMs };
}
