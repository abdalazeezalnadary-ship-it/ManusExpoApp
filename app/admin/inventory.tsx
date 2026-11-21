import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { RoleGuard } from "@/components/role-guard";
import { AppText, Card, Pill, PrimaryButton, SectionHeading } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

type Branch = { id: number; branchCode: string; name: string };
type InventoryItem = Record<string, any>;
const inputStyle = { minHeight: 46, borderWidth: 1, borderColor: "#e7e3db", borderRadius: 12, paddingHorizontal: 12, backgroundColor: "#ffffff", color: "#0f172a", textAlign: "right" as const, fontFamily: "Cairo_400Regular" };

function InventoryContent() {
  const { user } = useAuth();
  const branchesQuery = trpc.branches.list.useQuery(undefined as never, { retry: false });
  const inventoryQuery = trpc.inventory.list.useQuery(undefined as never, { retry: false });
  const lowStockQuery = trpc.inventory.lowStock.useQuery(undefined as never, { retry: false });
  const save = trpc.inventory.upsert.useMutation();
  const branches = (branchesQuery.data ?? []) as unknown as Branch[];
  const items = (inventoryQuery.data ?? []) as unknown as InventoryItem[];
  const lowItems = (lowStockQuery.data ?? []) as unknown as InventoryItem[];
  const isAdmin = user?.role === "admin";
  const ownBranch = branches.find((branch) => branch.id === Number(user?.branchId)) ?? null;
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [quantity, setQuantity] = useState("");
  const [threshold, setThreshold] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const targetBranch = editing ? Number(editing.branchId) : isAdmin ? selectedBranchId : ownBranch?.id ?? null;

  const reset = () => { setEditing(null); setName(""); setUnit(""); setQuantity(""); setThreshold(""); };
  const editItem = (item: InventoryItem) => {
    setEditing(item);
    setName(String(item.name ?? ""));
    setUnit(String(item.unit ?? ""));
    setQuantity(item.quantity === null || item.quantity === undefined ? "" : String(item.quantity));
    setThreshold(item.lowStockThreshold === null || item.lowStockThreshold === undefined ? "" : String(item.lowStockThreshold));
    setMessage(""); setError("");
  };
  const submit = async () => {
    setError(""); setMessage("");
    if (!name.trim() || !unit.trim()) { setError("اسم الصنف ووحدته مطلوبان."); return; }
    const parse = (value: string) => value.trim() === "" ? null : Number(value);
    const parsedQuantity = parse(quantity); const parsedThreshold = parse(threshold);
    if (parsedQuantity !== null && (!Number.isFinite(parsedQuantity) || parsedQuantity < 0)) { setError("أدخل كمية فعلية غير سالبة أو اتركها فارغة لتبقى غير معروفة."); return; }
    if (parsedThreshold !== null && (!Number.isFinite(parsedThreshold) || parsedThreshold < 0)) { setError("أدخل حداً أدنى فعلياً غير سالب أو اتركه فارغاً."); return; }
    if (!targetBranch) { setError("اختر فرعاً فعلياً قبل حفظ الصنف."); return; }
    try {
      const payload: Record<string, unknown> = { name: name.trim(), unit: unit.trim(), quantity: parsedQuantity, lowStockThreshold: parsedThreshold };
      if (editing) payload.id = Number(editing.id);
      else payload.branchId = targetBranch;
      await save.mutateAsync(payload as never);
      setMessage("حُفظت بيانات المخزون على الخادم.");
      reset();
      await Promise.all([inventoryQuery.refetch(), lowStockQuery.refetch()]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر حفظ الصنف."); }
  };

  return <View style={{ flex: 1, backgroundColor: "#fffdf8" }}><ScrollView contentContainerStyle={{ padding: 17, paddingTop: 20, paddingBottom: 34 }}>
    <AppText weight="bold" style={{ fontSize: 24 }}>إدارة المخزون</AppText>
    <AppText style={{ color: "#667085", fontSize: 12, marginTop: 3, marginBottom: 14 }}>تُعرض فقط الأرصدة والحدود التي أُدخلت فعلياً في بيانات الخادم.</AppText>
    {isAdmin ? <Card style={{ marginBottom: 13 }}><AppText weight="semibold">فرع الصنف الجديد</AppText><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse", marginTop: 8 }}>{branches.map((branch) => <Pill key={branch.id} title={branch.name} selected={selectedBranchId === branch.id} onPress={() => setSelectedBranchId(branch.id)} />)}</ScrollView></Card> : null}
    {error ? <Card style={{ backgroundColor: "#fff5f5", marginBottom: 10 }}><AppText style={{ color: "#b42318" }}>{error}</AppText></Card> : null}
    {message ? <AppText style={{ color: "#15803d", marginBottom: 10 }}>{message}</AppText> : null}
    <Card style={{ gap: 9, marginBottom: 17 }}>
      <SectionHeading title={editing ? `تعديل ${editing.name ?? "صنف"}` : "إضافة صنف مخزون"} caption="الاسم والوحدة والكميات المدخلة فقط؛ الفراغ يعني قيمة غير معروفة" />
      <AppText weight="semibold" style={{ fontSize: 12 }}>اسم الصنف</AppText><TextInput value={name} onChangeText={setName} placeholder="مثال: اسم معتمد في المخزون" placeholderTextColor="#98a2b3" style={inputStyle} />
      <AppText weight="semibold" style={{ fontSize: 12 }}>الوحدة</AppText><TextInput value={unit} onChangeText={setUnit} placeholder="مثال: كجم أو قطعة وفق السجل الفعلي" placeholderTextColor="#98a2b3" style={inputStyle} />
      <AppText weight="semibold" style={{ fontSize: 12 }}>الكمية الحالية</AppText><TextInput value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" placeholder="فارغ = غير مهيأ / غير معروف" placeholderTextColor="#98a2b3" style={inputStyle} />
      <AppText weight="semibold" style={{ fontSize: 12 }}>حد التنبيه الأدنى</AppText><TextInput value={threshold} onChangeText={setThreshold} keyboardType="decimal-pad" placeholder="فارغ = لا يوجد حد أدنى مضبوط" placeholderTextColor="#98a2b3" style={inputStyle} />
      <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 3 }}><View style={{ flex: 1 }}><PrimaryButton title={editing ? "حفظ التعديل" : "إضافة الصنف"} loading={save.isPending} onPress={() => void submit()} /></View>{editing ? <Pressable onPress={reset} style={{ paddingHorizontal: 13, justifyContent: "center", backgroundColor: "#f2f4f7", borderRadius: 12 }}><AppText weight="semibold">إلغاء</AppText></Pressable> : null}</View>
    </Card>
    <SectionHeading title="أصناف منخفضة المخزون" caption="مطابقة كمية فعلية مع حد أدنى فعلي فقط" />
    {lowStockQuery.isLoading ? <Card><AppText style={{ color: "#667085" }}>جارٍ التحقق من حدود المخزون...</AppText></Card> : null}
    {lowStockQuery.isError ? <Card style={{ backgroundColor: "#fff5f5" }}><AppText style={{ color: "#b42318" }}>تعذر تحميل قائمة انخفاض المخزون من الخادم.</AppText></Card> : null}
    {!lowStockQuery.isLoading && !lowStockQuery.isError && lowItems.length === 0 ? <Card style={{ marginBottom: 14 }}><AppText style={{ color: "#667085" }}>لا توجد أصناف أرجعها استعلام انخفاض المخزون؛ لم تُفترض حدود افتراضية.</AppText></Card> : null}
    {lowItems.map((item, index) => <Card key={String(item.id ?? index)} style={{ marginBottom: 8, backgroundColor: "#fff5e8", borderColor: "#f4d6ad" }}><View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}><View style={{ flex: 1 }}><AppText weight="bold">{item.name}</AppText><AppText style={{ color: "#9a5300", fontSize: 11, marginTop: 3 }}>الكمية {item.quantity ?? "غير معروفة"} {item.unit ?? ""} · الحد الأدنى {item.lowStockThreshold ?? "غير مضبوط"}</AppText></View><Pressable onPress={() => editItem(item)} style={{ padding: 8 }}><AppText weight="semibold" style={{ color: "#d97706" }}>تعديل</AppText></Pressable></View></Card>)}
    <SectionHeading title="كل أصناف المخزون" caption="من inventory.list" />
    {inventoryQuery.isLoading ? <Card><AppText style={{ color: "#667085" }}>جارٍ تحميل المخزون...</AppText></Card> : null}
    {inventoryQuery.isError ? <Card style={{ backgroundColor: "#fff5f5" }}><AppText style={{ color: "#b42318" }}>تعذر تحميل سجل المخزون من الخادم.</AppText><PrimaryButton title="إعادة المحاولة" onPress={() => void inventoryQuery.refetch()} style={{ marginTop: 9 }} /></Card> : null}
    {!inventoryQuery.isLoading && !inventoryQuery.isError && items.length === 0 ? <Card><AppText style={{ color: "#667085" }}>لا توجد سجلات مخزون لعرضها.</AppText></Card> : null}
    {items.map((item, index) => <Pressable key={String(item.id ?? index)} onPress={() => editItem(item)}><Card style={{ marginBottom: 8, paddingVertical: 12 }}><View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}><View style={{ flex: 1 }}><AppText weight="semibold">{item.name ?? "صنف"}</AppText><AppText style={{ color: "#667085", fontSize: 11, marginTop: 3 }}>الكمية: {item.quantity ?? "غير مهيأة"} {item.unit ?? ""} · حد التنبيه: {item.lowStockThreshold ?? "غير مضبوط"}</AppText></View><AppText weight="semibold" style={{ color: "#d97706", fontSize: 11 }}>تعديل</AppText></View></Card></Pressable>)}
  </ScrollView></View>;
}

export default function InventoryScreen() {
  return <RoleGuard permission="inventory.read" title="إدارة المخزون"><InventoryContent /></RoleGuard>;
}
