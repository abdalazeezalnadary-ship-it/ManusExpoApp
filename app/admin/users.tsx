import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { RoleGuard } from "@/components/role-guard";
import { AppText, Card, Pill, PrimaryButton, SectionHeading } from "@/components/ui";
import { ROLE_LABELS } from "@/constants/restaurant";
import { trpc } from "@/lib/trpc";

const ADMIN_ROLES = ["admin"] as const;
const STAFF_ROLES = ["manager", "cashier", "chef", "waiter", "driver", "inventory", "accountant"] as const;
const STAFF_ROLE_LABELS: Record<(typeof STAFF_ROLES)[number], string> = {
  manager: "مدير فرع", cashier: "كاشير", chef: "شيف مطبخ", waiter: "مضيف صالة", driver: "موصل طلبات", inventory: "مسؤول مخزون", accountant: "محاسب",
};
type Branch = { id: number; name: string };
type AdminUser = {
  id: number;
  phone: string | null;
  name: string | null;
  role: string | null;
  branchId: number | null;
  points: number | null;
  isAvailable: boolean | null;
  mustChangePassword: boolean | null;
  createdAt: string | Date | null;
  lastSignedIn: string | Date | null;
};
const inputStyle = { minHeight: 46, borderWidth: 1, borderColor: "#e7e3db", borderRadius: 12, paddingHorizontal: 12, backgroundColor: "#ffffff", color: "#0f172a", textAlign: "right" as const, fontFamily: "Cairo_400Regular" };

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "غير مسجل";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "غير مسجل" : date.toLocaleDateString("ar-YE");
}

