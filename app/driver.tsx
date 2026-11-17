import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { AppState, Pressable, ScrollView, TextInput, View } from "react-native";
import type { AppStateStatus } from "react-native";
import { RoleGuard } from "@/components/role-guard";
import { AppText, Card, PrimaryButton } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { formatYER, shortDate } from "@/lib/format";

const DRIVER_ROLES = ["driver"] as const;
type DriverOrder = Record<string, any>;

function detailLines(value: unknown): [string, string][] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const details = value as Record<string, unknown>;
  const labels: Record<string, string> = { customerName: "اسم المستلم", name: "الاسم", phone: "هاتف المستلم", address: "العنوان", street: "الشارع", district: "الحي", building: "المبنى", landmark: "علامة دالة", notes: "ملاحظات التوصيل" };
  return Object.entries(labels).flatMap(([key, label]) => {
    const field = details[key];
    return typeof field === "string" && field.trim() ? [[label, field.trim()] as [string, string]] : [];
  });
}

function DriverContent() {
  const query = trpc.driver.assignedOrders.useQuery(undefined as never, { refetchInterval: 15_000, retry: false });
  const updateStatus = trpc.orders.updateStatus.useMutation();
  const completeDelivery = trpc.driver.completeDelivery.useMutation();
  const locationUpdate = trpc.driver.locationUpdate.useMutation();
  const watcher = useRef<Location.LocationSubscription | null>(null);
  const locationSending = useRef(false);
  const [startingGps, setStartingGps] = useState(false);
  const [gpsOn, setGpsOn] = useState(false);
  const [gpsMessage, setGpsMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [cashAmounts, setCashAmounts] = useState<Record<string, string>>({});

  const stopGps = () => {
    watcher.current?.remove();
    watcher.current = null;
    setGpsOn(false);
  };

  useEffect(() => () => {
    watcher.current?.remove();
    watcher.current = null;
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state !== "active" && watcher.current) {
        watcher.current.remove();
        watcher.current = null;
        setGpsOn(false);
        setGpsMessage("أُوقف GPS عند انتقال التطبيق إلى الخلفية؛ أعد تفعيله عند الرجوع.");
      }
    });
    return () => subscription.remove();
  }, []);

  const startGps = async () => {
    if (watcher.current) return;
    setStartingGps(true);
    setGpsMessage("");
    setActionError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setGpsMessage("لم يُمنح إذن الموقع. لن يُقرأ GPS أو يُرسل شيء حتى توافق صراحةً.");
        return;
      }
      watcher.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5_000, distanceInterval: 15 },
        (location) => {
          if (locationSending.current) return;
          locationSending.current = true;
          void locationUpdate.mutateAsync({ lat: location.coords.latitude, lng: location.coords.longitude })
            .then(() => setGpsMessage(`أُرسل آخر موقع حقيقي ${location.coords.latitude.toFixed(5)}, ${location.coords.longitude.toFixed(5)} · ${new Date(location.timestamp).toLocaleTimeString("ar-YE")}`))
            .catch((error: unknown) => setActionError(error instanceof Error ? error.message : "تعذر إرسال موقع GPS إلى الخادم."))
            .finally(() => { locationSending.current = false; });
        },
      );
      setGpsOn(true);
      setGpsMessage("المتابعة مفعّلة بإذنك: كل 5 ثوانٍ أو بعد حركة 15 متراً.");
    } catch (error) {
      setGpsMessage(error instanceof Error ? `تعذر بدء GPS: ${error.message}` : "تعذر بدء GPS على هذا الجهاز.");
      stopGps();
    } finally {
      setStartingGps(false);
    }
  };

  const startDelivery = async (order: DriverOrder) => {
    setActionError("");
    setSuccessMessage("");
    try {
      await updateStatus.mutateAsync({ orderId: Number(order.id), status: "out_for_delivery" });
      setSuccessMessage(`بدأ توصيل الطلب ${order.orderNumber ?? order.id}.`);
      await query.refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "تعذر تحديث حالة الطلب.");
    }
  };

  const confirmDelivery = async (order: DriverOrder) => {
    setActionError("");
    setSuccessMessage("");
    const isCash = order.paymentMethod === "cash";
    const amount = isCash ? Number((cashAmounts[String(order.id)] ?? "").replace(/[^\d]/g, "")) : 0;
    if (isCash && (!Number.isSafeInteger(amount) || amount !== Number(order.total))) {
      setActionError(`أدخل المبلغ المستلم وطابقه مع الإجمالي ${formatYER(Number(order.total ?? 0))} قبل إغلاق الطلب.`);
      return;
    }
    try {
      await completeDelivery.mutateAsync({ orderId: Number(order.id), cashCollected: amount });
      setSuccessMessage(isCash ? `تم تسليم الطلب وتسجيل تحصيل ${formatYER(amount)}.` : `تم تسليم الطلب ${order.orderNumber ?? order.id}.`);
      setCashAmounts((current) => { const next = { ...current }; delete next[String(order.id)]; return next; });
      await query.refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "تعذر تسجيل التسليم والتحصيل.");
    }
  };

  const orders = (query.data ?? []) as unknown as DriverOrder[];
  return (
    <View style={{ flex: 1, backgroundColor: "#fffdf8" }}>
      <ScrollView contentContainerStyle={{ padding: 17, paddingTop: 20, paddingBottom: 32 }}>
        <AppText weight="bold" style={{ fontSize: 24 }}>طلبات التوصيل</AppText>
        <AppText style={{ color: "#667085", fontSize: 12, marginTop: 3, marginBottom: 14 }}>تُعرض الطلبات المسندة لحساب الموصل الحالي فقط.</AppText>
        <Card style={{ borderRightWidth: 4, borderRightColor: gpsOn ? "#15803d" : "#d97706", marginBottom: 12 }}>
          <AppText weight="bold" style={{ fontSize: 16 }}>مشاركة موقع GPS</AppText>
          <AppText style={{ color: "#667085", fontSize: 12, lineHeight: 19, marginTop: 4 }}>لن يُقرأ الموقع قبل ضغطك على تفعيل الموقع والموافقة على إذن الجهاز. يُرسل الموقع الحقيقي إلى الخادم كل 5 ثوانٍ أو بعد حركة 15 متراً؛ يتوقف عند انتقال التطبيق إلى الخلفية.</AppText>
          {gpsMessage ? <AppText style={{ color: gpsOn ? "#15803d" : "#667085", fontSize: 11, lineHeight: 17, marginTop: 8 }}>{gpsMessage}</AppText> : null}
          <PrimaryButton title={gpsOn ? "إيقاف مشاركة الموقع" : "تفعيل مشاركة الموقع"} loading={startingGps} disabled={locationUpdate.isPending && !gpsOn} onPress={() => gpsOn ? stopGps() : void startGps()} style={{ marginTop: 11, backgroundColor: gpsOn ? "#475467" : "#d97706" }} />
          {locationUpdate.isPending ? <AppText style={{ color: "#667085", fontSize: 11, marginTop: 7 }}>جارٍ إرسال إحداثيات GPS إلى الخادم...</AppText> : null}
        </Card>
        {actionError ? <Card style={{ backgroundColor: "#fff5f5", marginBottom: 10 }}><AppText style={{ color: "#b42318" }}>{actionError}</AppText></Card> : null}
        {successMessage ? <AppText style={{ color: "#15803d", marginBottom: 10 }}>{successMessage}</AppText> : null}
        {query.isLoading ? <Card><AppText style={{ color: "#667085" }}>جارٍ تحميل الطلبات المسندة...</AppText></Card> : null}
        {query.isError ? <Card style={{ backgroundColor: "#fff5f5" }}><AppText style={{ color: "#b42318" }}>تعذر تحميل الطلبات المسندة من الخادم. لم تُعرض طلبات أخرى.</AppText><PrimaryButton title="إعادة المحاولة" onPress={() => void query.refetch()} style={{ marginTop: 9 }} /></Card> : null}
        {!query.isLoading && !query.isError && orders.length === 0 ? <Card style={{ alignItems: "center", paddingVertical: 24 }}><AppText weight="semibold">لا توجد طلبات مسندة نشطة.</AppText></Card> : null}
        {orders.map((order, index) => {
          const details = detailLines(order.deliveryDetails);
          const inDelivery = order.status === "out_for_delivery";
          const isCash = order.paymentMethod === "cash";
          return <Card key={String(order.id ?? index)} style={{ marginBottom: 11, borderRightWidth: 3, borderRightColor: inDelivery ? "#0f766e" : "#d97706" }}>
            <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View><AppText weight="bold" style={{ fontSize: 17 }}>طلب {order.orderNumber ?? order.id}</AppText><AppText style={{ color: "#667085", fontSize: 11, marginTop: 3 }}>{order.createdAt ? shortDate(order.createdAt) : "تاريخ الإنشاء غير متاح"}</AppText></View>
              <AppText weight="semibold" style={{ color: inDelivery ? "#0f766e" : "#9a5300", fontSize: 12 }}>{inDelivery ? "في الطريق" : "جاهز للتوصيل"}</AppText>
            </View>
            <View style={{ marginTop: 11, gap: 7 }}>
              {details.length ? details.map(([label, value]) => <View key={label} style={{ flexDirection: "row-reverse", alignItems: "flex-start", gap: 5 }}><AppText weight="semibold" style={{ color: "#475467", fontSize: 12 }}>{label}:</AppText><AppText style={{ flex: 1, fontSize: 12 }}>{value}</AppText></View>) : <AppText style={{ color: "#667085", fontSize: 12 }}>لا يحتوي الطلب على تفاصيل عنوان توصيل قابلة للعرض.</AppText>}
              {order.orderType ? <AppText style={{ color: "#667085", fontSize: 11 }}>نوع الطلب: {order.orderType}</AppText> : null}
              <AppText weight="semibold" style={{ color: "#475467", fontSize: 12 }}>الإجمالي: {formatYER(Number(order.total ?? 0))} · {isCash ? "نقداً عند التسليم" : "دفع إلكتروني"}</AppText>
              {inDelivery && isCash ? <View style={{ marginTop: 3 }}><AppText style={{ color: "#667085", fontSize: 11, marginBottom: 5 }}>أدخل النقد المستلم الفعلي قبل تأكيد التسليم</AppText><TextInput value={cashAmounts[String(order.id)] ?? ""} onChangeText={(value) => setCashAmounts((current) => ({ ...current, [String(order.id)]: value.replace(/[^\d]/g, "") }))} keyboardType="number-pad" placeholder={String(order.total ?? "")} placeholderTextColor="#98a2b3" style={{ borderWidth: 1, borderColor: "#d0d5dd", borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, textAlign: "right", backgroundColor: "#fff" }} /></View> : null}
            </View>
            {!inDelivery ? <PrimaryButton title="بدء التوصيل" loading={updateStatus.isPending} onPress={() => void startDelivery(order)} style={{ marginTop: 12 }} /> : <Pressable onPress={() => void confirmDelivery(order)} disabled={completeDelivery.isPending} style={{ alignItems: "center", backgroundColor: "#edf7f0", borderRadius: 13, marginTop: 12, minHeight: 48, justifyContent: "center", opacity: completeDelivery.isPending ? 0.6 : 1 }}><AppText weight="bold" style={{ color: "#15803d" }}>{completeDelivery.isPending ? "جارٍ تسجيل التسليم والتحصيل..." : "تأكيد التسليم"}</AppText></Pressable>}
          </Card>;
        })}
        <Card style={{ backgroundColor: "#f8f9fb" }}><AppText style={{ color: "#667085", fontSize: 11, lineHeight: 18 }}>يقتصر التحكم على الطلبات المسندة التي يعيدها الخادم. إغلاق طلب نقدي يسجل التسليم والتحصيل في معاملة واحدة ويشترط مطابقة الإجمالي؛ يبقى التحقق النهائي للصندوق ضمن الوردية.</AppText></Card>
      </ScrollView>
    </View>
  );
}

export default function DriverScreen() {
  return <RoleGuard roles={DRIVER_ROLES} title="طلبات الموصل"><DriverContent /></RoleGuard>;
}
