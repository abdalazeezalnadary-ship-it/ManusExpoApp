import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import * as Print from "expo-print";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { RoleGuard } from "@/components/role-guard";
import { AppText, Card, Pill, PrimaryButton } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { trpc } from "@/lib/trpc";
import { shortDate } from "@/lib/format";

const STATIONS = [
  { key: "all", label: "كل المحطات" },
  { key: "grill", label: "مشويات" },
  { key: "hot", label: "طبخ رئيسي" },
  { key: "fry", label: "مقليات / بروست" },
  { key: "salad", label: "سلطات" },
  { key: "beverages", label: "عصائر ومشروبات" },
  { key: "desserts", label: "حلويات" },
] as const;

const STATION_NAMES: Record<string, string> = Object.fromEntries(STATIONS.filter((station) => station.key !== "all").map((station) => [station.key, station.label]));
type KdsRow = { orderItem: Record<string, any>; order: Record<string, any>; menuItem: Record<string, any>; chef?: { id: number | null; name: string | null } | null };
type Chef = { id: number; name: string | null; branchId: number | null };

function elapsed(createdAt: unknown, now: number) {
  if (!createdAt) return "وقت الإنشاء غير متاح";
  const date = new Date(createdAt as string | number | Date);
  if (!Number.isFinite(date.getTime())) return "وقت الإنشاء غير متاح";
  const minutes = Math.max(0, Math.floor((now - date.getTime()) / 60_000));
  const seconds = Math.max(0, Math.floor((now - date.getTime()) / 1_000) % 60);
  return `${minutes} د ${String(seconds).padStart(2, "0")} ث`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function KdsContent() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const player = useAudioPlayer(require("@/assets/sounds/new-order.wav"));
  const previousItemIds = useRef<Set<number> | null>(null);
  const [station, setStation] = useState<string>("all");
  const [now, setNow] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [actionError, setActionError] = useState("");
  const [printError, setPrintError] = useState("");
  const [updatedItem, setUpdatedItem] = useState<number | null>(null);
  const query = trpc.kds.list.useQuery(undefined as never, { refetchInterval: 5_000, retry: false });
  const update = trpc.kds.updateItemStatus.useMutation();
  const assign = trpc.kds.assignChef.useMutation();
  const chefsQuery = trpc.kds.availableChefs.useQuery(undefined as never, { enabled: can("kitchen.assign"), retry: false });
  const rows = ((query.data ?? []) as unknown as KdsRow[]).filter((row) => station === "all" || row.orderItem?.station === station);
  const chefs = (chefsQuery.data ?? []) as unknown as Chef[];
  const itemIdsKey = rows.map((row) => Number(row.orderItem?.id)).filter(Number.isFinite).sort((a, b) => a - b).join(",");

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!query.data) return;
    const currentIds = new Set(itemIdsKey ? itemIdsKey.split(",").map(Number) : []);
    const previous = previousItemIds.current;
    if (previous && soundEnabled && Array.from(currentIds).some((id) => !previous.has(id))) {
      void player.seekTo(0).then(() => player.play()).catch(() => undefined);
    }
    previousItemIds.current = currentIds;
  }, [itemIdsKey, query.data, soundEnabled, player]);

  const enableSound = async () => {
    if (soundEnabled) {
      setSoundEnabled(false);
      return;
    }
    try {
      await player.seekTo(0);
      player.play();
      setSoundEnabled(true);
    } catch {
      setActionError("تعذر تفعيل صوت التنبيه على هذا الجهاز.");
    }
  };

  const moveItem = async (row: KdsRow) => {
    setActionError("");
    setUpdatedItem(null);
    const status = row.orderItem?.kdsStatus;
    const nextStatus = status === "queued" || status === "pending" ? "cooking" : status === "preparing" || status === "cooking" ? "ready" : status === "ready" ? "served" : null;
    if (!nextStatus) return;
    try {
      await update.mutateAsync({ orderItemId: Number(row.orderItem.id), status: nextStatus });
      setUpdatedItem(Number(row.orderItem.id));
      await query.refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "تعذر تحديث حالة الصنف من الخادم.");
    }
  };

  const assignChef = async (orderItemId: number, chefId?: number) => {
    setActionError("");
    try {
      await assign.mutateAsync({ orderItemId, ...(chefId ? { chefId } : {}) });
      await query.refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "تعذر تعيين الشيف.");
    }
  };

  const printTicket = async (row: KdsRow) => {
    const item = row.orderItem ?? {};
    const order = row.order ?? {};
    const menuItem = row.menuItem ?? {};
    const stationLabel = STATION_NAMES[String(item.station)] ?? String(item.station ?? "غير محددة");
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;width:280px;margin:0 auto;padding:12px;color:#111}h1{font-size:19px;margin:0 0 6px}p{margin:5px 0;font-size:13px}.line{border-top:1px dashed #555;margin:10px 0}.qty{font-size:22px;font-weight:bold}</style></head><body><h1>دريم سيتي — تذكرة مطبخ</h1><p>طلب: ${escapeHtml(order.orderNumber ?? order.id ?? "—")}</p><p>المحطة: ${escapeHtml(stationLabel)}</p><p>الوقت: ${escapeHtml(order.createdAt ? shortDate(order.createdAt) : "غير متاح")}</p><div class="line"></div><p class="qty">${escapeHtml(menuItem.name ?? "صنف غير مسمى")} × ${escapeHtml(item.quantity ?? "—")}</p>${order.tableNumber ? `<p>الطاولة: ${escapeHtml(order.tableNumber)}</p>` : ""}<div class="line"></div><p>يُجهز عند الاستلام</p></body></html>`;
    setPrintError("");
    try {
      await Print.printAsync({ html });
    } catch (error) {
      setPrintError(error instanceof Error ? `تعذرت الطباعة: ${error.message}` : "تعذرت الطباعة على هذا الجهاز.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fffdf8" }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 20, paddingBottom: 32 }}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
          <View><AppText weight="bold" style={{ fontSize: 24 }}>شاشة المطبخ</AppText><AppText style={{ color: "#667085", fontSize: 12, marginTop: 2 }}>قائمة حية من أصناف الطلبات على الخادم</AppText></View>
          <View style={{ flexDirection: "row-reverse", gap: 7 }}>
            <Pressable onPress={() => void enableSound()} accessibilityLabel={soundEnabled ? "كتم التنبيه الصوتي" : "تفعيل التنبيه الصوتي"} style={{ padding: 10, borderRadius: 12, backgroundColor: soundEnabled ? "#edf7f0" : "#fff5e8" }}><Ionicons name={soundEnabled ? "volume-high" : "volume-mute"} size={20} color={soundEnabled ? "#15803d" : "#d97706"} /></Pressable>
            <Pressable onPress={() => void query.refetch()} accessibilityLabel="تحديث الطلبات" style={{ padding: 10 }}><Ionicons name="refresh" size={21} color="#d97706" /></Pressable>
          </View>
        </View>
        <Card style={{ marginTop: 14, marginBottom: 14, paddingVertical: 11, backgroundColor: "#fff5e8" }}>
          <AppText weight="semibold" style={{ color: "#9a5300", fontSize: 12 }}>تحديث تلقائي كل 5 ثوانٍ · مؤقت لكل طلب · تفعيل الصوت من رمز السماعة</AppText>
        </Card>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse", paddingVertical: 3, marginBottom: 12 }}>
          {STATIONS.map((item) => <Pill key={item.key} title={item.label} selected={station === item.key} onPress={() => setStation(item.key)} />)}
        </ScrollView>
        {query.isLoading ? <Card><AppText style={{ color: "#667085" }}>جارٍ تحميل أصناف المطبخ...</AppText></Card> : null}
        {query.isError ? <Card style={{ backgroundColor: "#fff5f5", marginBottom: 10 }}><AppText weight="semibold" style={{ color: "#b42318" }}>تعذر جلب قائمة المطبخ من الخادم. لم تُعرض بيانات تجريبية.</AppText><PrimaryButton title="إعادة المحاولة" onPress={() => void query.refetch()} style={{ marginTop: 10 }} /></Card> : null}
        {actionError ? <Card style={{ backgroundColor: "#fff5f5", marginBottom: 10 }}><AppText style={{ color: "#b42318" }}>{actionError}</AppText></Card> : null}
        {printError ? <Card style={{ backgroundColor: "#fff5f5", marginBottom: 10 }}><AppText style={{ color: "#b42318" }}>{printError}</AppText></Card> : null}
        {updatedItem !== null ? <AppText style={{ color: "#15803d", marginBottom: 9 }}>تم تحديث الصنف {updatedItem} على الخادم.</AppText> : null}
        {!query.isLoading && !query.isError && rows.length === 0 ? <Card style={{ alignItems: "center", padding: 24 }}><AppText weight="semibold">لا توجد أصناف نشطة لهذه المحطة حالياً.</AppText><AppText style={{ color: "#667085", fontSize: 12, marginTop: 5 }}>تُعرض فقط النتائج التي أعادها الخادم.</AppText></Card> : null}
        {rows.map((row, index) => {
          const item = row.orderItem ?? {};
          const order = row.order ?? {};
          const menuItem = row.menuItem ?? {};
          const status = item.kdsStatus ?? "pending";
          const stateLabel = status === "preparing" || status === "cooking" ? "قيد التحضير" : status === "ready" ? "جاهز" : status === "served" ? "تم التقديم" : "بانتظار التحضير";
          const nextLabel = status === "queued" || status === "pending" ? "بدء التحضير" : status === "preparing" || status === "cooking" ? "تحديد كجاهز" : status === "ready" ? "تأكيد التقديم" : "مكتمل";
          const disabled = status === "served" || update.isPending;
          const itemChefList = chefs.filter((chef) => Number(chef.branchId) === Number(order.branchId));
          return (
            <Card key={String(item.id ?? `${order.id}-${index}`)} style={{ marginBottom: 10, borderRightWidth: 4, borderRightColor: status === "ready" ? "#15803d" : status === "preparing" || status === "cooking" ? "#2563eb" : "#d97706" }}>
              <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <AppText weight="bold" style={{ fontSize: 17 }}>{menuItem.name ?? "صنف غير مسمى في بيانات الخادم"}</AppText>
                  <AppText style={{ color: "#667085", fontSize: 12, marginTop: 3 }}>طلب {order.orderNumber ?? order.id ?? "—"} · كمية {item.quantity ?? "—"}</AppText>
                </View>
                <View style={{ backgroundColor: status === "ready" ? "#edf7f0" : "#fff5e8", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 }}><AppText weight="semibold" style={{ fontSize: 11, color: status === "ready" ? "#15803d" : "#9a5300" }}>{stateLabel}</AppText></View>
              </View>
              <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 13, borderTopWidth: 1, borderTopColor: "#eee9e1", paddingTop: 10 }}>
                <AppText style={{ color: "#667085", fontSize: 12 }}>{STATION_NAMES[item.station] ?? item.station ?? "محطة غير محددة"}</AppText>
                <AppText weight="semibold" style={{ color: "#d97706", fontSize: 12 }}>الوقت: {elapsed(order.createdAt, now)}</AppText>
              </View>
              <AppText style={{ color: "#98a2b3", fontSize: 10, marginTop: 3 }}>{order.createdAt ? shortDate(order.createdAt) : "وقت الإنشاء غير متاح"}</AppText>
              <View style={{ marginTop: 9, gap: 6 }}>
                <AppText weight="semibold" style={{ color: "#475467", fontSize: 12 }}>الشيف: {row.chef?.name ?? "غير معيّن"}</AppText>
                {can("kitchen.assign") && !item.assignedChefId ? <Pressable onPress={() => void assignChef(Number(item.id))} disabled={assign.isPending} style={{ alignItems: "center", padding: 9, backgroundColor: "#f3f4f6", borderRadius: 10 }}><AppText weight="semibold">تعيين الطلب إليّ</AppText></Pressable> : null}
                {can("kitchen.assign") && itemChefList.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse" }}>{itemChefList.map((chef) => <Pill key={chef.id} title={chef.name ?? `شيف ${chef.id}`} selected={Number(item.assignedChefId) === chef.id} onPress={() => void assignChef(Number(item.id), chef.id)} />)}</ScrollView> : null}
                {can("kitchen.assign") && chefsQuery.isError ? <AppText style={{ color: "#b42318", fontSize: 11 }}>تعذر تحميل الشيفات المتاحين من الخادم.</AppText> : null}
              </View>
              <PrimaryButton title={nextLabel} disabled={disabled} loading={update.isPending} onPress={() => void moveItem(row)} style={{ marginTop: 12 }} />
              <Pressable onPress={() => void printTicket(row)} style={{ alignItems: "center", justifyContent: "center", minHeight: 42, marginTop: 7, borderRadius: 11, borderWidth: 1, borderColor: "#d0d5dd" }}><AppText weight="semibold" style={{ fontSize: 12 }}>طباعة تذكرة المطبخ</AppText></Pressable>
            </Card>
          );
        })}
        <Card style={{ marginTop: 4, backgroundColor: "#f8f9fb" }}>
          <AppText weight="semibold">تحديثات تشغيلية</AppText>
          <AppText style={{ color: "#667085", fontSize: 12, lineHeight: 19, marginTop: 4 }}>تُسجل حالات الأصناف وتعيين الشيف على الخادم مع تحقق الفرع والصلاحية. الطباعة تعتمد نافذة الطباعة التي يدعمها نظام الجهاز أو المتصفح.</AppText>
        </Card>
      </ScrollView>
    </View>
  );
}

export default function KdsScreen() {
  return <RoleGuard permission="kitchen.read" title="شاشة المطبخ"><KdsContent /></RoleGuard>;
}
