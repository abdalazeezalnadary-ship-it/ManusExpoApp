import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { TRPCError } from "@trpc/server";
import { assertPasswordChanged } from "../server/_core/password-policy";
import { DEFAULT_ROLE_GRANTS, PERMISSION_KEYS, hasRolePermission, parseRoleGrants, permissionForProcedure } from "../server/_core/permissions";
import { assertActiveAdminRemains, assertBranchCanBeDeactivated } from "../server/routers/dreamcity-contracts";
import { kdsItemTransitionAllowed, orderStatusTransitionAllowed } from "../server/_core/order-policy";
import menu from "../drizzle/seed/menu.json";

describe("staff password policy", () => {
  it("blocks protected operations until the initial password is changed", () => {
    expect(() => assertPasswordChanged({ mustChangePassword: true })).toThrow(TRPCError);
  });

  it("allows accounts without a pending password change", () => {
    expect(() => assertPasswordChanged({ mustChangePassword: false })).not.toThrow();
  });
});

describe("central administration safety policies", () => {
  it("prevents branch deactivation while active orders or accounts remain", () => {
    expect(() => assertBranchCanBeDeactivated(1, 0)).toThrow(TRPCError);
    expect(() => assertBranchCanBeDeactivated(0, 1)).toThrow(TRPCError);
    expect(() => assertBranchCanBeDeactivated(0, 0)).not.toThrow();
  });

  it("requires at least one active general administrator to remain", () => {
    expect(() => assertActiveAdminRemains(0)).toThrow(TRPCError);
    expect(() => assertActiveAdminRemains(1)).not.toThrow();
  });
});

describe("configurable role permissions", () => {
  it("allows and denies configured actions by role and keeps the administrator unrestricted", () => {
    const grants = { ...DEFAULT_ROLE_GRANTS, "menu.write": ["admin", "manager"] as (typeof DEFAULT_ROLE_GRANTS)["menu.write"] };
    expect(hasRolePermission("manager", "menu.write", grants)).toBe(true);
    expect(hasRolePermission("cashier", "menu.write", grants)).toBe(false);
    expect(hasRolePermission("admin", "admin.manage", grants)).toBe(true);
  });

  it("fails closed for malformed or incomplete saved policies", () => {
    expect(parseRoleGrants({})).toBeNull();
    expect(parseRoleGrants({ ...DEFAULT_ROLE_GRANTS, "inventory.write": ["root"] })).toBeNull();
    expect(parseRoleGrants({ ...DEFAULT_ROLE_GRANTS, unexpected: ["admin"] })).toBeNull();
    expect(parseRoleGrants(DEFAULT_ROLE_GRANTS)).not.toBeNull();
  });

  it("maps protected procedures to permissions while reserving admin routes", () => {
    expect(permissionForProcedure("orders.assignDriver")).toBe("orders.assign");
    expect(permissionForProcedure("admin.saveRolePermissions")).toBe("admin.manage");
    expect(permissionForProcedure("auth.permissions")).toBeNull();
    expect(PERMISSION_KEYS).toContain("finance.read");
    expect(permissionForProcedure("inventory.upsert")).toBe("inventory.write");
  });

  it("validates legal workflow transitions independently of static role names", () => {
    expect(orderStatusTransitionAllowed({ from: "pending", to: "confirmed", orderType: "pickup", paymentMethod: "cash", paymentStatus: "unpaid", assignedDriverId: null, actorId: 17 })).toBe(true);
    expect(orderStatusTransitionAllowed({ from: "pending", to: "completed", orderType: "pickup", paymentMethod: "cash", paymentStatus: "unpaid", assignedDriverId: null, actorId: 17 })).toBe(false);
    expect(kdsItemTransitionAllowed({ from: "cooking", to: "ready" })).toBe(true);
  });
});

describe("official menu seed", () => {
  it("contains 293 main-branch items and does not define a Crispy Meals menu", () => {
    const count = menu.categories.reduce((total, category) => total + category.items.length, 0);
    const itemIds = menu.categories.flatMap((category) => category.items.map((item) => item.id));
    expect(count).toBe(293);
    expect(new Set(itemIds).size).toBe(293);
    expect(menu.branchScope).toBe("dream-city-main");
  });

  it("does not contain copied staff account seed data", () => {
    expect(existsSync("drizzle/seed/staff.json")).toBe(false);
  });
});
