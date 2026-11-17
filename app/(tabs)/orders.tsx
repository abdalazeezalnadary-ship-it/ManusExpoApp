import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { AppText, Card, PrimaryButton } from "@/components/ui";
import { ORDER_STATUSES } from "@/constants/restaurant";
import { formatYER, shortDate } from "@/lib/format";
import { listPendingOrders } from "@/lib/offline-queue";
import { trpc } from "@/lib/trpc";

export default function OrdersScreen() {
  const query = trpc.orders.mine.useQuery(undefined as never, { refetchInterval: 15_000, retry: false });
  const [pending, setPending] = useState<{ clientOrderId: string; createdAt: string; items: { menuItemCode: string; quantity: number }[] }[]>([]);
  useEffect(() => { void listPendingOrders().then(setPending); }, [query.dataUpdatedAt]);
  const orders = (query.data ?? []) as Record<string, any>[];

  return (
    <View style={{ flex: 1, backgroundColor: "#fffdf8" }}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 20, paddingBottom: 32 }}>
        <AppText weight="bold" style={{ fontSize: 24 }}>طلباتي</AppText>
        <AppText style={{ color: "#667085", fontSize: 12, marginTop: 3, marginBottom: 18 }}>تابع حالة الطلب خطوة بخطوة</AppText>
        {pending.length ? <View style={{ marginBottom: 18 }}>
          <AppText weight="bold" style={{ color: "#9a5300", marginBottom: 8 }}>طلبات محفوظة على الجهاز</AppText>
          {pending.map((item) => <Card key={item.clientOrderId} style={{ marginBottom: 8, backgroundColor: "#fff5e8" }}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}><Ionicons name="cloud-upload-outline" size={21} color="#d97706" /><View style={{ flex: 1 }}><AppText weight="semibold">بانتظار الاتصال بالخادم</AppText><AppText style={{ color: "#667085", fontSize: 11 }}>{item.items.length} أصناف · {shortDate(item.createdAt)}</AppText></View><View style={{ width: 8, height: 8, borderRadius: 5, backgroundColor: "#d97706" }} /></View>
          </Card>)}
        </View> : null}

        {query.isLoading ? <Card style={{ alignItems: "center", padding: 26 }}><AppText style={{ color: "#667085" }}>جارٍ تحميل الطلبات...</AppText></Card> : null}
        {query.isError ? <Card style={{ marginBottom: 12, backgroundColor: "#fff5e8" }}><AppText weight="semibold" style={{ color: "#9a5300" }}>تعذر تحميل الطلبات من الخادم حالياً.</AppText><Pressable onPress={() => void query.refetch()} style={{ alignSelf: "flex-start", marginTop: 8 }}><AppText weight="semibold" style={{ color: "#d97706" }}>إعادة المحاولة</AppText></Pressable></Card> : null}
        {!query.isLoading && !query.isError && !orders.length && !pending.length ? <Card style={{ alignItems: "center", paddingVertical: 28 }}>
          <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: "#fff3e2", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><Ionicons name="receipt-outline" size={25} color="#d97706" /></View>
          <AppText weight="bold" style={{ fontSize: 17 }}>لا توجد طلبات بعد</AppText>
          <AppText style={{ color: "#667085", textAlign: "center", marginTop: 5, marginBottom: 16 }}>ستظهر طلباتك وحالاتها هنا بعد الإرسال.</AppText>
          <PrimaryButton title="استكشف المنيو" onPress={() => router.push("/menu")} />
        </Card> : null}

        <View style={{ gap: 10 }}>
          {orders.map((order, index) => {
            const normalizedStatus = order.status === "confirmed" ? "pending" : order.status === "delivered" ? "completed" : order.status;
            const current = ORDER_STATUSES.findIndex((status) => status.key === normalizedStatus);
            const selectedStatus = ORDER_STATUSES[Math.max(current, 0)]!;
            return <Card key={String(order.id ?? index)} style={{ padding: 15 }}>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
                <View><AppText weight="bold" style={{ fontSize: 14 }}>طلب رقم {order.orderNumber ?? order.id}</AppText><AppText style={{ color: "#667085", fontSize: 11 }}>{order.createdAt ? shortDate(order.createdAt) : ""}</AppText></View>
                <View style={{ backgroundColor: `${order.status === "cancelled" ? "#b42318" : selectedStatus.color}18`, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}><AppText weight="semibold" style={{ color: order.status === "cancelled" ? "#b42318" : selectedStatus.color, fontSize: 11 }}>{order.status === "cancelled" ? "ملغى" : selectedStatus.label}</AppText></View>
              </View>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", marginTop: 17, marginBottom: 12 }}>
                {ORDER_STATUSES.map((status, step) => <View key={status.key} style={{ flex: 1, alignItems: "center" }}>
                  <View style={{ height: 5, alignSelf: "stretch", backgroundColor: step <= current ? "#d97706" : "#e7e3db", borderRadius: 4, marginBottom: 5 }} />
                  <AppText style={{ color: step <= current ? "#9a5300" : "#98a2b3", fontSize: 8, textAlign: "center" }}>{status.label}</AppText>
                </View>)}
              </View>
              <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 1, borderTopColor: "#eee9e1" }}><AppText style={{ color: "#667085", fontSize: 12 }}>الإجمالي</AppText><AppText weight="bold">{formatYER(Number(order.totalYER ?? order.total ?? 0))}</AppText></View>
              <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 10 }}>
                <Pressable onPress={() => router.push({ pathname: "/track/[id]", params: { id: String(order.id) } })} style={{ flex: 1, flexDirection: "row-reverse", justifyContent: "center", alignItems: "center", gap: 6, backgroundColor: "#0f172a", borderRadius: 11, paddingVertical: 10 }}><Ionicons name="navigate-outline" size={16} color="#ffffff" /><AppText weight="semibold" style={{ color: "#ffffff", fontSize: 12 }}>تتبع الطلب</AppText></Pressable>
                <Pressable onPress={() => router.push({ pathname: "/order-receipt/[id]", params: { id: String(order.id) } })} style={{ flex: 1, flexDirection: "row-reverse", justifyContent: "center", alignItems: "center", gap: 6, backgroundColor: "#fff3e2", borderRadius: 11, paddingVertical: 10 }}><Ionicons name="receipt-outline" size={16} color="#9a5300" /><AppText weight="semibold" style={{ color: "#9a5300", fontSize: 12 }}>الفاتورة</AppText></Pressable>
              </View>
            </Card>;
          })}
        </View>
      </ScrollView>
    </View>
  );
}
