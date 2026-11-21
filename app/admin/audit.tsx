import { useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { RoleGuard } from "@/components/role-guard";
import { AppText, Card, Pill, PrimaryButton, SectionHeading } from "@/components/ui";
import { shortDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";

type Branch = { id: number; name: string };
type AuditRow = { id: number; actorName: string | null; branchName: string | null; action: string; entityType: string; entityId: string | null; details: Record<string, unknown> | null; createdAt: string | Date };
const PERIODS = [{ key: "all", title: "كل الأوقات" }, { key: "7d", title: "7 أيام" }, { key: "30d", title: "30 يومًا" }] as const;

function AuditContent() {
  const [branchId, setBranchId] = useState<number | null>(null);
  const [action, setAction] = useState("");
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("all");
  const branchesQuery = trpc.admin.listBranches.useQuery(undefined as never, { retry: false });
  const dateBounds = useMemo(() => {
    if (period === "all") return {};
    const to = new Date(); const from = new Date(to); from.setDate(from.getDate() - (period === "7d" ? 7 : 30)); from.setHours(0, 0, 0, 0); return { from, to };
  }, [period]);
  const queryInput = useMemo(() => ({ limit: 100, ...(branchId ? { branchId } : {}), ...(action.trim() ? { action: action.trim() } : {}), ...dateBounds }), [branchId, action, dateBounds]);
  const auditQuery = trpc.admin.audit.useQuery(queryInput as never, { retry: false });
  const branches = (branchesQuery.data ?? []) as unknown as Branch[];
  const rows = (auditQuery.data ?? []) as unknown as AuditRow[];
  return <View style={{ flex: 1, backgroundColor: "#fffdf8" }}><ScrollView contentContainerStyle={{ padding: 16, paddingTop: 20, paddingBottom: 36 }}>
    <AppText weight="bold" style={{ fontSize: 24 }}>سجل التدقيق</AppText>
    <AppText style={{ color: "#667085", fontSize: 12, lineHeight: 20, marginTop: 4, marginBottom: 14 }}>قراءة فقط للإجراءات الإدارية المسجلة على الخادم. تُخفى حقول كلمات المرور والرموز والاتصال والموقع.</AppText>
    <Card style={{ marginBottom: 14, gap: 8 }}>
      <SectionHeading title="الفلاتر" caption="الفرع ونوع الإجراء والفترة الزمنية" />
      <AppText weight="semibold" style={{ fontSize: 11 }}>الفرع</AppText><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse" }}><Pill title="كل الفروع" selected={branchId === null} onPress={() => setBranchId(null)} />{branches.map((branch) => <Pill key={branch.id} title={branch.name} selected={branchId === branch.id} onPress={() => setBranchId(branch.id)} />)}</ScrollView>
      <AppText weight="semibold" style={{ fontSize: 11 }}>رمز الإجراء (اختياري)</AppText><TextInput value={action} onChangeText={setAction} maxLength={64} autoCapitalize="characters" placeholder="مثال: ACCOUNT_UPDATED" style={{ minHeight: 42, borderWidth: 1, borderColor: "#e7e3db", borderRadius: 10, paddingHorizontal: 10, textAlign: "left", backgroundColor: "#fff" }} />
      <AppText weight="semibold" style={{ fontSize: 11 }}>الفترة</AppText><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse" }}>{PERIODS.map((item) => <Pill key={item.key} title={item.title} selected={period === item.key} onPress={() => setPeriod(item.key)} />)}</ScrollView>
    </Card>
    <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}><SectionHeading title="أحدث الإجراءات" caption="حتى 100 سجل مطابق" /><Pressable onPress={() => void auditQuery.refetch()} accessibilityRole="button" style={{ padding: 8 }}><AppText weight="semibold" style={{ color: "#b45309" }}>تحديث</AppText></Pressable></View>
    {auditQuery.isLoading ? <Card><AppText style={{ color: "#667085" }}>جارٍ تحميل السجل...</AppText></Card> : null}
    {auditQuery.isError ? <Card style={{ backgroundColor: "#fff5f5" }}><AppText style={{ color: "#b42318" }}>تعذر تحميل سجل التدقيق.</AppText><PrimaryButton title="إعادة المحاولة" onPress={() => void auditQuery.refetch()} style={{ marginTop: 8 }} /></Card> : null}
    {!auditQuery.isLoading && !auditQuery.isError && rows.length === 0 ? <Card><AppText style={{ color: "#667085" }}>لا توجد سجلات مطابقة.</AppText></Card> : null}
    {rows.map((row) => <Card key={row.id} style={{ marginBottom: 9, gap: 5, borderRightWidth: 3, borderRightColor: "#d97706" }}>
      <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}><View style={{ flex: 1 }}><AppText weight="bold">{row.action}</AppText><AppText style={{ color: "#667085", fontSize: 11, marginTop: 2 }}>{row.entityType}{row.entityId ? ` · ${row.entityId}` : ""}</AppText></View><AppText style={{ color: "#667085", fontSize: 10 }}>{row.createdAt ? shortDate(row.createdAt) : "وقت غير متاح"}</AppText></View>
      <AppText style={{ color: "#667085", fontSize: 11 }}>المنفذ: {row.actorName || "حساب غير متاح"} · الفرع: {row.branchName || "عام"}</AppText>
      {row.details && Object.keys(row.details).length > 0 ? <AppText style={{ color: "#475467", fontSize: 10, lineHeight: 17 }}>{JSON.stringify(row.details)}</AppText> : null}
    </Card>)}
  </ScrollView></View>;
}

export default function AdminAuditScreen() {
  return <RoleGuard permission="admin.manage" title="سجل التدقيق"><AuditContent /></RoleGuard>;
}
