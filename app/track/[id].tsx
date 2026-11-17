import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { RoleGuard } from "@/components/role-guard";
import { AppText, Card, PrimaryButton } from "@/components/ui";
import { ORDER_STATUSES } from "@/constants/restaurant";
import { trpc } from "@/lib/trpc";
import { shortDate } from "@/lib/format";
import { OsmMap } from "@/components/osm-map";

const TRACK_ROLES = ["user", "customer", "admin", "manager", "cashier", "chef", "waiter", "driver", "accountant", "inventory"] as const;
type AnyObject = Record<string, any>;

function coordinate(record: AnyObject | null | undefined, keys: string[]): number | null {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function statusIndex(status: unknown) {
  const key = String(status ?? "");
  if (["pending", "review"].includes(key)) return 0;
  if (["confirmed", "preparing"].includes(key)) return 1;
  if (key === "ready") return 2;
  if (["out_for_delivery", "on_the_way"].includes(key)) return 3;
  if (["completed", "delivered"].includes(key)) return 4;
  return -1;
}

function TrackContent({ orderId }: { orderId: string }) {
  const idNumber = Number(orderId);
  const validId = Number.isInteger(idNumber) && idNumber > 0;
  const mine = trpc.orders.mine.useQuery(undefined as never, { enabled: validId, refetchInterval: 10_000, retry: false });
  const ownedOrder = useMemo(() => ((mine.data ?? []) as unknown as AnyObject[]).find((order) => String(order.id) === orderId) ?? null, [mine.data, orderId]);
  const trackingQuery = trpc.orders.track.useQuery({ orderId: idNumber }, { enabled: Boolean(ownedOrder && validId), refetchInterval: 10_000, retry: false });
  const trackedData = trackingQuery.data as unknown as AnyObject | null | undefined;
  const trackedOrder = trackedData?.order && typeof trackedData.order === "object" ? trackedData.order as AnyObject : trackedData;
  const order = ownedOrder ? { ...ownedOrder, ...(trackedOrder ?? {}) } : null;
  const location = (trackedData?.driverLocation ?? trackedData?.location ?? trackedData?.driver ?? trackedData) as AnyObject | null | undefined;
  const lat = coordinate(location, ["latitude", "lat"]);
  const lng = coordinate(location, ["longitude", "lng", "lon"]);
  const locationIsLive = location?.isLive === true;
  const locationAgeMs = Number.isFinite(Number(location?.ageMs)) ? Number(location?.ageMs) : null;
  const hasCoordinates = lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  const current = statusIndex(order?.status);

  if (!validId) return <Card><AppText weight="semibold">معرّف الطلب غير صالح.</AppText></Card>;
  if (mine.isLoading) return <Card><AppText style={{ color: "#667085" }}>جارٍ التحقق من ملكية الطلب...</AppText></Card>;
  if (mine.isError) return <Card style={{ backgroundColor: "#fff5f5" }}><AppText style={{ color: "#b42318" }}>تعذر جلب طلبات حسابك. لا يمكن عرض بيانات الطلب دون تحقق الملكية.</AppText><PrimaryButton title="إعادة المحاولة" onPress={() => void mine.refetch()} style={{ marginTop: 10 }} /></Card>;
  if (!ownedOrder) return <Card><AppText weight="bold" style={{ fontSize: 17 }}>الطلب غير موجود في حسابك</AppText><AppText style={{ color: "#667085", fontSize: 12, lineHeight: 19, marginTop: 5 }}>تُعرض تفاصيل طلبات الحساب الحالي فقط. لا توجد بيانات لهذا المعرّف ضمن طلباتك.</AppText></Card>;
  if (!order) return <Card><AppText style={{ color: "#667085" }}>تعذر تحميل بيانات الطلب.</AppText></Card>;

  const mapUrl = hasCoordinates ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}` : null;
  return <Card>
    <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
      <View><AppText weight="bold" style={{ fontSize: 18 }}>تتبع الطلب {order.orderNumber ?? order.id}</AppText><AppText style={{ color: "#667085", fontSize: 11, marginTop: 3 }}>{order.createdAt ? shortDate(order.createdAt) : "تاريخ الإنشاء غير متاح"}</AppText></View>
      <Pressable onPress={() => void mine.refetch()} accessibilityLabel="تحديث التتبع" style={{ padding: 9 }}><Ionicons name="refresh" size={20} color="#d97706" /></Pressable>
    </View>
    <AppText weight="semibold" style={{ marginTop: 18, marginBottom: 5 }}>حالة الطلب بالترتيب</AppText>
    {ORDER_STATUSES.map((status, index) => {
      const active = current >= index;
      return <View key={status.key} style={{ flexDirection: "row-reverse", alignItems: "center", paddingVertical: 7, gap: 9 }}>
        <View style={{ width: 11, height: 11, borderRadius: 7, backgroundColor: active ? status.color : "#e7e3db" }} />
        <AppText weight={active && current === index ? "bold" : "regular"} style={{ flex: 1, color: active ? status.color : "#98a2b3", fontSize: 13 }}>{status.label}</AppText>
        {active ? <Ionicons name="checkmark-circle" size={16} color={status.color} /> : null}
      </View>;
    })}
    {order.status === "cancelled" ? <AppText weight="semibold" style={{ color: "#b42318", marginTop: 8 }}>حالة الطلب: ملغي</AppText> : null}
    {hasCoordinates && mapUrl ? <View style={{ marginTop: 14, padding: 12, backgroundColor: "#edf7f0", borderRadius: 14 }}>
      <AppText weight="semibold" style={{ color: locationIsLive ? "#166534" : "#9a5300" }}>{locationIsLive ? "موقع الموصل مباشر ومحدّث" : "آخر موقع GPS مسجّل — قد لا يكون حديثاً"}</AppText>
      <AppText style={{ color: "#166534", fontSize: 11, marginTop: 4, textAlign: "left" }}>{lat}, {lng}</AppText>
      {locationAgeMs !== null ? <AppText style={{ color: locationIsLive ? "#166534" : "#9a5300", fontSize: 11, marginTop: 4 }}>آخر تحديث منذ {Math.max(0, Math.floor(locationAgeMs / 1000))} ثانية</AppText> : null}
      <OsmMap latitude={lat} longitude={lng} height={250} />
      <Pressable onPress={() => void Linking.openURL(mapUrl)} style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 }}><Ionicons name="map-outline" size={17} color="#166534" /><AppText weight="semibold" style={{ color: "#166534" }}>فتح الموقع على OpenStreetMap</AppText></Pressable>
    </View> : <View style={{ marginTop: 14, padding: 12, backgroundColor: "#f8f9fb", borderRadius: 14 }}><AppText weight="semibold" style={{ fontSize: 12 }}>موقع الموصل غير متاح حالياً</AppText><AppText style={{ color: "#667085", fontSize: 11, lineHeight: 18, marginTop: 4 }}>{trackingQuery.isError ? "تعذر الوصول إلى إجراء orders.track أو لا توجد إحداثيات أرسلها الموصل." : "لا توجد إحداثيات GPS حقيقية في بيانات الخادم؛ لا نعرض خريطة أو موقعاً تقديرياً."}</AppText></View>}
    <AppText style={{ color: "#98a2b3", fontSize: 10, lineHeight: 16, marginTop: 12 }}>يُحدّث الطلب المملوك لحسابك دورياً. مصدر حالات الطلب هو orders.mine؛ تفاصيل GPS لا تظهر إلا إذا أعادها الخادم.</AppText>
  </Card>;
}

function TrackScreenContent() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const orderId = Array.isArray(params.id) ? params.id[0] ?? "" : params.id ?? "";
  return <View style={{ flex: 1, backgroundColor: "#fffdf8" }}><ScrollView contentContainerStyle={{ padding: 18, paddingTop: 22, paddingBottom: 32 }}><AppText weight="bold" style={{ fontSize: 24, marginBottom: 14 }}>متابعة التوصيل</AppText><TrackContent orderId={orderId} /></ScrollView></View>;
}

export default function TrackScreen() {
  return <RoleGuard roles={TRACK_ROLES} title="تتبع الطلب"><TrackScreenContent /></RoleGuard>;
}
