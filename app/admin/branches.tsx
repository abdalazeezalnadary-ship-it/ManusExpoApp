import { useState } from "react";
import { Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { RoleGuard } from "@/components/role-guard";
import { AppText, Card, PrimaryButton, SectionHeading } from "@/components/ui";
import { trpc } from "@/lib/trpc";

type Branch = {
  id: number;
  branchCode: string;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  serviceType: string | null;
  isActive: boolean;
};
type Draft = { name: string; city: string; address: string; phone: string };
const fieldStyle = { minHeight: 44, borderWidth: 1, borderColor: "#e7e3db", borderRadius: 11, paddingHorizontal: 11, backgroundColor: "#fff", color: "#0f172a", textAlign: "right" as const, marginTop: 7 };
const asNullable = (value: string) => value.trim() || null;

function BranchesContent() {
  const branchesQuery = trpc.admin.listBranches.useQuery(undefined as never, { retry: false });
  const createBranch = trpc.admin.createBranch.useMutation();
  const updateBranch = trpc.admin.updateBranch.useMutation();
  const branches = (branchesQuery.data ?? []) as unknown as Branch[];
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [deactivateTarget, setDeactivateTarget] = useState<Branch | null>(null);

  const draftFor = (branch: Branch): Draft => drafts[branch.id] ?? { name: branch.name, city: branch.city ?? "", address: branch.address ?? "", phone: branch.phone ?? "" };
  const changeDraft = (branch: Branch, patch: Partial<Draft>) => setDrafts((current) => ({ ...current, [branch.id]: { ...draftFor(branch), ...patch } }));
  const submitCreate = async () => {
    setError(""); setNotice("");
    const normalizedCode = code.trim(); const normalizedName = name.trim();
    if (!/^[A-Za-z0-9_-]{2,64}$/.test(normalizedCode) || normalizedName.length < 2) { setError("أدخل رمز فرع لاتينيًا فريدًا واسمًا لا يقل عن حرفين."); return; }
    try {
      await createBranch.mutateAsync({ branchCode: normalizedCode, name: normalizedName, city: asNullable(city), address: asNullable(address), phone: asNullable(phone) } as never);
      setCode(""); setName(""); setCity(""); setAddress(""); setPhone(""); setNotice("تم إنشاء الفرع وتسجيل العملية في سجل التدقيق."); await branchesQuery.refetch();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر إنشاء الفرع."); }
  };
  const saveBranch = async (branch: Branch) => {
    const draft = draftFor(branch); setError(""); setNotice("");
    try {
      await updateBranch.mutateAsync({ branchId: branch.id, name: draft.name.trim(), city: asNullable(draft.city), address: asNullable(draft.address), phone: asNullable(draft.phone) } as never);
      setDrafts((current) => { const next = { ...current }; delete next[branch.id]; return next; }); setNotice(`تم حفظ بيانات ${draft.name.trim()} وتسجيل التغيير.`); await branchesQuery.refetch();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر حفظ بيانات الفرع."); }
  };
  const setBranchActive = async (branch: Branch, isActive: boolean) => {
    setError(""); setNotice("");
    try { await updateBranch.mutateAsync({ branchId: branch.id, isActive } as never); setDeactivateTarget(null); setNotice(isActive ? "تم تفعيل الفرع." : "تم إيقاف الفرع مع الإبقاء على سجلاته التاريخية."); await branchesQuery.refetch(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تغيير حالة الفرع."); setDeactivateTarget(null); }
  };

  return <View style={{ flex: 1, backgroundColor: "#fffdf8" }}><ScrollView contentContainerStyle={{ padding: 16, paddingTop: 20, paddingBottom: 36 }}>
    <AppText weight="bold" style={{ fontSize: 24 }}>إدارة الفروع</AppText>
    <AppText style={{ color: "#667085", fontSize: 12, lineHeight: 20, marginTop: 4, marginBottom: 14 }}>إضافة الفروع وتحديث بياناتها من الخادم. لا يُحذف أي فرع حتى تبقى الطلبات والسجلات التاريخية مرتبطة به.</AppText>
    {error ? <Card style={{ backgroundColor: "#fff5f5", marginBottom: 10 }}><AppText style={{ color: "#b42318" }}>{error}</AppText></Card> : null}
    {notice ? <Card style={{ backgroundColor: "#edf7f0", borderColor: "#cce8d5", marginBottom: 10 }}><AppText style={{ color: "#166534" }}>{notice}</AppText></Card> : null}
    <Card style={{ gap: 5, marginBottom: 18 }}>
      <SectionHeading title="إضافة فرع" caption="الرمز ثابت بعد الإنشاء ويُستخدم لتعريف الفرع في النظام" />
      <TextInput value={code} onChangeText={(value) => setCode(value.replace(/[^A-Za-z0-9_-]/g, ""))} autoCapitalize="none" placeholder="رمز الفرع (مثال: branch-03)" style={fieldStyle} />
      <TextInput value={name} onChangeText={setName} maxLength={180} placeholder="اسم الفرع" style={fieldStyle} />
      <TextInput value={city} onChangeText={setCity} maxLength={100} placeholder="المدينة (اختياري)" style={fieldStyle} />
      <TextInput value={address} onChangeText={setAddress} maxLength={2000} placeholder="العنوان (اختياري)" style={fieldStyle} />
      <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={32} placeholder="هاتف الفرع (اختياري)" style={fieldStyle} />
      <PrimaryButton title="إنشاء الفرع" loading={createBranch.isPending} onPress={() => void submitCreate()} style={{ marginTop: 10 }} />
    </Card>
    <SectionHeading title="الفروع المسجلة" caption="الإيقاف يمنع الاستخدام التشغيلي الجديد ولا يحذف البيانات" />
    {branchesQuery.isLoading ? <Card><AppText style={{ color: "#667085" }}>جارٍ تحميل الفروع...</AppText></Card> : null}
    {branchesQuery.isError ? <Card style={{ backgroundColor: "#fff5f5" }}><AppText style={{ color: "#b42318" }}>تعذر تحميل قائمة الفروع.</AppText><PrimaryButton title="إعادة المحاولة" onPress={() => void branchesQuery.refetch()} style={{ marginTop: 8 }} /></Card> : null}
    {!branchesQuery.isLoading && !branchesQuery.isError && branches.length === 0 ? <Card><AppText style={{ color: "#667085" }}>لا توجد فروع في الخادم.</AppText></Card> : null}
    {branches.map((branch) => { const draft = draftFor(branch); return <Card key={branch.id} style={{ marginBottom: 10, gap: 4 }}>
      <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8 }}><View style={{ flex: 1 }}><AppText weight="bold">{branch.name}</AppText><AppText style={{ color: "#667085", fontSize: 10, marginTop: 2, writingDirection: "ltr", textAlign: "right" }}>{branch.branchCode}</AppText></View><AppText weight="semibold" style={{ color: branch.isActive ? "#15803d" : "#667085", fontSize: 11 }}>{branch.isActive ? "نشط" : "موقوف"}</AppText></View>
      <TextInput value={draft.name} onChangeText={(value) => changeDraft(branch, { name: value })} maxLength={180} placeholder="اسم الفرع" style={fieldStyle} />
      <TextInput value={draft.city} onChangeText={(value) => changeDraft(branch, { city: value })} maxLength={100} placeholder="المدينة" style={fieldStyle} />
      <TextInput value={draft.address} onChangeText={(value) => changeDraft(branch, { address: value })} maxLength={2000} placeholder="العنوان" style={fieldStyle} />
      <TextInput value={draft.phone} onChangeText={(value) => changeDraft(branch, { phone: value })} maxLength={32} placeholder="هاتف الفرع" style={fieldStyle} />
      <PrimaryButton title="حفظ بيانات الفرع" loading={updateBranch.isPending} onPress={() => void saveBranch(branch)} style={{ marginTop: 7 }} />
      <Pressable accessibilityRole="button" onPress={() => branch.isActive ? setDeactivateTarget(branch) : void setBranchActive(branch, true)} style={{ minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: branch.isActive ? "#fff5f5" : "#edf7f0", marginTop: 2 }}><AppText weight="semibold" style={{ color: branch.isActive ? "#b42318" : "#166534" }}>{branch.isActive ? "إيقاف الفرع" : "تفعيل الفرع"}</AppText></Pressable>
    </Card>; })}
  </ScrollView>
  <Modal transparent visible={!!deactivateTarget} animationType="fade" onRequestClose={() => setDeactivateTarget(null)}><View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.55)", justifyContent: "center", padding: 22 }}><Card style={{ gap: 10 }}><AppText weight="bold" style={{ fontSize: 18 }}>تأكيد إيقاف الفرع</AppText><AppText style={{ color: "#667085", lineHeight: 22 }}>سيُخفى {deactivateTarget?.name} من الفروع النشطة. لن تُحذف الطلبات أو السجلات التاريخية، وقد يرفض الخادم الإيقاف إذا بقيت طلبات غير مكتملة.</AppText><PrimaryButton title="تأكيد الإيقاف" loading={updateBranch.isPending} onPress={() => deactivateTarget && void setBranchActive(deactivateTarget, false)} /><Pressable onPress={() => setDeactivateTarget(null)} style={{ minHeight: 42, alignItems: "center", justifyContent: "center" }}><AppText style={{ color: "#667085" }}>إلغاء</AppText></Pressable></Card></View></Modal>
  </View>;
}

export default function AdminBranchesScreen() {
  return <RoleGuard permission="admin.manage" title="إدارة الفروع"><BranchesContent /></RoleGuard>;
}
