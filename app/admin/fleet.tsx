import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { RoleGuard } from "@/components/role-guard";
import { AppText, Card, PrimaryButton, SectionHeading } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { shortDate } from "@/lib/format";

const FLEET_ROLES = ["admin", "manager"] as const;
type FleetDriver = {
  driverId: number;
  name: string;
  branchId: number | null;
  latitude: number | string | null;
  longitude: number | string | null;
  recordedAt: string | Date | null;
  ageMs: number | null;
  isLive: boolean;
};

function validCoordinates(driver: FleetDriver) {
  const latitude = driver.latitude === null ? NaN : Number(driver.latitude);
  const longitude = driver.longitude === null ? NaN : Number(driver.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function ageText(ageMs: number | null | undefined) {
  if (ageMs === null || ageMs === undefined || !Number.isFinite(Number(ageMs))) return "عمر الإشارة غير متاح";
  const seconds = Math.max(0, Math.floor(Number(ageMs) / 1000));
  if (seconds < 60) return `منذ ${seconds} ث`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `منذ ${minutes} د`;
  const hours = Math.floor(minutes / 60);
  return `منذ ${hours} س`;
}

function FleetContent() {
  const fleetQuery = trpc.driver.fleet.useQuery(undefined, { retry: false, refetchInterval: 15_000 });
  const [mapError, setMapError] = useState("");
  const drivers = (fleetQuery.data ?? []) as unknown as FleetDriver[];

  const openMap = async (latitude: number, longitude: number) => {
    setMapError("");
    const mapUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
    try {
      await Linking.openURL(mapUrl);
    } catch {
      setMapError("تعذر فتح رابط OpenStreetMap على هذا الجهاز.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fffdf8" }}>
      <ScrollView contentContainerStyle={{ padding: 17, paddingTop: 20, paddingBottom: 34 }}>
        <AppText weight="bold" style={{ fontSize: 24 }}>أسطول الموصلين</AppText>
        <AppText style={{ color: "#667085", fontSize: 12, marginTop: 3, marginBottom: 15 }}>
          مواقع GPS التي أعادها الخادم فقط · تحديث تلقائي كل ١٥ ثانية
        </AppText>
        <SectionHeading title="حالة الأسطول" caption="الموصلون المسجلون وبيانات الموقع الفعلية" />

        {mapError ? <Card style={{ backgroundColor: "#fff5f5", marginBottom: 10 }}><AppText style={{ color: "#b42318" }}>{mapError}</AppText></Card> : null}
        {fleetQuery.isLoading ? (
          <Card><AppText style={{ color: "#667085" }}>جارٍ تحميل بيانات الأسطول...</AppText></Card>
        ) : fleetQuery.isError ? (
          <Card style={{ backgroundColor: "#fff5f5" }}>
            <AppText style={{ color: "#b42318", lineHeight: 20 }}>تعذر تحميل الأسطول؛ قد لا يكون هذا الحساب مديراً أو مشرفاً مخولاً.</AppText>
            <PrimaryButton title="إعادة المحاولة" onPress={() => void fleetQuery.refetch()} style={{ marginTop: 10 }} />
          </Card>
        ) : drivers.length === 0 ? (
          <Card><AppText style={{ color: "#667085", lineHeight: 20 }}>لم يُعِد الخادم أي موصلين للأسطول؛ لم تُضف أسماء أو مواقع بديلة.</AppText></Card>
        ) : drivers.map((driver) => {
          const coordinates = validCoordinates(driver);
          const live = driver.isLive === true;
          return (
            <Card key={String(driver.driverId)} style={{ marginBottom: 10, paddingVertical: 14 }}>
              <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <AppText weight="bold" style={{ fontSize: 16 }}>{driver.name || `موصل رقم ${driver.driverId}`}</AppText>
                  <AppText style={{ color: "#667085", fontSize: 11, marginTop: 3 }}>رقم الموصل: {driver.driverId}{driver.branchId ? ` · الفرع ${driver.branchId}` : ""}</AppText>
                </View>
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: live ? "#edf7f0" : "#fff5e8" }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: live ? "#15803d" : "#d97706" }} />
                  <AppText weight="semibold" style={{ color: live ? "#166534" : "#9a5300", fontSize: 11 }}>{live ? "حي" : "غير حي"}</AppText>
                </View>
              </View>

              {coordinates ? (
                <View style={{ marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#f2f4f7" }}>
                  <AppText style={{ color: "#475467", fontSize: 12, lineHeight: 20 }}>
                    الإحداثيات: {coordinates.latitude}, {coordinates.longitude}
                  </AppText>
                  <AppText style={{ color: live ? "#166534" : "#9a5300", fontSize: 11, marginTop: 3 }}>
                    {live ? "إشارة GPS حية" : "إشارة GPS قديمة أو غير مباشرة"} · {ageText(driver.ageMs)}
                  </AppText>
                  {driver.recordedAt ? <AppText style={{ color: "#667085", fontSize: 10, marginTop: 3 }}>آخر تسجيل: {shortDate(driver.recordedAt)}</AppText> : null}
                  <Pressable
                    onPress={() => void openMap(coordinates.latitude, coordinates.longitude)}
                    style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 12, backgroundColor: "#edf7f0", paddingVertical: 10, marginTop: 10 }}
                  >
                    <Ionicons name="map-outline" size={17} color="#166534" />
                    <AppText weight="semibold" style={{ color: "#166534", fontSize: 12 }}>فتح الموقع على OpenStreetMap</AppText>
                  </Pressable>
                </View>
              ) : (
                <AppText style={{ color: "#667085", fontSize: 12, lineHeight: 20, marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#f2f4f7" }}>
                  لا توجد إحداثيات GPS صالحة في نتيجة الخادم؛ لا يُعرض موقع ولا رابط خريطة.
                </AppText>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function FleetScreen() {
  return <RoleGuard roles={FLEET_ROLES} title="أسطول الموصلين"><FleetContent /></RoleGuard>;
}
