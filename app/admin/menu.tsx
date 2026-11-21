import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ScrollView, Switch, TextInput, View } from "react-native";
import { RoleGuard } from "@/components/role-guard";
import { AppText, Card, Pill, PrimaryButton } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { formatYER } from "@/lib/format";
import { trpc } from "@/lib/trpc";

const STATIONS = [
  { key: "beverages", name: "مشروبات" },
  { key: "salad", name: "سلطات" },
  { key: "hot", name: "طبخ رئيسي" },
  { key: "grill", name: "مشويات" },
  { key: "fry", name: "مقليات / بروست" },
  { key: "desserts", name: "حلويات" },
] as const;
type Branch = { id: number; name: string; branchCode: string };
type MenuItem = { id: number; sku: string; name: string; price: number; station: string; categoryName?: string | null; isAvailable: boolean; stock?: number | null; branchId: number };
type Draft = { name: string; price: string; station: string; isAvailable: boolean };

function MenuContent() {
  const { user } = useAuth();
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const branchesQuery = trpc.branches.list.useQuery(undefined as never, { retry: false });
  const branches = (branchesQuery.data ?? []) as unknown as Branch[];
  const ownBranch = branches.find((branch) => branch.id === Number(user?.branchId));
  const branchId = user?.role === "admin" ? selectedBranchId : ownBranch?.id ?? null;
  const itemsQuery = trpc.menu.manageList.useQuery(branchId ? { branchId } : undefined as never, { enabled: Boolean(branchId), retry: false });
  const saveItem = trpc.menu.updateItem.useMutation();
  const items = (itemsQuery.data ?? []) as unknown as MenuItem[];
  const filtered = items.filter((item) => `${item.name} ${item.sku} ${item.categoryName ?? ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  const draftFor = (item: MenuItem): Draft => drafts[item.id] ?? { name: item.name, price: String(item.price), station: item.station, isAvailable: item.isAvailable };
  const changeDraft = (item: MenuItem, patch: Partial<Draft>) => setDrafts((current) => ({ ...current, [item.id]: { ...draftFor(item), ...patch } }));
  const persist = async (item: MenuItem) => {
    const draft = draftFor(item);
    const price = Number(draft.price);
    if (!draft.name.trim() || !Number.isSafeInteger(price) || price <= 0) {
      setError("أدخل اسماً وسعراً صحيحاً بالريال اليمني.");
      return;
    }
    setError("");
    setMessage("");
    try {
      await saveItem.mutateAsync({ id: item.id, ...(branchId ? { branchId } : {}), name: draft.name.trim(), price, station: draft.station as typeof STATIONS[number]["key"], isAvailable: draft.isAvailable });
      setMessage(`تم حفظ الصنف «${draft.name.trim()}» على الخادم.`);
      setDrafts((current) => { const next = { ...current }; delete next[item.id]; return next; });
      await itemsQuery.refetch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر حفظ تعديلات المنيو.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fffdf8" }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 20, paddingBottom: 34 }}>
        <AppText weight="bold" style={{ fontSize: 24 }}>إدارة المنيو والأسعار</AppText>
        <AppText style={{ color: "#667085", fontSize: 12, marginTop: 4, marginBottom: 14 }}>التعديلات تكتب إلى قاعدة بيانات الفرع وتُسجل في سجل التدقيق.</AppText>
        <Card style={{ backgroundColor: "#0f172a", borderColor: "#0f172a", marginBottom: 14 }}>
          <AppText weight="bold" style={{ color: "#fff", fontSize: 16 }}>الفرع</AppText>
          {branchesQuery.isLoading ? <AppText style={{ color: "#d0d5dd", marginTop: 7 }}>جارٍ تحميل الفروع الرسمية...</AppText> : null}
          {branchesQuery.isError ? <AppText style={{ color: "#fecaca", marginTop: 7 }}>تعذر تحميل الفروع؛ لا يمكن تعديل أي صنف دون التحقق من الفرع.</AppText> : null}
          {user?.role === "admin" ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse", marginTop: 8 }}>{branches.map((branch) => <Pill key={branch.id} title={branch.name} selected={selectedBranchId === branch.id} onPress={() => setSelectedBranchId(branch.id)} />)}</ScrollView> : <AppText style={{ color: "#fff", marginTop: 8 }}>{ownBranch?.name ?? "لا يوجد فرع مرتبط بالحساب."}</AppText>}
        </Card>
        {error ? <Card style={{ backgroundColor: "#fff5f5", marginBottom: 10 }}><AppText style={{ color: "#b42318" }}>{error}</AppText></Card> : null}
        {message ? <AppText style={{ color: "#15803d", marginBottom: 10 }}>{message}</AppText> : null}
        <View style={{ flexDirection: "row-reverse", alignItems: "center", borderRadius: 13, borderWidth: 1, borderColor: "#e4e7ec", backgroundColor: "#fff", paddingHorizontal: 12, marginBottom: 12 }}><Ionicons name="search-outline" size={18} color="#98a2b3" /><TextInput value={search} onChangeText={setSearch} placeholder="ابحث باسم الصنف أو رمزه أو القسم" placeholderTextColor="#98a2b3" style={{ flex: 1, textAlign: "right", paddingVertical: 12, marginRight: 8 }} /></View>
        {branchId ? <AppText style={{ color: "#667085", fontSize: 11, marginBottom: 9 }}>الأصناف المطابقة: {filtered.length} · الأسعار بالريال اليمني</AppText> : <Card><AppText style={{ color: "#667085" }}>اختر فرعاً لعرض منيوه، أو تحقق من ربط حساب المدير بفرع.</AppText></Card>}
        {itemsQuery.isLoading && branchId ? <Card><AppText style={{ color: "#667085" }}>جارٍ تحميل أصناف الفرع...</AppText></Card> : null}
        {itemsQuery.isError && branchId ? <Card style={{ backgroundColor: "#fff5f5" }}><AppText style={{ color: "#b42318" }}>تعذر تحميل منيو الفرع من الخادم. لم تُعرض أصناف تجريبية.</AppText><PrimaryButton title="إعادة المحاولة" onPress={() => void itemsQuery.refetch()} style={{ marginTop: 9 }} /></Card> : null}
        {!itemsQuery.isLoading && !itemsQuery.isError && branchId && filtered.length === 0 ? <Card><AppText style={{ color: "#667085" }}>لا توجد أصناف رسمية مطابقة في هذا الفرع. لم تُنسخ قائمة المركز الرئيسي إلى فرع آخر.</AppText></Card> : null}
        {filtered.map((item) => {
          const draft = draftFor(item);
          return <Card key={item.id} style={{ marginBottom: 10, borderRightWidth: 3, borderRightColor: draft.isAvailable ? "#d97706" : "#98a2b3" }}>
            <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}><AppText weight="bold" style={{ fontSize: 15 }}>{item.categoryName ?? "قسم غير محدد"}</AppText><AppText style={{ color: "#667085", fontSize: 10, marginTop: 2 }}>رمز الصنف: {item.sku}</AppText></View>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 5 }}><AppText style={{ color: "#667085", fontSize: 11 }}>{draft.isAvailable ? "متاح" : "موقوف"}</AppText><Switch value={draft.isAvailable} onValueChange={(value) => changeDraft(item, { isAvailable: value })} trackColor={{ false: "#d0d5dd", true: "#f4c27c" }} thumbColor={draft.isAvailable ? "#d97706" : "#f9fafb"} /></View>
            </View>
            <TextInput value={draft.name} onChangeText={(value) => changeDraft(item, { name: value })} placeholder="اسم الصنف" style={{ textAlign: "right", borderWidth: 1, borderColor: "#e4e7ec", borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, marginTop: 9 }} />
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 8 }}><TextInput value={draft.price} onChangeText={(value) => changeDraft(item, { price: value.replace(/[^\d]/g, "") })} keyboardType="number-pad" placeholder="السعر" style={{ flex: 1, textAlign: "right", borderWidth: 1, borderColor: "#e4e7ec", borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 }} /><AppText style={{ color: "#667085", fontSize: 11 }}>الحالي: {formatYER(Number(item.price))}</AppText></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse", marginTop: 9 }}>{STATIONS.map((station) => <Pill key={station.key} title={station.name} selected={draft.station === station.key} onPress={() => changeDraft(item, { station: station.key })} />)}</ScrollView>
            <PrimaryButton title="حفظ تعديلات الصنف" loading={saveItem.isPending} onPress={() => void persist(item)} style={{ marginTop: 9 }} />
          </Card>;
        })}
      </ScrollView>
    </View>
  );
}

export default function MenuAdminScreen() {
  return <RoleGuard permission="menu.read" title="إدارة المنيو"><MenuContent /></RoleGuard>;
}
