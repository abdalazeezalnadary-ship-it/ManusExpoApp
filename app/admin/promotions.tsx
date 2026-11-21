import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { RoleGuard } from "@/components/role-guard";
import { AppText, Card, Pill, PrimaryButton, SectionHeading } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

type Branch = { id: number; branchCode: string; name: string };
type Promotion = {
  id: number;
  branchId: number | null;
  name: string;
  code: string;
  description: string | null;
  discountPercent: number | null;
  discountAmount: number | null;
  minimumOrder: number;
  isActive: boolean;
};
const inputStyle = {
  minHeight: 46,
  borderWidth: 1,
  borderColor: "#e7e3db",
  borderRadius: 12,
  paddingHorizontal: 12,
  backgroundColor: "#ffffff",
  color: "#0f172a",
  textAlign: "right" as const,
  fontFamily: "Cairo_400Regular",
};

function PromotionsContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const branchesQuery = trpc.branches.list.useQuery(undefined, { retry: false });
  const branches = (branchesQuery.data ?? []) as unknown as Branch[];
  const managerBranchId = Number(user?.branchId) > 0 ? Number(user?.branchId) : null;
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const targetBranchId = isAdmin ? selectedBranchId : managerBranchId;
  const promotionsQuery = trpc.promotions.list.useQuery(
    { branchId: targetBranchId ?? undefined },
    { retry: false, enabled: isAdmin || !!managerBranchId },
  );
  const createPromotion = trpc.promotions.create.useMutation();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountKind, setDiscountKind] = useState<"percent" | "amount">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [minimumOrder, setMinimumOrder] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const promotionRows = (promotionsQuery.data ?? []) as unknown as Promotion[];
  const branchName = (branchId: number | null | undefined) => {
    if (branchId == null) return "عام · جميع الفروع";
    return branches.find((branch) => branch.id === Number(branchId))?.name ?? `فرع رقم ${branchId}`;
  };

  const resetForm = () => {
    setName(""); setCode(""); setDescription(""); setDiscountValue(""); setMinimumOrder(""); setIsActive(false);
  };

  const submit = async () => {
    setError(""); setMessage("");
    const parsedDiscount = discountValue.trim() === "" ? NaN : Number(discountValue);
    const parsedMinimum = minimumOrder.trim() === "" ? 0 : Number(minimumOrder);
    if (!name.trim() || !code.trim()) { setError("اسم الكوبون ورمزه مطلوبان."); return; }
    if (!Number.isSafeInteger(parsedDiscount) || parsedDiscount <= 0 || (discountKind === "percent" && parsedDiscount > 100)) {
      setError(discountKind === "percent" ? "أدخل نسبة خصم صحيحة من 1 إلى 100." : "أدخل مبلغ خصم صحيحاً موجباً."); return;
    }
    if (!Number.isSafeInteger(parsedMinimum) || parsedMinimum < 0) { setError("الحد الأدنى للطلب يجب أن يكون عدداً صحيحاً غير سالب."); return; }
    if (!isAdmin && !managerBranchId) { setError("لا يوجد فرع مرتبط بحساب المدير."); return; }
    try {
      const payload = {
        ...(targetBranchId ? { branchId: targetBranchId } : {}),
        name: name.trim(),
        code: code.trim().toUpperCase(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(discountKind === "percent" ? { discountPercent: parsedDiscount } : { discountAmount: parsedDiscount }),
        minimumOrder: parsedMinimum,
        isActive,
      };
      await createPromotion.mutateAsync(payload);
      setMessage("تم إنشاء الكوبون على الخادم.");
      resetForm();
      await promotionsQuery.refetch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إنشاء الكوبون.");
    }
  };

  return <View style={{ flex: 1, backgroundColor: "#fffdf8" }}><ScrollView contentContainerStyle={{ padding: 17, paddingTop: 20, paddingBottom: 34 }}>
    <AppText weight="bold" style={{ fontSize: 24 }}>إدارة الكوبونات</AppText>
    <AppText style={{ color: "#667085", fontSize: 12, marginTop: 3, marginBottom: 14 }}>إنشاء الكوبونات وعرض السجلات الفعلية المرتبطة بالفروع.</AppText>

    {isAdmin ? <Card style={{ marginBottom: 13 }}>
      <AppText weight="semibold">نطاق الكوبون والقائمة</AppText>
      {branchesQuery.isLoading ? <AppText style={{ color: "#667085", marginTop: 8 }}>جارٍ تحميل الفروع...</AppText> : null}
      {branchesQuery.isError ? <AppText style={{ color: "#b42318", marginTop: 8 }}>تعذر تحميل الفروع؛ ستظل الكوبونات العامة ظاهرة إن أعادها الخادم.</AppText> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse", marginTop: 8 }}>
        <Pill title="عام · كل الفروع" selected={selectedBranchId === null} onPress={() => setSelectedBranchId(null)} />
        {branches.map((branch) => <Pill key={branch.id} title={branch.name} selected={selectedBranchId === branch.id} onPress={() => setSelectedBranchId(branch.id)} />)}
      </ScrollView>
    </Card> : <Card style={{ marginBottom: 13 }}><AppText weight="semibold">فرع المدير</AppText><AppText style={{ color: "#667085", marginTop: 4 }}>{managerBranchId ? branchName(managerBranchId) : "لا يوجد فرع مرتبط بالحساب."}</AppText></Card>}

    {error ? <Card style={{ backgroundColor: "#fff5f5", marginBottom: 10 }}><AppText style={{ color: "#b42318" }}>{error}</AppText></Card> : null}
    {message ? <AppText style={{ color: "#15803d", marginBottom: 10 }}>{message}</AppText> : null}

    <Card style={{ gap: 9, marginBottom: 18 }}>
      <SectionHeading title="إنشاء كوبون" caption="يجب إدخال قيمة واحدة فقط: نسبة مئوية أو مبلغ ثابت" />
      <AppText weight="semibold" style={{ fontSize: 12 }}>اسم الكوبون</AppText>
      <TextInput value={name} onChangeText={setName} placeholder="اسم الكوبون" placeholderTextColor="#98a2b3" style={inputStyle} />
      <AppText weight="semibold" style={{ fontSize: 12 }}>رمز الكوبون</AppText>
      <TextInput value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="أدخل رمزاً فعلياً" placeholderTextColor="#98a2b3" style={inputStyle} />
      <AppText weight="semibold" style={{ fontSize: 12 }}>الوصف (اختياري)</AppText>
      <TextInput value={description} onChangeText={setDescription} multiline placeholder="وصف اختياري" placeholderTextColor="#98a2b3" style={[inputStyle, { minHeight: 70, paddingTop: 11, textAlignVertical: "top" }]} />
      <AppText weight="semibold" style={{ fontSize: 12 }}>نوع الخصم</AppText>
      <View style={{ flexDirection: "row-reverse", gap: 8 }}>
        <View style={{ flex: 1 }}><Pill title="نسبة مئوية" selected={discountKind === "percent"} onPress={() => { setDiscountKind("percent"); setDiscountValue(""); }} /></View>
        <View style={{ flex: 1 }}><Pill title="مبلغ ثابت" selected={discountKind === "amount"} onPress={() => { setDiscountKind("amount"); setDiscountValue(""); }} /></View>
      </View>
      <AppText weight="semibold" style={{ fontSize: 12 }}>{discountKind === "percent" ? "نسبة الخصم (٪)" : "مبلغ الخصم"}</AppText>
      <TextInput value={discountValue} onChangeText={setDiscountValue} keyboardType="number-pad" placeholder={discountKind === "percent" ? "أدخل نسبة من 1 إلى 100" : "أدخل مبلغ الخصم"} placeholderTextColor="#98a2b3" style={inputStyle} />
      <AppText weight="semibold" style={{ fontSize: 12 }}>الحد الأدنى للطلب</AppText>
      <TextInput value={minimumOrder} onChangeText={setMinimumOrder} keyboardType="number-pad" placeholder="اتركه فارغاً إن لم يوجد حد أدنى" placeholderTextColor="#98a2b3" style={inputStyle} />
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: isActive }} onPress={() => setIsActive((value) => !value)} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 9, paddingVertical: 6 }}>
        <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: isActive ? "#15803d" : "#98a2b3", backgroundColor: isActive ? "#15803d" : "#ffffff", alignItems: "center", justifyContent: "center" }}>
          {isActive ? <AppText weight="bold" style={{ color: "#ffffff", fontSize: 13, lineHeight: 16 }}>✓</AppText> : null}
        </View>
        <AppText weight="semibold">تفعيل الكوبون عند الإنشاء</AppText>
      </Pressable>
      <PrimaryButton title="إنشاء الكوبون" loading={createPromotion.isPending} disabled={!isAdmin && !managerBranchId} onPress={() => void submit()} />
    </Card>

    <SectionHeading title="الكوبونات المسجلة" caption="البيانات من promotions.list؛ الكوبون العام متاح عبر الفروع" />
    {promotionsQuery.isLoading ? <Card><AppText style={{ color: "#667085" }}>جارٍ تحميل الكوبونات...</AppText></Card> : null}
    {promotionsQuery.isError ? <Card style={{ backgroundColor: "#fff5f5" }}><AppText style={{ color: "#b42318" }}>تعذر تحميل الكوبونات من الخادم.</AppText><PrimaryButton title="إعادة المحاولة" onPress={() => void promotionsQuery.refetch()} style={{ marginTop: 9 }} /></Card> : null}
    {!promotionsQuery.isLoading && !promotionsQuery.isError && promotionRows.length === 0 ? <Card><AppText style={{ color: "#667085" }}>لا توجد كوبونات أرجعها الخادم لهذا النطاق.</AppText></Card> : null}
    {promotionRows.map((promotion) => <Card key={promotion.id} style={{ marginBottom: 8, paddingVertical: 13 }}>
      <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <AppText weight="bold">{promotion.name}</AppText>
          <AppText weight="semibold" style={{ color: "#9a5300" }}>{promotion.code}</AppText>
          {promotion.description ? <AppText style={{ color: "#667085", fontSize: 12 }}>{promotion.description}</AppText> : null}
          <AppText style={{ color: "#667085", fontSize: 11, marginTop: 2 }}>{promotion.discountPercent != null ? `خصم ${promotion.discountPercent}٪` : promotion.discountAmount != null ? `خصم مبلغ ثابت: ${promotion.discountAmount}` : "قيمة الخصم غير متاحة"} · الحد الأدنى: ${promotion.minimumOrder}</AppText>
          <AppText style={{ color: "#667085", fontSize: 11 }}>النطاق: {branchName(promotion.branchId)}</AppText>
        </View>
        <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: promotion.isActive ? "#edf7f0" : "#f2f4f7" }}>
          <AppText weight="semibold" style={{ color: promotion.isActive ? "#166534" : "#667085", fontSize: 11 }}>{promotion.isActive ? "مفعّل" : "غير مفعّل"}</AppText>
        </View>
      </View>
    </Card>)}
  </ScrollView></View>;
}

export default function PromotionsScreen() {
  return <RoleGuard permission="promotions.read" title="إدارة الكوبونات"><PromotionsContent /></RoleGuard>;
}
