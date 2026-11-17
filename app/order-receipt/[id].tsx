import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import * as Print from "expo-print";
import { AppText, Card, PrimaryButton } from "@/components/ui";
import { CUSTOMER_SERVICE_PHONES, DELIVERY_PHONES, ORDER_STATUSES } from "@/constants/restaurant";
import { formatYER, shortDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";

type ReceiptItem = { id: number; itemName: string | null; currentName: string; quantity: number; unitPrice: number; lineTotal: number };
type Receipt = { order: Record<string, any>; branch: Record<string, any> | null; items: ReceiptItem[] };
function escapeHtml(value: unknown) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char] ?? char); }
function orderTypeLabel(value: string) { return value === "delivery" ? "توصيل" : value === "pickup" ? "سفري" : value === "dine_in" ? "صالة" : value; }
function ReceiptContent({ data }: { data: Receipt }) {
  const [error, setError] = useState("");
  const [printing, setPrinting] = useState(false);
  const order = data.order;
  const details = order.deliveryDetails && typeof order.deliveryDetails === "object" ? order.deliveryDetails as Record<string, unknown> : null;
  const items = data.items ?? [];
  const print = async () => {
    setError(""); setPrinting(true);
    try {
      const rows = items.map((item) => `<tr><td>${escapeHtml(item.itemName || item.currentName)}</td><td>${item.quantity}</td><td>${escapeHtml(formatYER(Number(item.unitPrice)))}</td><td>${escapeHtml(formatYER(Number(item.lineTotal)))}</td></tr>`).join("");
      const type = orderTypeLabel(String(order.orderType ?? ""));
      const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#0f172a;padding:22px}h1{font-size:21px;margin-bottom:4px}.muted{color:#667085;font-size:11px;line-height:1.8}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border-bottom:1px solid #e4e7ec;padding:9px 5px;text-align:right;font-size:12px}th{background:#f8f9fb}.totals{margin-top:16px}.totals div{display:flex;justify-content:space-between;padding:5px 0}.grand{font-size:17px;font-weight:bold;border-top:2px solid #d97706;padding-top:10px!important}footer{margin-top:23px;border-top:1px solid #e4e7ec;padding-top:10px}</style></head><body><h1>مطاعم دريم سيتي</h1><p class="muted">${escapeHtml(data.branch?.name ?? "Dream City")}<br>${escapeHtml(data.branch?.address ?? "")}<br>نوع الطلب: ${escapeHtml(type)} · رقم الطلب: ${escapeHtml(order.id)}<br>التاريخ: ${escapeHtml(order.createdAt ? shortDate(order.createdAt) : "غير متاح")}</p>${details ? `<p class="muted">المستلم: ${escapeHtml(details.customerName)}<br>الهاتف: ${escapeHtml(details.phone)}<br>العنوان: ${escapeHtml(details.address)}</p>` : ""}<table><thead><tr><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div><span>إجمالي الأصناف</span><b>${escapeHtml(formatYER(Number(order.subtotal)))}</b></div><div><span>الخصم</span><b>${escapeHtml(formatYER(Number(order.discountAmount ?? 0)))}</b></div><div><span>رسوم التوصيل</span><b>${escapeHtml(formatYER(Number(order.deliveryFee ?? 0)))}</b></div><div class="grand"><span>الإجمالي</span><b>${escapeHtml(formatYER(Number(order.total)))}</b></div></div><footer class="muted">التوصيل: ${escapeHtml(DELIVERY_PHONES.join("، "))}<br>خدمة العملاء: ${escapeHtml(CUSTOMER_SERVICE_PHONES.join("، "))}<br>حالة الدفع: ${escapeHtml(order.paymentStatus ?? "غير مسجل")}</footer></body></html>`;
      await Print.printAsync({ html });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذرت طباعة الفاتورة."); }
    finally { setPrinting(false); }
  };
  const status = ORDER_STATUSES.find((item) => item.key === order.status || (order.status === "confirmed" && item.key === "pending"));

  return <View style={{ flex: 1, backgroundColor: "#fffdf8" }}><ScrollView contentContainerStyle={{ padding: 17, paddingTop: 20, paddingBottom: 34 }}>
    <Pressable onPress={() => router.back()} style={{ alignSelf: "flex-start", paddingVertical: 8, marginBottom: 7 }}><AppText weight="semibold" style={{ color: "#9a5300" }}>رجوع</AppText></Pressable>
    <AppText weight="bold" style={{ fontSize: 24 }}>فاتورة الطلب</AppText>
    <AppText style={{ color: "#667085", fontSize: 12, marginTop: 3, marginBottom: 14 }}>بيانات الأصناف والأسعار محفوظة وقت تسجيل الطلب.</AppText>
    <Card style={{ marginBottom: 12 }}>
      <AppText weight="bold" style={{ fontSize: 16 }}>مطاعم دريم سيتي</AppText>
      <AppText style={{ color: "#475467", fontSize: 12, lineHeight: 20, marginTop: 4 }}>{data.branch?.name ?? "فرع غير محدد"}{data.branch?.address ? `\n${data.branch.address}` : ""}</AppText>
      <View style={{ height: 1, backgroundColor: "#eee9e1", marginVertical: 10 }} />
      <View style={{ flexDirection: "row-reverse", justifyContent: "space-between" }}><AppText style={{ color: "#667085" }}>رقم الطلب</AppText><AppText weight="bold">{order.id}</AppText></View>
      <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 6 }}><AppText style={{ color: "#667085" }}>نوع الطلب</AppText><AppText weight="semibold">{orderTypeLabel(String(order.orderType ?? ""))}</AppText></View>
      <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 6 }}><AppText style={{ color: "#667085" }}>الحالة</AppText><AppText weight="semibold" style={{ color: status?.color ?? "#b42318" }}>{status?.label ?? (order.status === "cancelled" ? "ملغى" : String(order.status))}</AppText></View>
      {order.createdAt ? <AppText style={{ color: "#667085", fontSize: 11, marginTop: 6 }}>التاريخ: {shortDate(order.createdAt)}</AppText> : null}
      {details ? <AppText style={{ color: "#475467", fontSize: 12, lineHeight: 20, marginTop: 8 }}>المستلم: {String(details.customerName ?? "—")} · {String(details.phone ?? "—")}\n{String(details.address ?? "")}</AppText> : null}
    </Card>
    <Card style={{ marginBottom: 12 }}>
      <AppText weight="bold" style={{ marginBottom: 9 }}>الأصناف</AppText>
      {items.length ? items.map((item) => <View key={item.id} style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#f2f4f7", paddingVertical: 8 }}><View style={{ flex: 1 }}><AppText weight="semibold">{item.itemName || item.currentName}</AppText><AppText style={{ color: "#667085", fontSize: 11 }}>{item.quantity} × {formatYER(Number(item.unitPrice))}</AppText></View><AppText weight="bold">{formatYER(Number(item.lineTotal))}</AppText></View>) : <AppText style={{ color: "#667085" }}>لا توجد تفاصيل أصناف في نتيجة الخادم.</AppText>}
      <View style={{ gap: 8, marginTop: 12 }}>
        <View style={{ flexDirection: "row-reverse", justifyContent: "space-between" }}><AppText style={{ color: "#667085" }}>إجمالي الأصناف</AppText><AppText>{formatYER(Number(order.subtotal))}</AppText></View>
        <View style={{ flexDirection: "row-reverse", justifyContent: "space-between" }}><AppText style={{ color: "#667085" }}>الخصم</AppText><AppText>{formatYER(Number(order.discountAmount ?? 0))}</AppText></View>
        <View style={{ flexDirection: "row-reverse", justifyContent: "space-between" }}><AppText style={{ color: "#667085" }}>رسوم التوصيل</AppText><AppText>{formatYER(Number(order.deliveryFee ?? 0))}</AppText></View>
        <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#eee9e1", paddingTop: 10 }}><AppText weight="bold" style={{ fontSize: 15 }}>الإجمالي</AppText><AppText weight="bold" style={{ color: "#d97706", fontSize: 16 }}>{formatYER(Number(order.total))}</AppText></View>
      </View>
    </Card>
    <Card style={{ marginBottom: 12 }}><AppText weight="semibold">التوصيل: {DELIVERY_PHONES.join(" · ")}</AppText><AppText weight="semibold" style={{ marginTop: 5 }}>خدمة العملاء: {CUSTOMER_SERVICE_PHONES.join(" · ")}</AppText><AppText style={{ color: "#667085", fontSize: 11, marginTop: 7 }}>حالة الدفع: {String(order.paymentStatus ?? "غير مسجل")}</AppText></Card>
    {error ? <Card style={{ backgroundColor: "#fff5f5", marginBottom: 10 }}><AppText style={{ color: "#b42318" }}>{error}</AppText></Card> : null}
    <PrimaryButton title="طباعة / حفظ الفاتورة PDF" loading={printing} onPress={() => void print()} />
  </ScrollView></View>;
}

export default function OrderReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const query = trpc.orders.receipt.useQuery({ orderId }, { enabled: Number.isSafeInteger(orderId) && orderId > 0, retry: false });
  const data = query.data as unknown as Receipt | undefined;
  return <View style={{ flex: 1, backgroundColor: "#fffdf8" }}>
    {query.isLoading ? <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}><AppText>جارٍ تحميل الفاتورة من الخادم...</AppText></View> : null}
    {query.isError ? <View style={{ flex: 1, justifyContent: "center", padding: 20 }}><Card><AppText weight="bold" style={{ color: "#b42318" }}>تعذر تحميل الفاتورة</AppText><AppText style={{ color: "#667085", marginTop: 6 }}>قد لا تملك صلاحية لهذا الطلب أو لم يعد متاحاً.</AppText><PrimaryButton title="إعادة المحاولة" onPress={() => void query.refetch()} style={{ marginTop: 12 }} /></Card></View> : null}
    {!query.isLoading && !query.isError && data ? <ReceiptContent data={data} /> : null}
  </View>;
}
