import { SignJWT, jwtVerify } from "jose";
import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { users, type User } from "../../drizzle/schema";
import { getDb } from "../db";

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "مصادقة التطبيق غير مهيأة بمفتاح توقيع آمن." });
  return new Uint8Array(createHmac("sha256", secret).update("dreamcity-app-session-v1").digest());
}
export async function signStaffToken(user: User): Promise<string> {
  return new SignJWT({ kind: "dreamcity-staff", uid: user.id }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("12h").sign(secretKey());
}
export async function authenticateStaffBearer(req: Request): Promise<User | null> {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  // Inspect only the untrusted marker to distinguish token families; acceptance
  // still requires a valid signature below.
  let staffMarker = false;
  try {
    staffMarker = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")).kind === "dreamcity-staff";
  } catch {
    return null;
  }
  if (!staffMarker) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (payload.kind !== "dreamcity-staff" || typeof payload.uid !== "number") return null;
    const db = await getDb();
    if (!db) return null;
    const [user] = await db.select().from(users).where(eq(users.id, payload.uid)).limit(1);
    return user?.isAvailable ? user : null;
  } catch (e) {
    if (e instanceof TRPCError) throw e;
    return null;
  }
}
export function safeUser(user: User | null) {
  if (!user) return null;
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}
