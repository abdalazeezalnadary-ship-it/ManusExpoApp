import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { TRPCError } from "@trpc/server";
import { assertPasswordChanged } from "../server/_core/password-policy";
import menu from "../drizzle/seed/menu.json";

describe("staff password policy", () => {
  it("blocks protected operations until the initial password is changed", () => {
    expect(() => assertPasswordChanged({ mustChangePassword: true })).toThrow(TRPCError);
  });

  it("allows accounts without a pending password change", () => {
    expect(() => assertPasswordChanged({ mustChangePassword: false })).not.toThrow();
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
