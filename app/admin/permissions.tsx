import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Switch, View } from "react-native";
import { RoleGuard } from "@/components/role-guard";
import { AppText, Card, Pill, PrimaryButton, SectionHeading } from "@/components/ui";
import { trpc } from "@/lib/trpc";

type Policy = { permissionKeys: string[]; permissionLabels: Record<string, string>; roles: string[]; roleLabels: Record<string, string>; grants: Record<string, string[]> };

function PermissionsContent() {
  const query = trpc.admin.rolePermissions.useQuery(undefined as never, { retry: false });
  const save = trpc.admin.saveRolePermissions.useMutation();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [selectedRole, setSelectedRole] = useState("manager");
  useEffect(() => { if (query.data) setPolicy(query.data as unknown as Policy); }, [query.data]);
  const toggle = (key: string, enabled: boolean) => setPolicy((current) => {
    if (!current || selectedRole === "admin") return current;
    const roles = current.grants[key] ?? [];
    return { ...current, grants: { ...current.grants, [key]: enabled ? [...new Set([...roles, selectedRole])] : roles.filter((role) => role !== selectedRole) } };
  });
  const persist = async () => {
    if (!policy) return;
    try { await save.mutateAsync({ grants: policy.grants } as never); await query.refetch(); }
    catch { /* keep local changes visible; the mutation hook exposes the server error below */ }
  };
  return <View style={{ flex: 1, backgroundColor: "#fffdf8" }}><ScrollView contentContainerStyle={{ padding: 17, paddingBottom: 36 }}>
    <AppText weight="bold" style={{ fontSize: 23 }}>مصفوفة الصلاحيات</AppText>
    <AppText style={{ color: "#667085", lineHeight: 21, marginTop: 4 }}>تُطبّق التغييرات على واجهات الخادم المحمية. يظل المدير العام مخولًا دائمًا، وتبقى قيود نطاق الفرع مطبقة.</AppText>
    {query.isLoading ? <Card style={{ marginTop: 14, alignItems: "center" }}><ActivityIndicator color="#d97706" /><AppText style={{ marginTop: 8 }}>جارٍ تحميل السياسة...</AppText></Card> : null}
    {query.isError ? <Card style={{ marginTop: 14, backgroundColor: "#fff5f5" }}><AppText style={{ color: "#b42318" }}>تعذر قراءة سياسة الصلاحيات. لم يتم استبدال الإعدادات المخزنة.</AppText><PrimaryButton title="إعادة المحاولة" onPress={() => void query.refetch()} style={{ marginTop: 10 }} /></Card> : null}
    {policy ? <>
      <SectionHeading title="اختر الدور" caption="حدد دورًا ثم فعّل أو أوقف كل إذن" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse", marginTop: 8, marginBottom: 12 }}>{policy.roles.map((role) => <Pill key={role} title={policy.roleLabels[role] ?? role} selected={selectedRole === role} onPress={() => setSelectedRole(role)} />)}</ScrollView>
      {selectedRole === "admin" ? <Card style={{ backgroundColor: "#fff3e2", marginBottom: 10 }}><AppText weight="semibold">المدير العام لديه صلاحيات ثابتة كاملة ولا يمكن تقليصها من هذه الشاشة.</AppText></Card> : null}
      {policy.permissionKeys.map((key) => <Card key={key} style={{ marginBottom: 8, paddingVertical: 10 }}><View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}><View style={{ flex: 1 }}><AppText weight="semibold">{policy.permissionLabels[key] ?? key}</AppText><AppText style={{ color: "#98a2b3", fontSize: 10, marginTop: 2, textAlign: "left" }}>{key}</AppText></View><Switch value={(policy.grants[key] ?? []).includes(selectedRole)} disabled={selectedRole === "admin"} onValueChange={(value) => toggle(key, value)} trackColor={{ false: "#d0d5dd", true: "#f4b860" }} thumbColor="#ffffff" /></View></Card>)}
      {save.error ? <Card style={{ backgroundColor: "#fff5f5", marginBottom: 8 }}><AppText style={{ color: "#b42318" }}>{save.error.message || "تعذر حفظ الصلاحيات."}</AppText></Card> : null}
      <PrimaryButton title={save.isPending ? "جارٍ الحفظ..." : save.isSuccess ? "تم حفظ الصلاحيات" : "حفظ التغييرات"} onPress={() => void persist()} disabled={save.isPending || selectedRole === "admin"} style={{ marginTop: 8 }} />
      <PrimaryButton title="العودة إلى لوحة الإدارة" onPress={() => router.replace("/admin" as never)} style={{ marginTop: 9 }} />
      <AppText style={{ color: "#667085", fontSize: 11, lineHeight: 18, marginTop: 13 }}>تغيير المصفوفة يسجل حدثًا في سجل التدقيق. في حال تلف الإعداد المخزن، يرفض الخادم الطلبات التي تتطلب صلاحيات بدلًا من فتح الوصول.</AppText>
    </> : null}
  </ScrollView></View>;
}

export default function PermissionsScreen() {
  return <RoleGuard permission="admin.manage" title="إدارة الصلاحيات"><PermissionsContent /></RoleGuard>;
}
