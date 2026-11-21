import { router } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { AppText, Card, PrimaryButton } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

type RoleGuardProps = {
  permission?: string;
  children: React.ReactNode;
  title?: string;
};

/** UX-only route guard. Every protected operation must still authorize on the server. */
export function RoleGuard({ permission, children, title = "هذه الشاشة" }: RoleGuardProps) {
  const { user, loading } = useAuth();
  const permissionsQuery = trpc.auth.permissions.useQuery(undefined as never, { enabled: Boolean(user && permission), retry: false });

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

  if (permission && permissionsQuery.isLoading) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fffdf8", padding: 24 }}><ActivityIndicator color="#d97706" /><AppText style={{ color: "#667085", marginTop: 10 }}>جارٍ التحقق من صلاحيات الشاشة...</AppText></View>;
  }

  const hasPermission = !permission || (permissionsQuery.data?.permissions ?? []).includes(permission as never);
  if (!hasPermission || permission && permissionsQuery.isError) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: "#fffdf8", padding: 20 }}>
        <Card style={{ gap: 10 }}>
          <AppText weight="bold" style={{ fontSize: 20 }}>لا تملك صلاحية هذه الشاشة</AppText>
          <AppText style={{ color: "#667085", lineHeight: 22 }}>لا يملك الحساب الإذن المطلوب، أو تعذر التحقق من السياسة المحفوظة.</AppText>
          <Pressable onPress={() => router.replace("/(tabs)")} style={{ alignSelf: "flex-start", paddingVertical: 8 }}>
            <AppText weight="semibold" style={{ color: "#d97706" }}>العودة للرئيسية</AppText>
          </Pressable>
        </Card>
      </View>
    );
  }

  return <>{children}</>;
}