function UsersContent() {
  const usersQuery = trpc.admin.users.useQuery(undefined as never, { retry: false });
  const branchesQuery = trpc.branches.list.useQuery(undefined as never, { retry: false });
  const createStaff = trpc.admin.createStaff.useMutation();
  const setAvailability = trpc.admin.setAvailability.useMutation();
  const users = (usersQuery.data ?? []) as unknown as AdminUser[];
  const branches = (branchesQuery.data ?? []) as unknown as Branch[];
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [role, setRole] = useState<(typeof STAFF_ROLES)[number] | "">("");
  const [branchId, setBranchId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const submitStaff = async () => {
    setError(""); setNotice("");
    const normalizedPhone = phone.trim();
    const normalizedName = name.trim();
    if (!normalizedName) { setError("أدخل اسم الموظف."); return; }
    if (!/^7\d{8}$/.test(normalizedPhone)) { setError("أدخل رقم هاتف يمني من 9 خانات يبدأ بالرقم 7."); return; }
    if (temporaryPassword.length < 10) { setError("كلمة المرور المؤقتة يجب ألا تقل عن 10 خانات."); return; }
    if (!role) { setError("اختر دور الموظف."); return; }
    if (!branchId) { setError("اختر فرعاً من قائمة الفروع الرسمية."); return; }
    try {
      const result = await createStaff.mutateAsync({ phone: normalizedPhone, name: normalizedName, role, branchId, temporaryPassword } as never) as unknown as { id?: number };
      setTemporaryPassword("");
      setPhone(""); setName(""); setRole(""); setBranchId(null);
      setNotice(`تم إنشاء حساب الموظف${result?.id ? ` رقم ${result.id}` : ""}. سلّم كلمة المرور المؤقتة خارج التطبيق، ويلزم الموظف تغييرها عند أول دخول؛ لا يمكن استعادتها من هذه الشاشة.`);
      await usersQuery.refetch();
    } catch (cause) {
      setTemporaryPassword("");
      setError(cause instanceof Error ? cause.message : "تعذر إنشاء حساب الموظف.");
    }
  };

  const changeAvailability = async (user: AdminUser) => {
    setError(""); setNotice("");
    try {
      await setAvailability.mutateAsync({ userId: user.id, isAvailable: !user.isAvailable } as never);
      await usersQuery.refetch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحديث توفر الحساب.");
    }
  };

  return <View style={{ flex: 1, backgroundColor: "#fffdf8" }}><ScrollView contentContainerStyle={{ padding: 17, paddingTop: 20, paddingBottom: 34 }}>
    <AppText weight="bold" style={{ fontSize: 24 }}>إدارة المستخدمين</AppText>
    <AppText style={{ color: "#667085", fontSize: 12, marginTop: 3, marginBottom: 14 }}>إنشاء حسابات الموظفين ومراجعة حالة الحسابات التي أعادها الخادم.</AppText>
    {branchesQuery.isError ? <Card style={{ backgroundColor: "#fff5f5", marginBottom: 12 }}><AppText style={{ color: "#b42318" }}>تعذر تحميل الفروع الرسمية؛ إنشاء الموظف يتطلب اختيار فرع من الخادم.</AppText></Card> : null}
    {error ? <Card style={{ backgroundColor: "#fff5f5", marginBottom: 10 }}><AppText style={{ color: "#b42318" }}>{error}</AppText></Card> : null}
    {notice ? <Card style={{ backgroundColor: "#edf7f0", borderColor: "#cce8d5", marginBottom: 10 }}><AppText style={{ color: "#166534", lineHeight: 22 }}>{notice}</AppText></Card> : null}

    <Card style={{ gap: 9, marginBottom: 17 }}>
      <SectionHeading title="إنشاء حساب موظف" caption="رقم يمني من 9 خانات؛ كلمة مرور مؤقتة لا تقل عن 10 خانات" />
      <AppText weight="semibold" style={{ fontSize: 12 }}>اسم الموظف</AppText><TextInput value={name} onChangeText={setName} maxLength={120} placeholder="الاسم المعتمد" placeholderTextColor="#98a2b3" style={inputStyle} />
      <AppText weight="semibold" style={{ fontSize: 12 }}>رقم الهاتف اليمني</AppText><TextInput value={phone} onChangeText={(value) => setPhone(value.replace(/[^0-9]/g, "").slice(0, 9))} keyboardType="phone-pad" maxLength={9} placeholder="7xxxxxxxx" placeholderTextColor="#98a2b3" style={inputStyle} />
      <AppText weight="semibold" style={{ fontSize: 12 }}>الدور الوظيفي</AppText>
      <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", rowGap: 8 }}>
        {STAFF_ROLES.map((staffRole) => <Pill key={staffRole} title={STAFF_ROLE_LABELS[staffRole]} selected={role === staffRole} onPress={() => setRole(staffRole)} />)}
      </View>
      <AppText weight="semibold" style={{ fontSize: 12 }}>الفرع</AppText>
      {branchesQuery.isLoading ? <AppText style={{ color: "#667085" }}>جارٍ تحميل الفروع...</AppText> : null}
      {branches.length === 0 && !branchesQuery.isLoading ? <AppText style={{ color: "#667085" }}>لا توجد فروع رسمية متاحة للاختيار.</AppText> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse" }}>{branches.map((branch) => <Pill key={branch.id} title={branch.name} selected={branchId === branch.id} onPress={() => setBranchId(branch.id)} />)}</ScrollView>}
      <AppText weight="semibold" style={{ fontSize: 12 }}>كلمة مرور مؤقتة</AppText><TextInput value={temporaryPassword} onChangeText={setTemporaryPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={128} placeholder="أدخلها ولا تقل عن 10 خانات" placeholderTextColor="#98a2b3" style={inputStyle} />
      <AppText style={{ color: "#667085", fontSize: 11, lineHeight: 18 }}>لا تظهر كلمة المرور بعد الإنشاء ولا تُحفظ في قائمة المستخدمين. يطلب النظام من الموظف تغييرها عند أول دخول.</AppText>
      <PrimaryButton title="إنشاء حساب الموظف" loading={createStaff.isPending} disabled={branches.length === 0 || branchesQuery.isLoading} onPress={() => void submitStaff()} />
    </Card>

    <SectionHeading title="الحسابات" caption="البيانات المعروضة مقتصرة على الحقول الآمنة التي أعادها الخادم" />
    {usersQuery.isLoading ? <Card><AppText style={{ color: "#667085" }}>جارٍ تحميل الحسابات...</AppText></Card> : null}
    {usersQuery.isError ? <Card style={{ backgroundColor: "#fff5f5" }}><AppText style={{ color: "#b42318" }}>تعذر تحميل قائمة المستخدمين.</AppText><PrimaryButton title="إعادة المحاولة" onPress={() => void usersQuery.refetch()} style={{ marginTop: 9 }} /></Card> : null}
    {!usersQuery.isLoading && !usersQuery.isError && users.length === 0 ? <Card><AppText style={{ color: "#667085" }}>لا توجد حسابات أعادها الخادم.</AppText></Card> : null}
    {users.map((user) => {
      const branchName = branches.find((branch) => branch.id === user.branchId)?.name;
      return <Card key={user.id} style={{ marginBottom: 9, gap: 7 }}>
        <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flex: 1 }}><AppText weight="bold">{user.name || "اسم غير مسجل"}</AppText><AppText style={{ color: "#667085", fontSize: 12, marginTop: 2, writingDirection: "ltr", textAlign: "right" }}>{user.phone || "رقم غير مسجل"}</AppText></View>
          <AppText weight="semibold" style={{ color: "#9a5300", fontSize: 11 }}>{ROLE_LABELS[user.role ?? ""] ?? user.role ?? "دور غير مسجل"}</AppText>
        </View>
        <AppText style={{ color: "#667085", fontSize: 11 }}>الفرع: {branchName ?? (user.branchId ? `رقم ${user.branchId}` : "غير مرتبط")}{user.points != null ? ` · النقاط: ${user.points}` : ""}</AppText>
        <AppText style={{ color: user.mustChangePassword ? "#9a5300" : "#667085", fontSize: 11 }}>{user.mustChangePassword ? "مطلوب تغيير كلمة المرور عند الدخول" : "تغيير كلمة المرور غير مطلوب"}</AppText>
        <AppText style={{ color: "#98a2b3", fontSize: 10 }}>أُنشئ: {formatDate(user.createdAt)} · آخر دخول: {formatDate(user.lastSignedIn)}</AppText>
        <Pressable accessibilityRole="button" disabled={setAvailability.isPending} onPress={() => void changeAvailability(user)} style={{ minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: user.isAvailable ? "#fff5f5" : "#edf7f0", marginTop: 2 }}>
          <AppText weight="semibold" style={{ color: user.isAvailable ? "#b42318" : "#166534" }}>{user.isAvailable ? "إيقاف الحساب" : "تفعيل الحساب"}{user.isAvailable === null ? " (الحالة غير محددة)" : ""}</AppText>
        </Pressable>
      </Card>;
    })}
  </ScrollView></View>;
}

export default function AdminUsersScreen() {
  return <RoleGuard roles={ADMIN_ROLES} title="إدارة المستخدمين"><UsersContent /></RoleGuard>;
}
