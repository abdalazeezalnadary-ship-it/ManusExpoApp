import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { AppText, Card, PrimaryButton, SectionHeading } from "@/components/ui";
import { CUSTOMER_SERVICE_PHONES, DELIVERY_PHONES, ROLE_LABELS } from "@/constants/restaurant";
import { useAuth } from "@/hooks/use-auth";

const quickLinks: Record<string, { title: string; description: string; icon: keyof typeof Ionicons.glyphMap; route: string }[]> = {
  admin: [
    { title: "لوحة الإدارة", description: "الطلبات والفروع والتشغيل", icon: "grid-outline", route: "/admin" },
    { title: "المطبخ KDS", description: "الطلبات ومحطات التحضير", icon: "restaurant-outline", route: "/kds" },
    { title: "إدارة المخزون", description: "الأرصدة والتنبيهات", icon: "cube-outline", route: "/admin/inventory" },
    { title: "المناوبات وZ-Report", description: "الورديات والتقارير", icon: "calculator-outline", route: "/admin/shifts" },
    { title: "المنيو والأسعار", description: "أصناف الفروع وأسعارها", icon: "restaurant-outline", route: "/admin/menu" },
    { title: "إعدادات التوصيل والولاء", description: "إدخال القيم الرسمية", icon: "options-outline", route: "/admin/settings" },
    { title: "الموظفون", description: "حسابات الموظفين وحالتهم", icon: "people-outline", route: "/admin/users" },
    { title: "النسخ الاحتياطي", description: "تصدير JSON دون كلمات مرور", icon: "cloud-download-outline", route: "/admin/backup" },
    { title: "الكوبونات", description: "إدارة العروض والخصومات", icon: "pricetag-outline", route: "/admin/promotions" },
    { title: "المرتجعات", description: "مراجعة حالات الإرجاع", icon: "return-down-back-outline", route: "/admin/returns" },
    { title: "الأسطول", description: "مواقع GPS الفعلية", icon: "bicycle-outline", route: "/admin/fleet" },
    { title: "المصروفات", description: "قيود الوردية", icon: "wallet-outline", route: "/admin/expenses" },
  ],
  manager: [
    { title: "لوحة الفرع", description: "الطلبات ومتابعة التشغيل", icon: "grid-outline", route: "/admin" },
    { title: "المطبخ KDS", description: "الطلبات ومحطات التحضير", icon: "restaurant-outline", route: "/kds" },
    { title: "إدارة المخزون", description: "الأرصدة والتنبيهات", icon: "cube-outline", route: "/admin/inventory" },
    { title: "المناوبات والتقارير", description: "الورديات وZ-Report", icon: "calculator-outline", route: "/admin/shifts" },
    { title: "المنيو والأسعار", description: "أصناف الفرع وأسعارها", icon: "restaurant-outline", route: "/admin/menu" },
    { title: "الكوبونات", description: "إدارة العروض", icon: "pricetag-outline", route: "/admin/promotions" },
    { title: "المرتجعات", description: "مراجعة حالات الإرجاع", icon: "return-down-back-outline", route: "/admin/returns" },
    { title: "الأسطول", description: "مواقع الموصلين الحقيقية", icon: "bicycle-outline", route: "/admin/fleet" },
    { title: "المصروفات", description: "الحركات داخل الوردية", icon: "wallet-outline", route: "/admin/expenses" },
  ],
  cashier: [
    { title: "المناوبات والصندوق", description: "فتح الوردية ومطابقة الصندوق", icon: "cash-outline", route: "/admin/shifts" },
    { title: "المطبخ KDS", description: "متابعة حالة الطلبات", icon: "restaurant-outline", route: "/kds" },
    { title: "المصروفات", description: "تسجيل المصروف ضمن وردية مفتوحة", icon: "wallet-outline", route: "/admin/expenses" },
  ],
  chef: [{ title: "المطبخ KDS", description: "الطلبات ومحطات التحضير", icon: "restaurant-outline", route: "/kds" }],
  waiter: [{ title: "المطبخ KDS", description: "متابعة حالة الأصناف", icon: "restaurant-outline", route: "/kds" }],
  driver: [{ title: "لوحة الموصل", description: "طلبات التوصيل ومشاركة الموقع", icon: "bicycle-outline", route: "/driver" }],
  inventory: [{ title: "إدارة المخزون", description: "الكميات والحدود والتكلفة", icon: "cube-outline", route: "/admin/inventory" }],
  accountant: [
    { title: "المحاسبة والتقارير", description: "Z-Report والقيود", icon: "calculator-outline", route: "/admin/shifts" },
    { title: "سجل المصروفات", description: "مراجعة حركات الفرع", icon: "wallet-outline", route: "/admin/expenses" },
  ],
  customer: [{ title: "طلباتي", description: "الحالات والتتبع", icon: "receipt-outline", route: "/orders" }],
  user: [{ title: "طلباتي", description: "الحالات والتتبع", icon: "receipt-outline", route: "/orders" }],
};

