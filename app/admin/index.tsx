import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { RoleGuard } from "@/components/role-guard";
import { AppText, Card, Pill, PrimaryButton, SectionHeading } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { formatYER, shortDate } from "@/lib/format";

type Branch = { id: number; branchCode: string; name: string; address?: string | null };
type Order = Record<string, any>;
type Metric = { totalOrders: number; completedOrders: number; activeOrders: number; completedSales: number; expenses: number; openShifts: number; lowStockItems: number; pendingReturns: number };
type Overview = { totals: Metric; branches: Array<Metric & { id: number; name: string; branchCode: string; isActive: boolean }> };
const PERIODS = [{ key: "today", title: "اليوم", days: 0 }, { key: "7d", title: "7 أيام", days: 7 }, { key: "30d", title: "30 يومًا", days: 30 }] as const;

function MetricCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return <Card style={{ flexGrow: 1, flexBasis: "46%", minWidth: 145, paddingVertical: 12 }}><AppText style={{ color: "#667085", fontSize: 11 }}>{title}</AppText><AppText weight="bold" style={{ fontSize: 22, marginTop: 4 }}>{value}</AppText>{hint ? <AppText style={{ color: "#98a2b3", fontSize: 9, marginTop: 3 }}>{hint}</AppText> : null}</Card>;
}

