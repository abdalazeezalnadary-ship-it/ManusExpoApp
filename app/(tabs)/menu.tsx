import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { FlatList, Pressable, TextInput, View } from "react-native";
import { AppText, Card, Pill } from "@/components/ui";
import { MENU_CATEGORIES, MENU_BY_CODE, MENU_PRODUCTS, type MenuProduct } from "@/lib/menu-data";
import { formatYER } from "@/lib/format";
import { useRestaurant } from "@/lib/restaurant-context";
import { trpc } from "@/lib/trpc";

type LiveItem = { sku: string; name: string; price: number; station: string | null; stock: number | null; isAvailable: boolean; categoryName: string | null };

export default function MenuScreen() {
  const { branch, branchCode, addToCart } = useRestaurant();
  const [categoryKey, setCategoryKey] = useState("all");
  const [search, setSearch] = useState("");
  const [added, setAdded] = useState<string | null>(null);
  const liveMenuQuery = trpc.menu.list.useQuery({ branchCode }, { enabled: branchCode === "dream-city-main", retry: false, staleTime: 30_000, refetchInterval: 60_000 });
  const liveRows = useMemo(() => (liveMenuQuery.data ?? []) as unknown as LiveItem[], [liveMenuQuery.data]);
  const products = useMemo<MenuProduct[]>(() => {
    if (liveRows.length === 0) return MENU_PRODUCTS;
    return liveRows.filter((row) => row.isAvailable).map((row) => {
      const seed = MENU_BY_CODE.get(row.sku);
      const category = MENU_CATEGORIES.find((entry) => entry.name === row.categoryName);
      return {
        id: row.sku,
        name: row.name,
        priceYER: Number(row.price),
        station: row.station ?? seed?.station ?? "hot",
        stock: row.stock ?? seed?.stock ?? null,
        isAvailable: row.isAvailable,
        categoryKey: seed?.categoryKey ?? category?.key ?? "other",
        categoryName: row.categoryName ?? seed?.categoryName ?? "غير مصنف",
      };
    });
  }, [liveRows]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ar");
    return products.filter((item) =>
      (categoryKey === "all" || item.categoryKey === categoryKey) &&
      (!query || item.name.toLocaleLowerCase("ar").includes(query))
    );
  }, [categoryKey, search, products]);

  if (branchCode !== "dream-city-main") {
    return (
      <View style={{ flex: 1, backgroundColor: "#fffdf8", padding: 18, paddingTop: 28 }}>
        <AppText weight="bold" style={{ fontSize: 23, marginBottom: 12 }}>منيو {branch.name}</AppText>
        <Card style={{ padding: 20, marginTop: 12 }}>
          <View style={{ width: 52, height: 52, borderRadius: 17, backgroundColor: "#fff3e2", alignItems: "center", justifyContent: "center", marginBottom: 14 }}><Ionicons name="restaurant-outline" size={24} color="#d97706" /></View>
          <AppText weight="bold" style={{ fontSize: 17, marginBottom: 6 }}>قائمة هذا الفرع لم تُرسل بعد</AppText>
          <AppText style={{ color: "#667085", lineHeight: 23 }}>لا نعرض منيو المركز الرئيسي على أنه تابع لكرسبي ميلز. اختر المركز الرئيسي لعرض القائمة الرسمية أو تواصل معنا للحصول على قائمة الفرع.</AppText>
        </Card>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fffdf8", paddingTop: 14 }}>
      <View style={{ paddingHorizontal: 18, marginBottom: 13 }}>
        <AppText weight="bold" style={{ fontSize: 24 }}>المنيو</AppText>
        <AppText style={{ color: "#667085", fontSize: 12, marginTop: 2 }}>{branch.name} · {products.length} صنفاً · {liveRows.length ? "تحديث الإدارة" : "القائمة الرسمية المحفوظة"}{liveMenuQuery.isFetching ? " · جارٍ التحقق" : ""}</AppText>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e7e3db", borderRadius: 14, paddingHorizontal: 12, marginTop: 14, height: 48 }}>
          <Ionicons name="search" size={19} color="#667085" />
          <TextInput value={search} onChangeText={setSearch} placeholder="ابحث عن صنف..." placeholderTextColor="#98a2b3" style={{ flex: 1, textAlign: "right", paddingHorizontal: 9, color: "#0f172a", fontFamily: "Cairo_400Regular", height: "100%" }} />
          {search ? <Pressable onPress={() => setSearch("")}><Ionicons name="close-circle" size={18} color="#98a2b3" /></Pressable> : null}
        </View>
        {liveMenuQuery.isError ? <AppText style={{ color: "#9a5300", fontSize: 10, marginTop: 4 }}>الخادم غير متاح؛ يعرض التطبيق بيانات المنيو الرسمية المحفوظة.</AppText> : null}
      </View>

      <FlatList
        horizontal
        data={[{ key: "all", name: "كل الأقسام" }, ...MENU_CATEGORIES.map(({ key, name }) => ({ key, name }))]}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 12, flexDirection: "row-reverse" }}
        renderItem={({ item }) => <Pill title={item.name} selected={categoryKey === item.key} onPress={() => setCategoryKey(item.key)} />}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30, gap: 9 }}
        initialNumToRender={12}
        windowSize={8}
        ListHeaderComponent={<AppText weight="semibold" style={{ color: "#667085", fontSize: 12, marginBottom: 3 }}>{filtered.length} صنفاً · الأسعار بالريال اليمني</AppText>}
        ListEmptyComponent={<Card style={{ marginTop: 12 }}><AppText weight="semibold">لا توجد نتائج مطابقة</AppText><AppText style={{ color: "#667085", fontSize: 12, marginTop: 4 }}>جرّب كلمة بحث أخرى.</AppText></Card>}
        renderItem={({ item }) => (
          <Card style={{ padding: 13, borderRadius: 16 }}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 11 }}>
              <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: "#fff3e2", alignItems: "center", justifyContent: "center" }}><Ionicons name="restaurant" size={18} color="#d97706" /></View>
              <View style={{ flex: 1 }}>
                <AppText weight="semibold" style={{ fontSize: 14 }}>{item.name}</AppText>
                <AppText style={{ color: "#667085", fontSize: 11, marginTop: 2 }}>{item.categoryName}</AppText>
              </View>
              <View style={{ alignItems: "flex-start", gap: 5 }}>
                <AppText weight="bold" style={{ fontSize: 13 }}>{formatYER(item.priceYER)}</AppText>
                <Pressable onPress={() => { addToCart(item); setAdded(item.id); setTimeout(() => setAdded(null), 1000); }} style={{ minWidth: 60, alignItems: "center", backgroundColor: added === item.id ? "#15803d" : "#0f172a", borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 }}>
                  <AppText weight="semibold" style={{ color: "#ffffff", fontSize: 11 }}>{added === item.id ? "أضيف ✓" : "إضافة +"}</AppText>
                </Pressable>
              </View>
            </View>
          </Card>
        )}
      />
    </View>
  );
}
