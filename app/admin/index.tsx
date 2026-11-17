import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { RoleGuard } from "@/components/role-guard";
import { AppText, Card, Pill, PrimaryButton, SectionHeading } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { shortDate } from "@/lib/format";

const ADMIN_ROLES = ["admin", "manager"] as const;
type Branch = { id: number; branchCode: string; name: string; address?: string | null };
type Order = Record<string, any>;

function AdminContent() {
  const { user } = useAuth();
  const branchesQuery = trpc.branches.list.useQuery(undefined as never, { retry: false });
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const branches = (branchesQuery.data ?? []) as unknown as Branch[];
  const ownBranch = branches.find((branch) => branch.id === Number(user?.branchId)) ?? null;
  const isAdmin = user?.role === "admin";
  const branchId = isAdmin ? selectedBranchId : ownBranch?.id ?? null;
  const ordersQuery = trpc.orders.list.useQuery(branchId ? { branchId } : undefined as never, { enabled: Boolean(branchId), refetchInterval: 15_000, retry: false });
  const orders = (ordersQuery.data ?? []) as unknown as Order[];
  const activeOrders = orders.filter((order) => !["completed", "cancelled"].includes(String(order.status)));
  const go = (path: string) => router.push(path as never);
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
      { title: "إعدادات التوصيل والولاء", caption: "إدخال القيم الرسمية للفروع", icon: "options-outline" as const, path: "/admin/settings" },
      { title: "المستخدمون والموظفون", caption: "حسابات الأدوار وحالة الإتاحة", icon: "people-outline" as const, path: "/admin/users" },
      { title: "النسخ الاحتياطي", caption: "تصدير JSON دون كلمات مرور أو أسرار", icon: "cloud-download-outline" as const, path: "/admin/backup" },
    ] : []),
  ];

  return <View style={{ flex: 1, backgroundColor: "#fffdf8" }}><ScrollView contentContainerStyle={{ padding: 17, paddingTop: 20, paddingBottom: 34 }}>
    <AppText weight="bold" style={{ fontSize: 24 }}>إدارة التشغيل</AppText>
    <AppText style={{ color: "#667085", fontSize: 12, marginTop: 3 }}>مؤشرات الطلبات من الخادم، دون أرقام تجريبية.</AppText>
    <Card style={{ marginTop: 15, marginBottom: 13, backgroundColor: "#0f172a", borderColor: "#0f172a" }}>
      <AppText weight="bold" style={{ color: "#ffffff", fontSize: 17 }}>فرع التشغيل</AppText>
      {branchesQuery.isLoading ? <AppText style={{ color: "#d0d5dd", marginTop: 7 }}>جارٍ تحميل الفروع...</AppText> : null}
      {branchesQuery.isError ? <AppText style={{ color: "#fecaca", marginTop: 7 }}>تعذر تحميل الفروع الرسمية من الخادم.</AppText> : null}
      {isAdmin ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse", marginTop: 8 }}>{branches.map((branch) => <Pill key={branch.id} title={branch.name} selected={selectedBranchId === branch.id} onPress={() => setSelectedBranchId(branch.id)} />)}</ScrollView> : <AppText style={{ color: "#ffffff", marginTop: 7 }}>{ownBranch?.name ?? "لم يُعثر على الفرع المرتبط بالحساب."}</AppText>}
      {branchId ? <AppText style={{ color: "#d0d5dd", fontSize: 11, marginTop: 6 }}>{branches.find((branch) => branch.id === branchId)?.address ?? "العنوان غير وارد في بيانات الخادم."}</AppText> : null}
    </Card>
    {!branchId ? <Card style={{ backgroundColor: "#fff5e8", marginBottom: 12 }}><AppText weight="semibold" style={{ color: "#9a5300" }}>{isAdmin ? "اختر فرعاً من قائمة الفروع لعرض طلباته." : "يلزم ربط حساب المدير بفرع في بيانات الحساب."}</AppText></Card> : null}
    {branchId ? <>
      {ordersQuery.isLoading ? <Card><AppText style={{ color: "#667085" }}>جارٍ جلب الطلبات الحقيقية...</AppText></Card> : null}
      {ordersQuery.isError ? <Card style={{ backgroundColor: "#fff5f5" }}><AppText style={{ color: "#b42318" }}>تعذر تحميل الطلبات؛ قد يكون إجراء orders.list غير متاح لهذا الحساب أو الفرع.</AppText><PrimaryButton title="إعادة المحاولة" onPress={() => void ordersQuery.refetch()} style={{ marginTop: 9 }} /></Card> : null}
      {!ordersQuery.isLoading && !ordersQuery.isError ? <Card style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", borderRightWidth: 4, borderRightColor: "#d97706", marginBottom: 14 }}>
        <View><AppText style={{ color: "#667085", fontSize: 12 }}>طلبات نشطة أعادها الخادم</AppText><AppText weight="bold" style={{ fontSize: 30, marginTop: 2 }}>{activeOrders.length}</AppText></View>
        <Pressable onPress={() => void ordersQuery.refetch()} style={{ padding: 9 }}><Ionicons name="refresh" size={20} color="#d97706" /></Pressable>
      </Card> : null}
    </> : null}
    <SectionHeading title="الوصول السريع" caption="شاشات التشغيل المتاحة حسب الدور" />
    <View style={{ gap: 9, marginBottom: 17 }}>
      {navigation.map((item) => <Pressable key={item.path} onPress={() => go(item.path)}><Card style={{ flexDirection: "row-reverse", alignItems: "center", gap: 11, paddingVertical: 13 }}><View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: "#fff3e2", alignItems: "center", justifyContent: "center" }}><Ionicons name={item.icon} size={21} color="#d97706" /></View><View style={{ flex: 1 }}><AppText weight="bold">{item.title}</AppText><AppText style={{ color: "#667085", fontSize: 11, marginTop: 2 }}>{item.caption}</AppText></View><Ionicons name="chevron-back" size={17} color="#98a2b3" /></Card></Pressable>)}
    </View>
    <SectionHeading title="الطلبات النشطة" caption="تحديث تلقائي كل 15 ثانية" />
    {branchId && !ordersQuery.isLoading && !ordersQuery.isError && activeOrders.length === 0 ? <Card><AppText style={{ color: "#667085" }}>لا توجد طلبات نشطة ضمن نتيجة الخادم لهذا الفرع.</AppText></Card> : null}
    {activeOrders.slice(0, 20).map((order, index) => <Card key={String(order.id ?? index)} style={{ marginBottom: 8, paddingVertical: 12 }}>
      <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}><View><AppText weight="semibold">طلب {order.orderNumber ?? order.id}</AppText><AppText style={{ color: "#667085", fontSize: 10, marginTop: 2 }}>{order.createdAt ? shortDate(order.createdAt) : "التاريخ غير متاح"}</AppText></View><AppText weight="semibold" style={{ color: "#9a5300", fontSize: 11 }}>{String(order.status ?? "حالة غير محددة")}</AppText></View>
    </Card>)}
    <AppText style={{ color: "#98a2b3", fontSize: 10, lineHeight: 16, marginTop: 12 }}>صلاحية عرض الروابط لا تحمي إجراءات الخادم؛ كل استعلام/تغيير يجب أن يمر بتحقق الدور والفرع على الخادم.</AppText>
  </ScrollView></View>;
}

export default function AdminDashboardScreen() {
  return <RoleGuard roles={ADMIN_ROLES} title="لوحة الإدارة"><AdminContent /></RoleGuard>;
}