function AdminContent() {
  const { user } = useAuth();
  const branchesQuery = trpc.branches.list.useQuery(undefined as never, { retry: false });
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("today");
  const branches = (branchesQuery.data ?? []) as unknown as Branch[];
  const ownBranch = branches.find((branch) => branch.id === Number(user?.branchId)) ?? null;
  const isAdmin = user?.role === "admin";
  const branchId = isAdmin ? selectedBranchId : ownBranch?.id ?? null;
  const overviewInput = useMemo(() => {
    const to = new Date(); const from = new Date(to); from.setHours(0, 0, 0, 0);
    const selectedPeriod = PERIODS.find((item) => item.key === period);
    if (selectedPeriod?.days) from.setDate(from.getDate() - selectedPeriod.days + 1);
    return { ...(selectedBranchId ? { branchId: selectedBranchId } : {}), from, to };
  }, [period, selectedBranchId]);
  const overviewQuery = trpc.admin.overview.useQuery(overviewInput as never, { enabled: isAdmin, refetchInterval: 60_000, retry: false });
  const ordersQuery = trpc.orders.list.useQuery(branchId ? { branchId } : undefined as never, { enabled: Boolean(branchId), refetchInterval: 15_000, retry: false });
  const orders = (ordersQuery.data ?? []) as unknown as Order[];
  const activeOrders = orders.filter((order) => !["completed", "cancelled"].includes(String(order.status)));
  const go = (path: string) => router.push(path as never);
  const totals = (overviewQuery.data as unknown as Overview | undefined)?.totals;
  const navigation = [
    { title: "شاشة المطبخ KDS", caption: "المحطات وحالات أصناف الطلب", icon: "restaurant-outline" as const, path: "/kds" },
    { title: "المخزون", caption: "الكميات والحدود والتكلفة والمورد", icon: "cube-outline" as const, path: "/admin/inventory" },
    { title: "الورديات و Z-Report", caption: "فتح/إغلاق وتقارير الخادم", icon: "receipt-outline" as const, path: "/admin/shifts" },
    { title: "الأسطول", caption: "مواقع GPS الفعلية للموصلين", icon: "bicycle-outline" as const, path: "/admin/fleet" },
    { title: "المصروفات", caption: "الحركات المسجلة ضمن الوردية", icon: "wallet-outline" as const, path: "/admin/expenses" },
    { title: "الكوبونات", caption: "خصومات محددة ببيانات المدير", icon: "pricetag-outline" as const, path: "/admin/promotions" },
    { title: "المرتجعات", caption: "مراجعة طلبات الإرجاع وحالاتها", icon: "return-down-back-outline" as const, path: "/admin/returns" },
    { title: "المنيو والأسعار", caption: "إدارة أصناف الفروع", icon: "restaurant-outline" as const, path: "/admin/menu" },
    ...(isAdmin ? [
      { title: "إعدادات التوصيل والولاء", caption: "قيم الفروع ومناطق التوصيل", icon: "options-outline" as const, path: "/admin/settings" },
      { title: "الفروع", caption: "إضافة الفروع وتحديثها وإيقافها بأمان", icon: "business-outline" as const, path: "/admin/branches" },
      { title: "الحسابات والصلاحيات الأساسية", caption: "مديرون وموظفون وعملاء", icon: "people-outline" as const, path: "/admin/users" },
      { title: "مصفوفة الصلاحيات", caption: "تخصيص أذونات الأدوار مع حواجز الخادم", icon: "key-outline" as const, path: "/admin/permissions" },
      { title: "سجل التدقيق", caption: "الإجراءات الإدارية المسجلة على الخادم", icon: "document-text-outline" as const, path: "/admin/audit" },
      { title: "النسخ الاحتياطي", caption: "تصدير JSON دون كلمات مرور أو أسرار", icon: "cloud-download-outline" as const, path: "/admin/backup" },
    ] : []),
  ];

  return <View style={{ flex: 1, backgroundColor: "#fffdf8" }}><ScrollView contentContainerStyle={{ padding: 17, paddingTop: 20, paddingBottom: 34 }}>
    <AppText weight="bold" style={{ fontSize: 24 }}>{isAdmin ? "مركز إدارة Dream City" : "إدارة التشغيل"}</AppText>
    <AppText style={{ color: "#667085", fontSize: 12, marginTop: 3 }}>بيانات التشغيل والمؤشرات تأتي من الخادم، ولا تُعرض أرقام افتراضية.</AppText>
    <Card style={{ marginTop: 15, marginBottom: 13, backgroundColor: "#0f172a", borderColor: "#0f172a" }}>
      <AppText weight="bold" style={{ color: "#ffffff", fontSize: 17 }}>نطاق الفرع</AppText>
      {branchesQuery.isLoading ? <AppText style={{ color: "#d0d5dd", marginTop: 7 }}>جارٍ تحميل الفروع...</AppText> : null}
      {branchesQuery.isError ? <AppText style={{ color: "#fecaca", marginTop: 7 }}>تعذر تحميل الفروع الرسمية من الخادم.</AppText> : null}
      {isAdmin ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse", marginTop: 8 }}><Pill title="كل الفروع" selected={selectedBranchId === null} onPress={() => setSelectedBranchId(null)} />{branches.map((branch) => <Pill key={branch.id} title={branch.name} selected={selectedBranchId === branch.id} onPress={() => setSelectedBranchId(branch.id)} />)}</ScrollView> : <AppText style={{ color: "#ffffff", marginTop: 7 }}>{ownBranch?.name ?? "لم يُعثر على الفرع المرتبط بالحساب."}</AppText>}
      {branchId ? <AppText style={{ color: "#d0d5dd", fontSize: 11, marginTop: 6 }}>{branches.find((branch) => branch.id === branchId)?.address ?? "العنوان غير وارد في بيانات الخادم."}</AppText> : null}
    </Card>
    {isAdmin ? <>
      <SectionHeading title="مؤشرات الإدارة المركزية" caption="ملخص تشغيلي؛ ليس إقفالًا أو مطابقة محاسبية" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse", marginTop: 7, marginBottom: 9 }}>{PERIODS.map((item) => <Pill key={item.key} title={item.title} selected={period === item.key} onPress={() => setPeriod(item.key)} />)}</ScrollView>
      {overviewQuery.isLoading ? <Card><AppText style={{ color: "#667085" }}>جارٍ تجميع المؤشرات من الخادم...</AppText></Card> : null}
      {overviewQuery.isError ? <Card style={{ backgroundColor: "#fff5f5", marginBottom: 9 }}><AppText style={{ color: "#b42318" }}>تعذر تحميل المؤشرات المركزية؛ لا يتم استبدالها بأرقام تقديرية.</AppText><PrimaryButton title="إعادة المحاولة" onPress={() => void overviewQuery.refetch()} style={{ marginTop: 8 }} /></Card> : null}
      {totals ? <>
        <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          <MetricCard title="مبيعات الطلبات المكتملة" value={formatYER(totals.completedSales)} hint="إجمالي الطلبات المكتملة خلال الفترة" />
          <MetricCard title="المصروفات المسجلة" value={formatYER(totals.expenses)} hint="من سجلات المصروفات الحالية" />
          <MetricCard title="طلبات نشطة" value={String(totals.activeOrders)} />
          <MetricCard title="الطلبات المكتملة" value={String(totals.completedOrders)} />
          <MetricCard title="ورديات مفتوحة" value={String(totals.openShifts)} />
          <MetricCard title="أصناف منخفضة المخزون" value={String(totals.lowStockItems)} />
          <MetricCard title="مرتجعات قيد المراجعة" value={String(totals.pendingReturns)} />
          <MetricCard title="إجمالي الطلبات" value={String(totals.totalOrders)} />
        </View>
        {(overviewQuery.data as unknown as Overview).branches.length > 1 ? <Card style={{ marginBottom: 13 }}><SectionHeading title="مقارنة الفروع" caption="النتائج للمدة المختارة فقط" />{(overviewQuery.data as unknown as Overview).branches.map((branch) => <View key={branch.id} style={{ borderTopWidth: 1, borderTopColor: "#f0ede6", paddingVertical: 9, marginTop: 6 }}><View style={{ flexDirection: "row-reverse", justifyContent: "space-between", gap: 6 }}><AppText weight="semibold">{branch.name}{!branch.isActive ? " · موقوف" : ""}</AppText><AppText style={{ color: "#667085", fontSize: 10 }}>{branch.completedOrders} مكتمل · {branch.activeOrders} نشط</AppText></View><AppText style={{ color: "#667085", fontSize: 10, marginTop: 3 }}>مبيعات مكتملة: {formatYER(branch.completedSales)} · مصروفات: {formatYER(branch.expenses)} · مخزون منخفض: {branch.lowStockItems}</AppText></View>)}</Card> : null}
      </> : null}
    </> : null}
    {!branchId ? <Card style={{ backgroundColor: "#fff5e8", marginBottom: 12 }}><AppText weight="semibold" style={{ color: "#9a5300" }}>{isAdmin ? "اختر فرعًا لعرض طلباته النشطة، أو استخدم مؤشرات كل الفروع أعلاه." : "يلزم ربط حساب المدير بفرع في بيانات الحساب."}</AppText></Card> : null}
    {branchId ? <>
      {ordersQuery.isLoading ? <Card><AppText style={{ color: "#667085" }}>جارٍ جلب الطلبات الحقيقية...</AppText></Card> : null}
      {ordersQuery.isError ? <Card style={{ backgroundColor: "#fff5f5" }}><AppText style={{ color: "#b42318" }}>تعذر تحميل الطلبات لهذا الفرع.</AppText><PrimaryButton title="إعادة المحاولة" onPress={() => void ordersQuery.refetch()} style={{ marginTop: 8 }} /></Card> : null}
      {!ordersQuery.isLoading && !ordersQuery.isError ? <Card style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", borderRightWidth: 4, borderRightColor: "#d97706", marginBottom: 14 }}><View><AppText style={{ color: "#667085", fontSize: 12 }}>طلبات نشطة أعادها الخادم</AppText><AppText weight="bold" style={{ fontSize: 30, marginTop: 2 }}>{activeOrders.length}</AppText></View><Pressable onPress={() => void ordersQuery.refetch()} style={{ padding: 9 }}><Ionicons name="refresh" size={20} color="#d97706" /></Pressable></Card> : null}
    </> : null}
    <SectionHeading title="الوصول السريع" caption="الشاشات المتاحة بحسب صلاحية الحساب" />
    <View style={{ gap: 9, marginBottom: 17 }}>{navigation.map((item) => <Pressable key={item.path} onPress={() => go(item.path)}><Card style={{ flexDirection: "row-reverse", alignItems: "center", gap: 11, paddingVertical: 13 }}><View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: "#fff3e2", alignItems: "center", justifyContent: "center" }}><Ionicons name={item.icon} size={21} color="#d97706" /></View><View style={{ flex: 1 }}><AppText weight="bold">{item.title}</AppText><AppText style={{ color: "#667085", fontSize: 11, marginTop: 2 }}>{item.caption}</AppText></View><Ionicons name="chevron-back" size={17} color="#98a2b3" /></Card></Pressable>)}</View>
    <SectionHeading title="الطلبات النشطة" caption="تحديث تلقائي كل 15 ثانية" />
    {branchId && !ordersQuery.isLoading && !ordersQuery.isError && activeOrders.length === 0 ? <Card><AppText style={{ color: "#667085" }}>لا توجد طلبات نشطة ضمن نتيجة الخادم لهذا الفرع.</AppText></Card> : null}
    {activeOrders.slice(0, 20).map((order, index) => <Card key={String(order.id ?? index)} style={{ marginBottom: 8, paddingVertical: 12 }}><View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}><View><AppText weight="semibold">طلب {order.orderNumber ?? order.id}</AppText><AppText style={{ color: "#667085", fontSize: 10, marginTop: 2 }}>{order.createdAt ? shortDate(order.createdAt) : "التاريخ غير متاح"}</AppText></View><AppText weight="semibold" style={{ color: "#9a5300", fontSize: 11 }}>{String(order.status ?? "حالة غير محددة")}</AppText></View></Card>)}
    <AppText style={{ color: "#98a2b3", fontSize: 10, lineHeight: 16, marginTop: 12 }}>كل إجراء حساس يجب أن يتحقق من الدور والفرع على الخادم؛ إظهار رابط في التطبيق ليس تفويضًا بحد ذاته.</AppText>
  </ScrollView></View>;
}

export default function AdminDashboardScreen() {
  return <RoleGuard permission="orders.read" title="لوحة الإدارة"><AdminContent /></RoleGuard>;
}
