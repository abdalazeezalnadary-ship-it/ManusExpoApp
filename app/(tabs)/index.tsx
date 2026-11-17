import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, View } from "react-native";
import { BranchLogo } from "@/components/branch-logo";
import { AppText, Card, OfflineBadge, Pill, SectionHeading } from "@/components/ui";
import { CUSTOMER_SERVICE_PHONES, DELIVERY_PHONES, RESTAURANT_BRANCHES } from "@/constants/restaurant";
import { MENU_CATEGORIES, MENU_PRODUCTS } from "@/lib/menu-data";
import { formatYER } from "@/lib/format";
import { useConnectivity } from "@/lib/use-connectivity";
import { useRestaurant } from "@/lib/restaurant-context";

export default function HomeScreen() {
  const { branch, branchCode, setBranchCode, addToCart, cartCount, setOrderType } = useRestaurant();
  const online = useConnectivity();
  const [branchPicker, setBranchPicker] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const displayed = MENU_PRODUCTS.slice(0, 4);
  const openCall = (phone: string) => Linking.openURL(`tel:${phone}`).catch(() => undefined);

  return (
    <View style={{ flex: 1, backgroundColor: "#fffdf8" }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 11 }}>
            <BranchLogo branchCode={branchCode} size={52} />
            <View>
              <AppText weight="bold" style={{ fontSize: 20 }}>دريم سيتي</AppText>
              <AppText style={{ color: "#667085", fontSize: 11 }}>مطاعم دريم سيتي</AppText>
            </View>
          </View>
          <View style={{ alignItems: "flex-start", gap: 6 }}>
            <OfflineBadge online={online} />
            {cartCount > 0 ? <AppText weight="semibold" style={{ color: "#d97706", fontSize: 11 }}>{cartCount} أصناف في السلة</AppText> : null}
          </View>
        </View>

        <Pressable onPress={() => setBranchPicker(true)} style={{ backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#ece6db", borderRadius: 16, padding: 13, flexDirection: "row-reverse", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <BranchLogo branchCode={branchCode} size={42} />
          <View style={{ flex: 1 }}>
            <AppText style={{ color: "#667085", fontSize: 11 }}>الفرع المختار</AppText>
            <AppText weight="bold" numberOfLines={1} style={{ fontSize: 14 }}>{branch.name}</AppText>
          </View>
          <Ionicons name="chevron-down" size={19} color="#667085" />
        </Pressable>

        <View style={{ backgroundColor: "#0f172a", borderRadius: 24, padding: 20, minHeight: 208, overflow: "hidden", marginBottom: 26 }}>
          <View style={{ position: "absolute", width: 180, height: 180, borderRadius: 90, borderWidth: 1, borderColor: "#26354f", top: -54, left: -27 }} />
          <View style={{ position: "absolute", width: 115, height: 115, borderRadius: 58, backgroundColor: "#d97706", opacity: 0.12, bottom: -48, right: -18 }} />
          <View style={{ alignSelf: "flex-start", backgroundColor: "#1b2b45", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginBottom: 12 }}>
            <AppText weight="semibold" style={{ color: "#f6bd6b", fontSize: 11 }}>طلبك على مزاجك</AppText>
          </View>
          <AppText weight="bold" style={{ color: "#fff7e8", fontSize: 23, lineHeight: 34, maxWidth: 310 }}>مذاق يقرّبكم،{"\n"}وخدمة توصلكم.</AppText>
          <AppText style={{ color: "#c3cbd8", fontSize: 13, marginTop: 6, maxWidth: 300 }}>استكشف قائمة المركز الرئيسي، أو اختر الفرع الأنسب لك.</AppText>
          <Pressable onPress={() => router.push("/menu")} style={{ alignSelf: "flex-start", marginTop: 18, backgroundColor: "#d97706", paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12, flexDirection: "row-reverse", gap: 7, alignItems: "center" }}>
            <AppText weight="bold" style={{ color: "#ffffff", fontSize: 13 }}>تصفح المنيو</AppText><Ionicons name="arrow-back" size={16} color="#ffffff" />
          </Pressable>
        </View>

        <SectionHeading title="كيف تحب تطلب؟" caption="اختر طريقة الاستلام المناسبة" />
        <View style={{ flexDirection: "row-reverse", gap: 9, marginBottom: 26 }}>
          {[
            { title: "توصيل", icon: "bicycle-outline" as const, type: "delivery" as const },
            { title: "سفري", icon: "bag-outline" as const, type: "pickup" as const },
            { title: "صالة / QR", icon: "qr-code-outline" as const, type: "table" as const },
          ].map((item) => (
            <Pressable key={item.title} onPress={() => { setOrderType(item.type); if (item.type === "table") router.push("/qr-order"); else router.push("/menu"); }} style={{ flex: 1, backgroundColor: "#ffffff", borderColor: "#eee9e1", borderWidth: 1, borderRadius: 16, alignItems: "center", paddingVertical: 14, gap: 6 }}>
              <Ionicons name={item.icon} size={21} color="#d97706" />
              <AppText weight="semibold" style={{ fontSize: 12 }}>{item.title}</AppText>
            </Pressable>
          ))}
        </View>

        <SectionHeading title="أقسام المنيو" caption="ستة أقسام من القائمة الرسمية" action={<AppText weight="semibold" style={{ color: "#d97706", fontSize: 12 }}>٢٩٣ صنفاً</AppText>} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -18, paddingHorizontal: 18, marginBottom: 25 }}>
          {MENU_CATEGORIES.map((category) => <Pill key={category.key} title={category.name} onPress={() => router.push("/menu")} />)}
        </ScrollView>

        <SectionHeading title="من القائمة الرسمية" caption="المركز الرئيسي — الأسعار بالريال اليمني" action={<Pressable onPress={() => router.push("/menu")}><AppText weight="semibold" style={{ color: "#d97706", fontSize: 12 }}>عرض الكل</AppText></Pressable>} />
        <View style={{ gap: 10, marginBottom: 25 }}>
          {displayed.map((item) => (
            <Card key={item.id} style={{ padding: 13, borderRadius: 16 }}>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: "#fff4e5", alignItems: "center", justifyContent: "center" }}><Ionicons name="restaurant" size={19} color="#d97706" /></View>
                <View style={{ flex: 1 }}>
                  <AppText weight="semibold" numberOfLines={1} style={{ fontSize: 14 }}>{item.name}</AppText>
                  <AppText style={{ color: "#667085", fontSize: 11, marginTop: 2 }}>{item.categoryName}</AppText>
                </View>
                <View style={{ alignItems: "flex-start", gap: 6 }}>
                  <AppText weight="bold" style={{ fontSize: 13, color: "#0f172a" }}>{formatYER(item.priceYER)}</AppText>
                  <Pressable onPress={() => { addToCart(item); setAdded(item.id); setTimeout(() => setAdded(null), 1100); }} style={{ backgroundColor: added === item.id ? "#15803d" : "#0f172a", paddingHorizontal: 11, paddingVertical: 5, borderRadius: 9 }}>
                    <AppText weight="semibold" style={{ color: "#ffffff", fontSize: 11 }}>{added === item.id ? "أضيف" : "أضف +"}</AppText>
                  </Pressable>
                </View>
              </View>
            </Card>
          ))}
        </View>

        <SectionHeading title="معلومات الفروع" />
        <View style={{ gap: 10 }}>
          {RESTAURANT_BRANCHES.map((item) => (
            <Pressable key={item.code} onPress={() => { void setBranchCode(item.code); setBranchPicker(false); }}>
              <Card style={{ padding: 14, borderRadius: 16 }}>
                <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 }}>
                  <BranchLogo branchCode={item.code} size={48} />
                  <View style={{ flex: 1 }}>
                    <AppText weight="bold" style={{ fontSize: 14 }}>{item.name}</AppText>
                    <AppText style={{ color: "#667085", fontSize: 12, marginTop: 3 }}>{item.address}</AppText>
                    <AppText style={{ color: "#667085", fontSize: 11, marginTop: 3 }}>{item.serviceType}</AppText>
                  </View>
                  {branchCode === item.code ? <Ionicons name="checkmark-circle" size={19} color="#15803d" /> : null}
                </View>
              </Card>
            </Pressable>
          ))}
        </View>

        <View style={{ marginTop: 25, paddingTop: 17, borderTopWidth: 1, borderTopColor: "#e7e3db" }}>
          <AppText weight="bold" style={{ fontSize: 14, marginBottom: 8 }}>خدمة العملاء والتوصيل</AppText>
          <View style={{ flexDirection: "row-reverse", gap: 8, flexWrap: "wrap" }}>
            {CUSTOMER_SERVICE_PHONES.map((phone) => <Pressable key={phone} onPress={() => openCall(phone)} style={{ backgroundColor: "#ffffff", borderRadius: 10, padding: 8, borderWidth: 1, borderColor: "#e7e3db" }}><AppText style={{ color: "#344054", fontSize: 12 }}>{phone}</AppText></Pressable>)}
            {DELIVERY_PHONES.map((phone) => <Pressable key={phone} onPress={() => openCall(phone)} style={{ backgroundColor: "#ffffff", borderRadius: 10, padding: 8, borderWidth: 1, borderColor: "#e7e3db" }}><AppText style={{ color: "#344054", fontSize: 12 }}>توصيل: {phone}</AppText></Pressable>)}
          </View>
        </View>
      </ScrollView>

      <Modal visible={branchPicker} transparent animationType="slide" onRequestClose={() => setBranchPicker(false)}>
        <Pressable onPress={() => setBranchPicker(false)} style={{ flex: 1, backgroundColor: "#0f172a88", justifyContent: "flex-end" }}>
          <Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: "#fffdf8", paddingHorizontal: 18, paddingTop: 22, paddingBottom: 32, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <View style={{ width: 38, height: 4, backgroundColor: "#d0d5dd", borderRadius: 2, alignSelf: "center", marginBottom: 15 }} />
            <SectionHeading title="اختر الفرع" caption="يُحفظ اختيارك على هذا الجهاز" />
            {RESTAURANT_BRANCHES.map((item) => <Pressable key={item.code} onPress={() => { void setBranchCode(item.code); setBranchPicker(false); }} style={{ paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#eee9e1", flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
              <BranchLogo branchCode={item.code} size={42} />
              <View style={{ flex: 1 }}><AppText weight="bold" style={{ fontSize: 14 }}>{item.name}</AppText><AppText style={{ color: "#667085", fontSize: 12 }}>{item.address}</AppText></View>
              <Ionicons name={branchCode === item.code ? "radio-button-on" : "radio-button-off"} size={20} color={branchCode === item.code ? "#d97706" : "#98a2b3"} />
            </Pressable>)}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
