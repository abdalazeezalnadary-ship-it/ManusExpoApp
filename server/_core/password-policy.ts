import { TRPCError } from "@trpc/server";

export function assertPasswordChanged(user: { mustChangePassword?: boolean } | null | undefined): void {
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "يلزم تسجيل الدخول." });
  if (user.mustChangePassword === true) {
    throw new TRPCError({ code: "FORBIDDEN", message: "يجب تغيير كلمة المرور الأولية قبل استخدام بقية وظائف النظام." });
  }
}
