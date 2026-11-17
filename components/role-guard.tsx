import { router } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { AppText, Card, PrimaryButton } from "@/components/ui";
import { ROLE_LABELS } from "@/constants/restaurant";
import { useAuth } from "@/hooks/use-auth";

type RoleGuardProps = {
  roles: readonly string[];
  children: React.ReactNode;
  title?: string;
};

/** UX-only route guard. Every protected operation must still authorize on the server. */
export function RoleGuard({ roles, children, title = "هذه الشاشة" }: RoleGuardProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fffdf8", padding: 24 }}>
        <ActivityIndicator color="#d97706" />
        <AppText style={{ color: "#667085", marginTop: 10 }}>جارٍ التحقق من جلسة الدخول...</AppText>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: "#fffdf8", padding: 20 }}>
        <Card style={{ gap: 10 }}>
          <AppText weight="bold" style={{ fontSize: 20 }}>يلزم تسجيل الدخول</AppText>
          <AppText style={{ color: "#667085", lineHeight: 22 }}>سجّل الدخول للوصول إلى {title}. لا تُحمّل هذه الشاشة أي بيانات تشغيلية قبل الدخول.</AppText>
          <PrimaryButton title="الانتقال إلى تسجيل الدخول" onPress={() => router.push("/login")} />
        </Card>
      </View>
    );
  }

  if (!roles.includes(user.role ?? "")) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: "#fffdf8", padding: 20 }}>
        <Card style={{ gap: 10 }}>
          <AppText weight="bold" style={{ fontSize: 20 }}>لا تملك صلاحية هذه الشاشة</AppText>
          <AppText style={{ color: "#667085", lineHeight: 22 }}>الدور الحالي: {ROLE_LABELS[user.role ?? ""] ?? user.role ?? "غير معروف"}.</AppText>
          <Pressable onPress={() => router.replace("/(tabs)")} style={{ alignSelf: "flex-start", paddingVertical: 8 }}>
            <AppText weight="semibold" style={{ color: "#d97706" }}>العودة للرئيسية</AppText>
          </Pressable>
        </Card>
      </View>
    );
  }

  return <>{children}</>;
}
