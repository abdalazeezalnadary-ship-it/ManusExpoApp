import { UNAUTHED_ERR_MSG } from "../../shared/const.js";
import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { assertPasswordChanged } from "./password-policy";
import { appSettings } from "../../drizzle/schema";
import { getDb } from "../db";
import { DEFAULT_ROLE_GRANTS, hasRolePermission, parseRoleGrants, permissionForProcedure } from "./permissions";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const passwordChangeProcedure = t.procedure.use(requireUser);

const requirePasswordChanged = t.middleware(async (opts) => {
  assertPasswordChanged(opts.ctx.user);
  return opts.next();
});

const requireConfiguredPermission = t.middleware(async ({ ctx, path, next }) => {
  const user = ctx.user;
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  const permission = permissionForProcedure(path);
  if (!permission || user.role === "admin") return next();
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "تعذر التحقق من صلاحيات الحساب." });
  const [stored] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.settingKey, "role_permissions")).limit(1);
  const configured = stored ? parseRoleGrants(stored.value) : null;
  if (stored && !configured) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر قراءة سياسة الصلاحيات؛ أوقف الخادم الوصول لحماية البيانات." });
  const grants = configured ?? DEFAULT_ROLE_GRANTS;
  if (!hasRolePermission(user.role, permission, grants)) throw new TRPCError({ code: "FORBIDDEN", message: "لا يملك هذا الحساب صلاحية تنفيذ الإجراء." });
  return next();
});

export const protectedProcedure = passwordChangeProcedure.use(requirePasswordChanged).use(requireConfiguredPermission);

// Admin endpoints are authorized by the persisted admin.manage grant in protectedProcedure.
export const adminProcedure = protectedProcedure;
