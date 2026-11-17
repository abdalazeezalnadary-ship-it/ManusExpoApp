import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { AppText, Card, Pill, PrimaryButton, SectionHeading } from "@/components/ui";
import { formatYER, isValidYemeniPhone, normalizePhone } from "@/lib/format";
import { useRestaurant } from "@/lib/restaurant-context";
import { useAuth } from "@/hooks/use-auth";
import { useConnectivity } from "@/lib/use-connectivity";
import { makePendingOrder, pendingOrderCount, queueOrder, type PendingOrder } from "@/lib/offline-queue";
import { createTRPCClient, trpc } from "@/lib/trpc";

export default function CartScreen() {
  const { cart, cartTotal, changeQuantity, clearCart, branchCode, orderType, setOrderType, tableNumber, setTableNumber } = useRestaurant();
  const { isAuthenticated, user } = useAuth();
  const online = useConnectivity();
  const client = useMemo(() => createTRPCClient(), []);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [splitMode, setSplitMode] = useState<"none" | "equal" | "items">("none");
  const [people, setPeople] = useState(2);
  const [assignments, setAssignments] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [deliveryZoneCode, setDeliveryZoneCode] = useState("");
  const [loyaltyInput, setLoyaltyInput] = useState("");
  const deliveryZonesQuery = trpc.branches.deliveryZones.useQuery({ branchCode }, { enabled: orderType === "delivery", retry: false });
  const loyaltyInfoQuery = trpc.checkout.loyaltyInfo.useQuery(undefined as never, { enabled: isAuthenticated, retry: false });
  const selectedZoneCode = deliveryZonesQuery.data?.some((zone) => zone.code === deliveryZoneCode) ? deliveryZoneCode : deliveryZonesQuery.data?.[0]?.code ?? "";

  useEffect(() => {
    void pendingOrderCount().then(setQueuedCount);
  }, [message]);

  const equalParts = Array.from({ length: people }, (_, index) => Math.floor(cartTotal / Math.max(people, 1)) + (index < cartTotal % Math.max(people, 1) ? 1 : 0));
  const allocated = useMemo(() => {
    const totals = Array.from({ length: people }, () => 0);
    cart.forEach((line) => {
      const owner = Math.min(Math.max((assignments[line.id] ?? 1) - 1, 0), people - 1);
      totals[owner] += line.priceYER * line.quantity;
    });
    return totals;
  }, [cart, people, assignments]);

  const placeOrder = async () => {
    setMessage("");
    if (!cart.length) return;
    const recipientName = customerName ?? user?.name ?? "";
    const recipientPhone = phone ?? user?.phone ?? "";
    if (orderType === "delivery" && (!recipientName.trim() || !recipientPhone.trim() || !address.trim())) {
      setMessage("أكمل الاسم ورقم الهاتف والعنوان لإرسال طلب التوصيل.");
      return;
    }
    if (orderType === "delivery" && !isValidYemeniPhone(recipientPhone)) {
      setMessage("أدخل رقم هاتف يمني صحيحاً مكوّناً من 9 أرقام ويبدأ بـ 7.");
      return;
    }
    if (orderType === "delivery" && !deliveryZonesQuery.data?.some((zone) => zone.code === selectedZoneCode)) {
      setMessage("منطقة التوصيل ورسومها غير مهيأة لهذا الفرع. اختر السفري أو تواصل مع الفرع.");
      return;
    }
    if (orderType === "table" && !tableNumber.trim()) {
      setMessage("أدخل رقم الطاولة أو امسح رمز QR أولاً.");
      return;
    }
    const requestedLoyaltyPoints = loyaltyInput.trim() ? Number(loyaltyInput) : undefined;
    if (loyaltyInput.trim() && (!Number.isSafeInteger(requestedLoyaltyPoints) || Number(requestedLoyaltyPoints) < 1)) {
      setMessage("أدخل عدداً صحيحاً موجباً من نقاط الولاء.");
      return;
    }
    if (requestedLoyaltyPoints !== undefined && (!loyaltyInfoQuery.data?.redemption.enabled || requestedLoyaltyPoints > loyaltyInfoQuery.data.points)) {
      setMessage("رصيد نقاط الولاء أو إعداد الاستبدال غير متاح. تحقق من الحساب وإعدادات الإدارة.");
      return;
    }
    if (online && !isAuthenticated) {
      setMessage("سجّل الدخول أو أنشئ حساباً لحفظ الطلب ومتابعته.");
      router.push("/login");
      return;
    }
    setSending(true);
    const pending = makePendingOrder(branchCode, orderType, cart, {
      tableNumber: orderType === "table" ? tableNumber.trim() : undefined,
      deliveryDetails: orderType === "delivery" ? { customerName: recipientName.trim(), phone: normalizePhone(recipientPhone), address: address.trim() } : undefined,
      deliveryZoneCode: orderType === "delivery" ? selectedZoneCode : undefined,
    });
    const split: PendingOrder["split"] = splitMode === "none" ? undefined : splitMode === "equal" ? { mode: "equal", people } : { mode: "items", people, assignments };
    const completePayload: Omit<PendingOrder, "createdAt"> = { ...pending, couponCode: couponCode.trim() || undefined, loyaltyPoints: requestedLoyaltyPoints, split };
    try {
      if (online) {
        try {
          await client.orders.create.mutate({ ...completePayload, orderType: orderType === "table" ? "dine_in" : orderType, splitMetadata: split } as never);
          clearCart();
          setMessage("تم استلام طلبك وإرساله إلى الفرع.");
          router.push("/orders");
          return;
        } catch (cause) {
          const code = (cause as { data?: { code?: string } })?.data?.code;
          const errorText = cause instanceof Error ? cause.message : "تعذر اعتماد الطلب.";
          if (["BAD_REQUEST", "UNAUTHORIZED", "FORBIDDEN", "CONFLICT", "NOT_FOUND"].includes(code ?? "")) {
            setMessage(errorText);
            if (code === "UNAUTHORIZED") router.push("/login");
            return;
          }
          await queueOrder(completePayload);
          setQueuedCount(await pendingOrderCount());
          clearCart();
          setMessage("تعذر الوصول إلى الخادم؛ حُفظ الطلب محلياً لإعادة المحاولة بأمان.");
        }
      } else {
        await queueOrder(completePayload);
        setQueuedCount(await pendingOrderCount());
        clearCart();
        setMessage("حُفظ طلبك على الجهاز وسيرسل تلقائياً بعد تسجيل الدخول وعودة الاتصال.");
      }
    } catch {
      setQueuedCount(await pendingOrderCount());
      setMessage("تعذر حفظ الطلب على الجهاز. تحقق من مساحة التخزين ثم أعد المحاولة.");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fffdf8" }}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 20, paddingBottom: 34 }} keyboardShouldPersistTaps="handled">
        <AppText weight="bold" style={{ fontSize: 24 }}>سلة الطلب</AppText>
        <AppText style={{ color: "#667085", fontSize: 12, marginTop: 3, marginBottom: 18 }}>مراجعة الأصناف قبل الإرسال إلى {branchCode === "dream-city-main" ? "المركز الرئيسي" : "كرسبي ميلز"}</AppText>

        {!cart.length ? (
          <Card style={{ alignItems: "center", paddingVertical: 28 }}>
            <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: "#fff3e2", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><Ionicons name="bag-outline" size={28} color="#d97706" /></View>
            <AppText weight="bold" style={{ fontSize: 17 }}>سلتك فارغة</AppText>
            <AppText style={{ color: "#667085", textAlign: "center", marginTop: 5, marginBottom: 16 }}>أضف أصنافاً من المنيو، ثم أكمل طريقة الاستلام.</AppText>
            <PrimaryButton title="تصفح المنيو" onPress={() => router.push("/menu")} />
            {queuedCount > 0 ? <AppText style={{ color: "#d97706", marginTop: 12 }}>لديك {queuedCount} طلبات بانتظار المزامنة.</AppText> : null}
          </Card>
        ) : (
          <>
            <View style={{ gap: 9, marginBottom: 18 }}>
              {cart.map((line) => (
                <Card key={line.id} style={{ padding: 13, borderRadius: 16 }}>
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <View style={{ flex: 1 }}><AppText weight="semibold" style={{ fontSize: 14 }}>{line.name}</AppText><AppText style={{ color: "#667085", fontSize: 11 }}>{formatYER(line.priceYER)} · {line.station}</AppText></View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Pressable onPress={() => changeQuantity(line.id, 1)} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center" }}><Ionicons name="add" size={18} color="#fff" /></Pressable>
                      <AppText weight="bold" style={{ minWidth: 15, textAlign: "center" }}>{line.quantity}</AppText>
                      <Pressable onPress={() => changeQuantity(line.id, -1)} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#f2eee7", alignItems: "center", justifyContent: "center" }}><Ionicons name="remove" size={18} color="#0f172a" /></Pressable>
                    </View>
                  </View>
                  {splitMode === "items" ? <View style={{ flexDirection: "row-reverse", alignItems: "center", marginTop: 12, gap: 5 }}><AppText style={{ color: "#667085", fontSize: 11, marginLeft: 4 }}>حساب الشخص:</AppText>{Array.from({ length: people }, (_, index) => index + 1).map((person) => <Pill key={person} title={`${person}`} selected={(assignments[line.id] ?? 1) === person} onPress={() => setAssignments((current) => ({ ...current, [line.id]: person }))} />)}</View> : null}
                </Card>
              ))}
            </View>

            <SectionHeading title="طريقة الاستلام" />
            <View style={{ flexDirection: "row-reverse", gap: 7, marginBottom: 14 }}>
              {([
                ["delivery", "توصيل"], ["pickup", "سفري"], ["table", "طاولة"],
              ] as const).map(([value, label]) => <Pressable key={value} onPress={() => setOrderType(value)} style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, backgroundColor: orderType === value ? "#0f172a" : "#ffffff", borderWidth: 1, borderColor: orderType === value ? "#0f172a" : "#e7e3db" }}><AppText weight="semibold" style={{ color: orderType === value ? "#fff" : "#475467", fontSize: 12 }}>{label}</AppText></Pressable>)}
            </View>

            {orderType === "delivery" ? <Card style={{ gap: 10, marginBottom: 14 }}>
              <AppText weight="bold" style={{ fontSize: 14 }}>بيانات التوصيل</AppText>
              <AppText style={{ color: "#667085", fontSize: 11 }}>اختر منطقة معتمدة ليحسب الخادم رسومها الرسمية.</AppText>
              {deliveryZonesQuery.isLoading ? <AppText style={{ color: "#667085", fontSize: 12 }}>جارٍ تحميل مناطق التوصيل...</AppText> : deliveryZonesQuery.data?.length ? <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 }}>{deliveryZonesQuery.data.map((zone) => <Pill key={zone.code} title={`${zone.name} · ${formatYER(zone.fee)}`} selected={selectedZoneCode === zone.code} onPress={() => setDeliveryZoneCode(zone.code)} />)}</View> : <AppText style={{ color: "#9a5300", fontSize: 12 }}>لم تُهيأ مناطق التوصيل ورسومها لهذا الفرع بعد.</AppText>}
              <TextInput value={customerName ?? user?.name ?? ""} onChangeText={setCustomerName} placeholder="اسم المستلم" placeholderTextColor="#98a2b3" maxLength={120} style={inputStyle} />
              <TextInput value={phone ?? user?.phone ?? ""} onChangeText={setPhone} placeholder="رقم الهاتف" placeholderTextColor="#98a2b3" keyboardType="phone-pad" maxLength={20} style={inputStyle} />
              <TextInput value={address} onChangeText={setAddress} placeholder="العنوان بالتفصيل" placeholderTextColor="#98a2b3" maxLength={300} style={[inputStyle, { minHeight: 74, textAlignVertical: "top" }]} multiline />
              <AppText style={{ color: "#667085", fontSize: 11, lineHeight: 18 }}>تُضاف الرسوم المختارة من الإعداد الرسمي فقط؛ لا تُستخدم رسوم افتراضية.</AppText>
            </Card> : null}

            {orderType === "table" ? <Card style={{ marginBottom: 14 }}>
              <AppText weight="bold" style={{ fontSize: 14, marginBottom: 9 }}>رقم الطاولة</AppText>
              <View style={{ flexDirection: "row-reverse", gap: 8 }}><TextInput value={tableNumber} onChangeText={setTableNumber} placeholder="مثال: طاولة 4" placeholderTextColor="#98a2b3" maxLength={32} style={[inputStyle, { flex: 1 }]} /><Pressable onPress={() => router.push("/qr-order")} style={{ width: 48, borderRadius: 12, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center" }}><Ionicons name="qr-code-outline" size={20} color="#ffffff" /></Pressable></View>
            </Card> : null}

            <Card style={{ marginBottom: 14 }}>
              <AppText weight="bold" style={{ fontSize: 14, marginBottom: 10 }}>تقسيم الفاتورة</AppText>
              <View style={{ flexDirection: "row-reverse", gap: 7 }}>
                {([
                  ["none", "بدون"], ["equal", "بالتساوي"], ["items", "حسب الأصناف"],
                ] as const).map(([value, label]) => <Pressable key={value} onPress={() => setSplitMode(value)} style={{ flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 11, backgroundColor: splitMode === value ? "#fff3e2" : "#f8f7f4", borderWidth: splitMode === value ? 1 : 0, borderColor: "#f0c78f" }}><AppText weight="semibold" style={{ color: splitMode === value ? "#9a5300" : "#667085", fontSize: 11 }}>{label}</AppText></Pressable>)}
              </View>
              {splitMode !== "none" ? <View style={{ marginTop: 12 }}>
                <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}><AppText style={{ color: "#667085", fontSize: 12 }}>عدد الأشخاص</AppText><View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Pressable onPress={() => setPeople((value) => Math.max(2, value - 1))}><Ionicons name="remove-circle-outline" size={23} color="#0f172a" /></Pressable><AppText weight="bold">{people}</AppText><Pressable onPress={() => setPeople((value) => Math.min(12, value + 1))}><Ionicons name="add-circle-outline" size={23} color="#0f172a" /></Pressable></View></View>
                {splitMode === "equal" ? equalParts.map((value, index) => <AppText key={index} style={{ color: "#667085", marginTop: 4, fontSize: 12 }}>الشخص {index + 1}: {formatYER(value)}</AppText>) : allocated.map((value, index) => <AppText key={index} style={{ color: "#667085", marginTop: 4, fontSize: 12 }}>الشخص {index + 1}: {formatYER(value)}</AppText>)}
              </View> : null}
            </Card>

            <Card style={{ marginBottom: 14 }}>
              <AppText weight="bold" style={{ fontSize: 14, marginBottom: 8 }}>نقاط الولاء</AppText>
              {!isAuthenticated ? <AppText style={{ color: "#667085", fontSize: 11 }}>سجّل الدخول لعرض الرصيد واستبدال النقاط.</AppText> : loyaltyInfoQuery.isLoading ? <AppText style={{ color: "#667085", fontSize: 11 }}>جارٍ تحميل رصيد الولاء من الخادم...</AppText> : loyaltyInfoQuery.isError ? <AppText style={{ color: "#9a5300", fontSize: 11 }}>تعذر التحقق من الرصيد؛ لن تُستخدم نقاط دون تأكيد الخادم.</AppText> : loyaltyInfoQuery.data?.redemption.enabled ? <>
                <AppText style={{ color: "#667085", fontSize: 11 }}>رصيدك: {loyaltyInfoQuery.data.points} نقطة</AppText>
                <TextInput value={loyaltyInput} onChangeText={(value) => setLoyaltyInput(value.replace(/[^\d]/g, ""))} placeholder="عدد النقاط التي تريد استبدالها" placeholderTextColor="#98a2b3" keyboardType="number-pad" style={inputStyle} />
                {loyaltyInput.trim() ? <AppText style={{ color: "#9a5300", fontSize: 11 }}>قيمة الخصم التقديرية: {formatYER(Math.min(Math.floor(Number(loyaltyInput) / Number(loyaltyInfoQuery.data.redemption.pointsPerUnit ?? 1)), Math.floor(cartTotal / Number(loyaltyInfoQuery.data.redemption.valuePerPoint ?? 1))) * Number(loyaltyInfoQuery.data.redemption.valuePerPoint ?? 0))} · يعتمد المبلغ النهائي على الخادم.</AppText> : null}
              </> : <AppText style={{ color: "#667085", fontSize: 11 }}>استبدال النقاط غير مفعّل حتى يضيف المدير القيم الرسمية.</AppText>}
            </Card>

            <Card style={{ marginBottom: 14 }}>
              <AppText weight="bold" style={{ fontSize: 14, marginBottom: 8 }}>كوبون خصم</AppText>
              <TextInput value={couponCode} onChangeText={setCouponCode} placeholder="أدخل رمز الكوبون إن وجد" placeholderTextColor="#98a2b3" autoCapitalize="characters" style={inputStyle} />
              <AppText style={{ color: "#667085", fontSize: 11, marginTop: 6 }}>يُتحقق من صلاحية الكوبون على الخادم؛ لا يُطبّق الخصم محلياً.</AppText>
            </Card>

            <Card style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 6 }}><AppText style={{ color: "#667085" }}>إجمالي الأصناف</AppText><AppText weight="bold">{formatYER(cartTotal)}</AppText></View>
              <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 1, borderTopColor: "#eee9e1" }}><AppText weight="bold" style={{ fontSize: 15 }}>الإجمالي قبل الخصم والتوصيل</AppText><AppText weight="bold" style={{ color: "#d97706", fontSize: 16 }}>{formatYER(cartTotal)}</AppText></View>
            </Card>
            {queuedCount > 0 ? <AppText style={{ color: "#9a5300", textAlign: "center", marginBottom: 8 }}>هناك {queuedCount} طلبات محفوظة بانتظار الاتصال.</AppText> : null}
            {message ? <Card style={{ marginBottom: 12, backgroundColor: message.includes("تم") ? "#edf7f0" : "#fff5e8" }}><AppText weight="semibold" style={{ color: message.includes("تم") ? "#166534" : "#9a5300", fontSize: 13 }}>{message}</AppText></Card> : null}
            <PrimaryButton title={online ? "تأكيد وإرسال الطلب" : "حفظ الطلب للمزامنة لاحقاً"} loading={sending} disabled={!cart.length} icon={<Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />} onPress={() => void placeOrder()} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const inputStyle = { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: "#e7e3db", backgroundColor: "#fffdf8", paddingHorizontal: 12, color: "#0f172a", textAlign: "right" as const, fontFamily: "Cairo_400Regular" };
