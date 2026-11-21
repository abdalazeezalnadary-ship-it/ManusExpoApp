import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { RoleGuard } from "@/components/role-guard";
import { AppText, Card, Pill, PrimaryButton, SectionHeading } from "@/components/ui";
import { trpc } from "@/lib/trpc";

type AccountRole = "admin" | "manager" | "cashier" | "chef" | "waiter" | "driver" | "inventory" | "accountant" | "customer";
const ACCOUNT_ROLES: AccountRole[] = ["admin", "manager", "cashier", "chef", "waiter", "driver", "inventory", "accountant", "customer"];
const ROLE_LABELS: Record<AccountRole, string> = { admin: "مدير عام", manager: "مدير فرع", cashier: "كاشير", chef: "شيف مطبخ", waiter: "مضيف صالة", driver: "موصل طلبات", inventory: "مسؤول مخزون", accountant: "محاسب", customer: "عميل" };
const BRANCH_ROLES = new Set<AccountRole>(["manager", "cashier", "chef", "waiter", "driver", "inventory", "accountant"]);
type Branch = { id: number; name: string };
type AdminUser = { id: number; phone: string | null; name: string | null; role: string | null; branchId: number | null; points: number | null; isAvailable: boolean | null; mustChangePassword: boolean | null; createdAt: string | Date | null; lastSignedIn: string | Date | null };
type Draft = { name: string; role: AccountRole | ""; branchId: number | null };
const inputStyle = { minHeight: 44, borderWidth: 1, borderColor: "#e7e3db", borderRadius: 11, paddingHorizontal: 11, backgroundColor: "#fff", color: "#0f172a", textAlign: "right" as const, fontFamily: "Cairo_400Regular" };
const formatDate = (value: string | Date | null | undefined) => { if (!value) return "غير مسجل"; const date = value instanceof Date ? value : new Date(value); return Number.isNaN(date.getTime()) ? "غير مسجل" : date.toLocaleDateString("ar-YE"); };

