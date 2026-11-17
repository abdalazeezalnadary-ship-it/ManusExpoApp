import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { TRPCError } from "@trpc/server";
import type { User } from "../../drizzle/schema";
import { authenticateStaffBearer } from "./staff-auth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;
  try {
    user = await authenticateStaffBearer(opts.req);
  } catch (error) {
    if (error instanceof TRPCError && error.code === "INTERNAL_SERVER_ERROR") throw error;
    // Invalid or absent bearer tokens remain unauthenticated for public procedures.
  }
  return { req: opts.req, res: opts.res, user };
}
