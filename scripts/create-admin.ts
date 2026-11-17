import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { branches, users } from "../drizzle/schema";
import { getDb } from "../server/db";

async function main() {
  const name = process.env.INITIAL_ADMIN_NAME?.trim();
  const phone = process.env.INITIAL_ADMIN_PHONE?.trim();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  const branchCode = process.env.INITIAL_ADMIN_BRANCH_CODE?.trim() || "dream-city-main";

  if (!name || !phone || !password) {
    throw new Error("Set INITIAL_ADMIN_NAME, INITIAL_ADMIN_PHONE, and INITIAL_ADMIN_PASSWORD in a private local .env file.");
  }
  if (phone.length < 7 || phone.length > 32) throw new Error("The admin phone value is invalid.");
  if (password.length < 10 || password.length > 128) throw new Error("The initial password must be 10–128 characters.");

  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is required and the database must be reachable.");
  const [branch] = await db.select().from(branches).where(eq(branches.branchCode, branchCode)).limit(1);
  if (!branch) throw new Error("Run pnpm seed:menu first, or choose an existing branch code.");
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1);
  if (existing) throw new Error("A user with that phone already exists; this script will not overwrite accounts.");

  await db.insert(users).values({
    openId: `local-staff:${phone}`,
    phone,
    name,
    loginMethod: "phone",
    passwordHash: await bcrypt.hash(password, 12),
    role: "admin",
    branchId: branch.id,
    isAvailable: true,
    mustChangePassword: true,
  });
  console.log("Initial administrator created. The account must change its password at first sign-in.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Administrator creation failed.");
  process.exit(1);
});