export default function AccountScreen() {
  const { user, loading, isAuthenticated, logout, refresh } = useAuth();
  const role = user?.role ?? "customer";
  const links = quickLinks[role] ?? quickLinks.customer!;
  const call = (phone: string) => Linking.openURL(`tel:${phone}`).catch(() => undefined);

  return (
    <View style={{ flex: 1, backgroundColor: "#fffdf8" }}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 20, paddingBottom: 34 }}>
        <AppText weight="bold" style={{ fontSize: 24 }}>حسابي</AppText>
        <AppText style={{ color: "#667085", marginTop: 3, marginBottom: 17, fontSize: 12 }}>بياناتك وطرق الوصول إلى الخدمة</AppText>
        <Card style={{ backgroundColor: "#0f172a", borderColor: "#0f172a", padding: 18 }}>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
            <View style={{ width: 53, height: 53, borderRadius: 18, backgroundColor: "#1b2b45", alignItems: "center", justifyContent: "center" }}><Ionicons name="person-outline" size={25} color="#f6bd6b" /></View>
            <View style={{ flex: 1 }}>
              <AppText weight="bold" style={{ color: "#ffffff", fontSize: 17 }}>{loading ? "جارٍ التحقق..." : isAuthenticated ? (user?.name || "مستخدم دريم سيتي") : "زائر"}</AppText>
              <AppText style={{ color: "#c3cbd8", fontSize: 12 }}>{isAuthenticated ? (user?.phone ?? user?.email ?? "") : "سجل الدخول لحفظ طلباتك ومتابعتها"}</AppText>
            </View>
            {isAuthenticated ? <View style={{ backgroundColor: "#d97706", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}><AppText weight="semibold" style={{ color: "#ffffff", fontSize: 10 }}>{ROLE_LABELS[role] ?? role}</AppText></View> : null}
          </View>
          {isAuthenticated && (role === "customer" || role === "user") ? <View style={{ marginTop: 15, paddingTop: 13, borderTopWidth: 1, borderTopColor: "#26354f", flexDirection: "row-reverse", justifyContent: "space-between" }}><AppText style={{ color: "#c3cbd8", fontSize: 12 }}>نقاط الولاء</AppText><AppText weight="bold" style={{ color: "#f6bd6b" }}>{user?.points ?? 0} نقطة</AppText></View> : null}
        </Card>

        {!isAuthenticated ? <PrimaryButton title="تسجيل الدخول أو إنشاء حساب" icon={<Ionicons name="log-in-outline" size={19} color="#ffffff" />} style={{ marginTop: 14 }} onPress={() => router.push("/login")} /> : null}
        {isAuthenticated && user?.mustChangePassword ? <Pressable onPress={() => router.push("/change-password")} style={{ marginTop: 12, backgroundColor: "#fff5e8", padding: 12, borderRadius: 12 }}><AppText weight="semibold" style={{ color: "#9a5300" }}>يجب تغيير كلمة المرور الأولية قبل متابعة الاستخدام. اضغط هنا.</AppText></Pressable> : null}

        <SectionHeading title="الخدمات المتاحة" caption={isAuthenticated ? "تُحسم صلاحية كل إجراء على الخادم" : "تصفح المنيو متاح للزائر"} />
        <View style={{ gap: 9, marginBottom: 22 }}>
          {links.map((item) => <Pressable key={item.route} onPress={() => router.push(item.route as never)}>
            <Card style={{ padding: 14, borderRadius: 16 }}><View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 11 }}><View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: "#fff3e2", alignItems: "center", justifyContent: "center" }}><Ionicons name={item.icon} size={20} color="#d97706" /></View><View style={{ flex: 1 }}><AppText weight="semibold" style={{ fontSize: 14 }}>{item.title}</AppText><AppText style={{ color: "#667085", fontSize: 11, marginTop: 2 }}>{item.description}</AppText></View><Ionicons name="chevron-back" size={17} color="#98a2b3" /></View></Card>
          </Pressable>)}
          {isAuthenticated ? <Pressable onPress={() => router.push("/change-password")}><Card style={{ padding: 14, borderRadius: 16 }}><View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 11 }}><Ionicons name="key-outline" size={20} color="#d97706" /><AppText weight="semibold" style={{ flex: 1 }}>تغيير كلمة المرور</AppText><Ionicons name="chevron-back" size={17} color="#98a2b3" /></View></Card></Pressable> : null}
        </View>

        <SectionHeading title="خدمة العملاء والتوصيل" caption="اتصل مباشرة من هاتفك" />
        <Card style={{ gap: 9, marginBottom: 20 }}>
          {[...CUSTOMER_SERVICE_PHONES, ...DELIVERY_PHONES].map((phone) => <Pressable key={phone} onPress={() => call(phone)} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingVertical: 3 }}><Ionicons name="call-outline" size={16} color="#d97706" /><AppText>{phone}</AppText></Pressable>)}
        </Card>
        {isAuthenticated ? <Pressable onPress={() => void logout()} style={{ borderWidth: 1, borderColor: "#f0c9c6", backgroundColor: "#fff7f6", borderRadius: 13, padding: 12, alignItems: "center" }}><AppText weight="semibold" style={{ color: "#b42318" }}>تسجيل الخروج</AppText></Pressable> : null}
        {isAuthenticated ? <Pressable onPress={() => void refresh()} style={{ alignSelf: "center", padding: 14 }}><AppText style={{ color: "#667085", fontSize: 11 }}>تحديث بيانات الحساب</AppText></Pressable> : null}
      </ScrollView>
    </View>
  );
}