function UsersContent() {
  const usersQuery = trpc.admin.users.useQuery(undefined as never, { retry: false });
  const branchesQuery = trpc.admin.listBranches.useQuery(undefined as never, { retry: false });
  const createAccount = trpc.admin.createStaff.useMutation();
  const updateAccount = trpc.admin.updateUser.useMutation();
  const resetPassword = trpc.admin.resetUserPassword.useMutation();
  const setAvailability = trpc.admin.setAvailability.useMutation();
  const users = (usersQuery.data ?? []) as unknown as AdminUser[];
  const branches = (branchesQuery.data ?? []) as unknown as Branch[];
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [role, setRole] = useState<AccountRole | "">("");
  const [branchId, setBranchId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [passwordDrafts, setPasswordDrafts] = useState<Record<number, string>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const draftFor = (user: AdminUser): Draft => drafts[user.id] ?? { name: user.name ?? "", role: ACCOUNT_ROLES.includes(user.role as AccountRole) ? user.role as AccountRole : "", branchId: user.branchId };
  const changeDraft = (user: AdminUser, patch: Partial<Draft>) => setDrafts((current) => ({ ...current, [user.id]: { ...draftFor(user), ...patch } }));

  const submitAccount = async () => {
    setError(""); setNotice(""); const normalizedPhone = phone.trim(); const normalizedName = name.trim();
    if (!normalizedName) { setError("أدخل اسم الحساب."); return; }
    if (!/^7\d{8}$/.test(normalizedPhone)) { setError("أدخل رقم هاتف يمنيًا من 9 خانات يبدأ بالرقم 7."); return; }
    if (temporaryPassword.length < 10) { setError("كلمة المرور المؤقتة يجب ألا تقل عن 10 خانات."); return; }
    if (!role) { setError("اختر نوع الحساب."); return; }
    if (BRANCH_ROLES.has(role) && !branchId) { setError("اختر فرعًا لهذا الدور."); return; }
    try {
      const result = await createAccount.mutateAsync({ phone: normalizedPhone, name: normalizedName, role, ...(BRANCH_ROLES.has(role) && branchId ? { branchId } : {}), temporaryPassword } as never) as unknown as { id?: number };
      setTemporaryPassword(""); setPhone(""); setName(""); setRole(""); setBranchId(null); setNotice(`تم إنشاء الحساب${result?.id ? ` رقم ${result.id}` : ""}. سلّم كلمة المرور المؤقتة خارج التطبيق، ويلزم تغييرها عند أول دخول.`); await usersQuery.refetch();
    } catch (cause) { setTemporaryPassword(""); setError(cause instanceof Error ? cause.message : "تعذر إنشاء الحساب."); }
  };
  const saveAccount = async (user: AdminUser) => {
    setError(""); setNotice(""); const draft = draftFor(user);
    if (!draft.name.trim()) { setError("اسم الحساب مطلوب."); return; }
    if (!draft.role) { setError("اختر دورًا صالحًا للحساب قبل الحفظ."); return; }
    if (BRANCH_ROLES.has(draft.role) && !draft.branchId) { setError("حساب الموظف يتطلب فرعًا."); return; }
    try {
      await updateAccount.mutateAsync({ userId: user.id, name: draft.name.trim(), role: draft.role, branchId: BRANCH_ROLES.has(draft.role) ? draft.branchId : null } as never);
      setDrafts((current) => { const next = { ...current }; delete next[user.id]; return next; }); setNotice(`تم حفظ تعديلات حساب ${draft.name.trim()}.`); await usersQuery.refetch();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحديث الحساب."); }
  };
  const toggleAvailability = async (user: AdminUser) => {
    setError(""); setNotice(""); try { await setAvailability.mutateAsync({ userId: user.id, isAvailable: !user.isAvailable } as never); setNotice("تم تحديث حالة الحساب."); await usersQuery.refetch(); } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحديث حالة الحساب."); }
  };
  const submitReset = async (user: AdminUser) => {
    const password = passwordDrafts[user.id] ?? ""; setError(""); setNotice("");
    if (password.length < 10) { setError("كلمة المرور المؤقتة يجب ألا تقل عن 10 خانات."); return; }
    try { await resetPassword.mutateAsync({ userId: user.id, temporaryPassword: password } as never); setPasswordDrafts((current) => ({ ...current, [user.id]: "" })); setNotice(`تم تغيير كلمة مرور ${user.name || "الحساب"} إلى قيمة مؤقتة؛ يجب تغييرها عند الدخول التالي.`); await usersQuery.refetch(); }
    catch (cause) { setPasswordDrafts((current) => ({ ...current, [user.id]: "" })); setError(cause instanceof Error ? cause.message : "تعذر إعادة تعيين كلمة المرور."); }
  };

  return <View style={{ flex: 1, backgroundColor: "#fffdf8" }}><ScrollView contentContainerStyle={{ padding: 16, paddingTop: 20, paddingBottom: 36 }}>
    <AppText weight="bold" style={{ fontSize: 24 }}>الحسابات والصلاحيات الأساسية</AppText>
    <AppText style={{ color: "#667085", fontSize: 12, lineHeight: 20, marginTop: 4, marginBottom: 14 }}>إنشاء حسابات المديرين والموظفين والعملاء، وتعديل دور الحساب وفرعه وحالته. يمنع الخادم تخفيض آخر مدير عام نشط ويطلب تغيير كلمة المرور المؤقتة.</AppText>
    {error ? <Card style={{ backgroundColor: "#fff5f5", marginBottom: 10 }}><AppText style={{ color: "#b42318" }}>{error}</AppText></Card> : null}
    {notice ? <Card style={{ backgroundColor: "#edf7f0", borderColor: "#cce8d5", marginBottom: 10 }}><AppText style={{ color: "#166534", lineHeight: 21 }}>{notice}</AppText></Card> : null}
    {branchesQuery.isError ? <Card style={{ backgroundColor: "#fff5f5", marginBottom: 10 }}><AppText style={{ color: "#b42318" }}>تعذر تحميل الفروع؛ لن يتم حفظ حساب موظف بلا فرع موثوق.</AppText></Card> : null}
    <Card style={{ gap: 9, marginBottom: 17 }}>
      <SectionHeading title="إنشاء حساب" caption="رقم يمني من 9 خانات وكلمة مرور مؤقتة لا تقل عن 10 خانات" />
      <AppText weight="semibold" style={{ fontSize: 12 }}>الاسم</AppText><TextInput value={name} onChangeText={setName} maxLength={120} placeholder="الاسم المعتمد" placeholderTextColor="#98a2b3" style={inputStyle} />
      <AppText weight="semibold" style={{ fontSize: 12 }}>رقم الهاتف</AppText><TextInput value={phone} onChangeText={(value) => setPhone(value.replace(/[^0-9]/g, "").slice(0, 9))} keyboardType="phone-pad" maxLength={9} placeholder="7xxxxxxxx" placeholderTextColor="#98a2b3" style={inputStyle} />
      <AppText weight="semibold" style={{ fontSize: 12 }}>نوع الحساب</AppText><View style={{ flexDirection: "row-reverse", flexWrap: "wrap", rowGap: 7 }}>{ACCOUNT_ROLES.map((item) => <Pill key={item} title={ROLE_LABELS[item]} selected={role === item} onPress={() => setRole(item)} />)}</View>
      {role && BRANCH_ROLES.has(role) ? <><AppText weight="semibold" style={{ fontSize: 12 }}>الفرع</AppText><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse" }}>{branches.map((branch) => <Pill key={branch.id} title={branch.name} selected={branchId === branch.id} onPress={() => setBranchId(branch.id)} />)}</ScrollView></> : null}
      <AppText weight="semibold" style={{ fontSize: 12 }}>كلمة مرور مؤقتة</AppText><TextInput value={temporaryPassword} onChangeText={setTemporaryPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={128} placeholder="10 خانات على الأقل" placeholderTextColor="#98a2b3" style={inputStyle} />
      <AppText style={{ color: "#667085", fontSize: 11, lineHeight: 18 }}>لا تُعرض كلمة المرور بعد الإنشاء ولا تُحفظ في قائمة الحسابات. احفظها لدى صاحب الحساب عبر قناة خاصة وآمنة.</AppText>
      <PrimaryButton title="إنشاء الحساب" loading={createAccount.isPending} disabled={branchesQuery.isLoading || (Boolean(role) && BRANCH_ROLES.has(role as AccountRole) && branches.length === 0)} onPress={() => void submitAccount()} />
    </Card>
    <SectionHeading title="الحسابات المسجلة" caption="لا يعرض الخادم hash كلمة المرور" />
    {usersQuery.isLoading ? <Card><AppText style={{ color: "#667085" }}>جارٍ تحميل الحسابات...</AppText></Card> : null}
    {usersQuery.isError ? <Card style={{ backgroundColor: "#fff5f5" }}><AppText style={{ color: "#b42318" }}>تعذر تحميل الحسابات.</AppText><PrimaryButton title="إعادة المحاولة" onPress={() => void usersQuery.refetch()} style={{ marginTop: 8 }} /></Card> : null}
    {!usersQuery.isLoading && !usersQuery.isError && users.length === 0 ? <Card><AppText style={{ color: "#667085" }}>لا توجد حسابات.</AppText></Card> : null}
    {users.map((user) => { const draft = draftFor(user); const branchName = branches.find((branch) => branch.id === user.branchId)?.name; return <Card key={user.id} style={{ marginBottom: 10, gap: 7 }}>
      <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}><View style={{ flex: 1 }}><AppText weight="bold">{user.name || "اسم غير مسجل"}</AppText><AppText style={{ color: "#667085", fontSize: 11, marginTop: 2, writingDirection: "ltr", textAlign: "right" }}>{user.phone || "رقم غير مسجل"}</AppText></View><AppText weight="semibold" style={{ color: "#9a5300", fontSize: 11 }}>{ROLE_LABELS[user.role as AccountRole] ?? user.role ?? "دور غير مسجل"}</AppText></View>
      <AppText style={{ color: "#667085", fontSize: 11 }}>الفرع الحالي: {branchName ?? (user.branchId ? `رقم ${user.branchId}` : "غير مرتبط")}{user.points != null && user.role === "customer" ? ` · النقاط: ${user.points}` : ""}</AppText>
      <AppText style={{ color: user.mustChangePassword ? "#9a5300" : "#667085", fontSize: 11 }}>{user.mustChangePassword ? "مطلوب تغيير كلمة المرور عند الدخول" : "لا يوجد تغيير إلزامي لكلمة المرور"}</AppText>
      <AppText style={{ color: "#98a2b3", fontSize: 10 }}>أُنشئ: {formatDate(user.createdAt)} · آخر دخول: {formatDate(user.lastSignedIn)}</AppText>
      <AppText weight="semibold" style={{ fontSize: 12, marginTop: 3 }}>تعديل بيانات الحساب</AppText><TextInput value={draft.name} onChangeText={(value) => changeDraft(user, { name: value })} maxLength={120} placeholder="اسم الحساب" style={inputStyle} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse" }}>{ACCOUNT_ROLES.map((item) => <Pill key={item} title={ROLE_LABELS[item]} selected={draft.role === item} onPress={() => changeDraft(user, { role: item, branchId: BRANCH_ROLES.has(item) ? draft.branchId : null })} />)}</ScrollView>
      {draft.role && BRANCH_ROLES.has(draft.role) ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse" }}>{branches.map((branch) => <Pill key={branch.id} title={branch.name} selected={draft.branchId === branch.id} onPress={() => changeDraft(user, { branchId: branch.id })} />)}</ScrollView> : null}
      <PrimaryButton title="حفظ بيانات الحساب" loading={updateAccount.isPending} onPress={() => void saveAccount(user)} />
      <Pressable accessibilityRole="button" disabled={setAvailability.isPending} onPress={() => void toggleAvailability(user)} style={{ minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: user.isAvailable ? "#fff5f5" : "#edf7f0" }}><AppText weight="semibold" style={{ color: user.isAvailable ? "#b42318" : "#166534" }}>{user.isAvailable ? "إيقاف الحساب" : "تفعيل الحساب"}</AppText></Pressable>
      <TextInput value={passwordDrafts[user.id] ?? ""} onChangeText={(value) => setPasswordDrafts((current) => ({ ...current, [user.id]: value }))} secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={128} placeholder="كلمة مرور مؤقتة جديدة" style={inputStyle} />
      <PrimaryButton title="إعادة تعيين كلمة المرور" loading={resetPassword.isPending} onPress={() => void submitReset(user)} />
    </Card>; })}
  </ScrollView></View>;
}

export default function AdminUsersScreen() {
  return <RoleGuard permission="admin.manage" title="إدارة الحسابات"><UsersContent /></RoleGuard>;
}
