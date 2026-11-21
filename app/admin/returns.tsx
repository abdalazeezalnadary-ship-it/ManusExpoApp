import { useState } from "react";
import { ScrollView, View } from "react-native";
import { RoleGuard } from "@/components/role-guard";
import { AppText, Card, Pill, PrimaryButton, SectionHeading } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

type Branch = { id: number; branchCode: string; name: string };
type ReturnRow = {
  returnOrder: { id: number; orderId: number; amount: number; reason: string; status: string; createdAt?: Date | string };
  order: { id: number; total: number; branchId: number; currency?: string | null; status?: string };
};
const statusLabels: Record<string, string> = {
  requested: "مطلوب",
  pending: "قيد المراجعة",
  approved: "موافق عليه",
  rejected: "مرفوض",
  processed: "تمت المعالجة",
};

type ReturnStatus = "approved" | "rejected" | "processed";
function allowedActions(status: string): { status: ReturnStatus; title: string }[] {
  if (status === "requested" || status === "pending") return [{ status: "approved", title: "اعتماد" }, { status: "rejected", title: "رفض" }];
  if (status === "approved") return [{ status: "processed", title: "تأكيد المعالجة" }];
  return [];
}

function ReturnsContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const branchesQuery = trpc.branches.list.useQuery(undefined, { retry: false });
  const branches = (branchesQuery.data ?? []) as unknown as Branch[];
  const managerBranchId = Number(user?.branchId) > 0 ? Number(user?.branchId) : null;
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const targetBranchId = isAdmin ? selectedBranchId : managerBranchId;
  const returnsQuery = trpc.returns.list.useQuery(
    { branchId: targetBranchId ?? undefined },
    { retry: false, enabled: !!targetBranchId },
  );
  const updateReturn = trpc.returns.update.useMutation();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const returnRows = (returnsQuery.data ?? []) as unknown as ReturnRow[];
  const branchName = (branchId: number) => branches.find((branch) => branch.id === Number(branchId))?.name ?? `فرع رقم ${branchId}`;

  const changeStatus = async (returnId: number, status: ReturnStatus) => {
    setError(""); setMessage("");
    try {
      await updateReturn.mutateAsync({ returnId, status });
      setMessage("تم تحديث حالة المرتجع.");
      await returnsQuery.refetch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحديث حالة المرتجع.");
    }
  };

  return <View style={{ flex: 1, backgroundColor: "#fffdf8" }}><ScrollView contentContainerStyle={{ padding: 17, paddingTop: 20, paddingBottom: 34 }}>
    <AppText weight="bold" style={{ fontSize: 24 }}>إدارة المرتجعات</AppText>
    <AppText style={{ color: "#667085", fontSize: 12, marginTop: 3, marginBottom: 14 }}>مراجعة طلبات الإرجاع وتحديثها ضمن انتقالات الحالة المسموحة.</AppText>

    {isAdmin ? <Card style={{ marginBottom: 13 }}>
      <AppText weight="semibold">فرع قائمة المرتجعات</AppText>
      {branchesQuery.isLoading ? <AppText style={{ color: "#667085", marginTop: 8 }}>جارٍ تحميل الفروع...</AppText> : null}
      {branchesQuery.isError ? <AppText style={{ color: "#b42318", marginTop: 8 }}>تعذر تحميل الفروع؛ لا يمكن استعلام المرتجعات قبل تحديد فرع.</AppText> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse", marginTop: 8 }}>
        {branches.map((branch) => <Pill key={branch.id} title={branch.name} selected={selectedBranchId === branch.id} onPress={() => { setSelectedBranchId(branch.id); setError(""); setMessage(""); }} />)}
      </ScrollView>
      {!branchesQuery.isLoading && !branchesQuery.isError && branches.length === 0 ? <AppText style={{ color: "#667085", marginTop: 8 }}>لا توجد فروع أعادها الخادم.</AppText> : null}
    </Card> : <Card style={{ marginBottom: 13 }}><AppText weight="semibold">فرع المدير</AppText><AppText style={{ color: "#667085", marginTop: 4 }}>{managerBranchId ? branchName(managerBranchId) : "لا يوجد فرع مرتبط بالحساب."}</AppText></Card>}

    {error ? <Card style={{ backgroundColor: "#fff5f5", marginBottom: 10 }}><AppText style={{ color: "#b42318" }}>{error}</AppText></Card> : null}
    {message ? <AppText style={{ color: "#15803d", marginBottom: 10 }}>{message}</AppText> : null}

    <SectionHeading title="طلبات الإرجاع" caption={targetBranchId ? `السجلات الفعلية · ${branchName(targetBranchId)}` : "حدد فرعاً لعرض سجلاته"} />
    {!targetBranchId && !branchesQuery.isLoading && !branchesQuery.isError ? <Card><AppText style={{ color: "#667085" }}>اختر فرعاً لعرض المرتجعات؛ لم يُرسل استعلام بلا فرع.</AppText></Card> : null}
    {returnsQuery.isLoading ? <Card><AppText style={{ color: "#667085" }}>جارٍ تحميل المرتجعات...</AppText></Card> : null}
    {returnsQuery.isError ? <Card style={{ backgroundColor: "#fff5f5" }}><AppText style={{ color: "#b42318" }}>تعذر تحميل قائمة المرتجعات من الخادم.</AppText><PrimaryButton title="إعادة المحاولة" onPress={() => void returnsQuery.refetch()} style={{ marginTop: 9 }} /></Card> : null}
    {!!targetBranchId && !returnsQuery.isLoading && !returnsQuery.isError && returnRows.length === 0 ? <Card><AppText style={{ color: "#667085" }}>لا توجد مرتجعات أرجعها الخادم لهذا الفرع.</AppText></Card> : null}

    {returnRows.map(({ returnOrder, order }) => {
      const actions = allowedActions(returnOrder.status);
      return <Card key={returnOrder.id} style={{ marginBottom: 9, paddingVertical: 13 }}>
        <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <AppText weight="bold">مرتجع #{returnOrder.id} · الطلب #{order.id}</AppText>
            <AppText style={{ color: "#475467", fontSize: 12 }}>إجمالي الطلب: {order.total}{order.currency ? ` ${order.currency}` : ""} · مبلغ الإرجاع: {returnOrder.amount}{order.currency ? ` ${order.currency}` : ""}</AppText>
            <AppText style={{ color: "#667085", fontSize: 12 }}>الفرع: {branchName(order.branchId)}</AppText>
            <AppText style={{ color: "#344054", fontSize: 12, marginTop: 2 }}>السبب: {returnOrder.reason}</AppText>
          </View>
          <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: returnOrder.status === "rejected" ? "#fff1f0" : returnOrder.status === "processed" ? "#edf7f0" : "#fff5e8" }}>
            <AppText weight="semibold" style={{ color: returnOrder.status === "rejected" ? "#b42318" : returnOrder.status === "processed" ? "#166534" : "#9a5300", fontSize: 11 }}>{statusLabels[returnOrder.status] ?? returnOrder.status}</AppText>
          </View>
        </View>
        {actions.length > 0 ? <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 12 }}>
          {actions.map((action) => <View key={action.status} style={{ flex: 1 }}>
            <PrimaryButton title={action.title} loading={updateReturn.isPending} disabled={updateReturn.isPending} onPress={() => void changeStatus(returnOrder.id, action.status)} style={action.status === "rejected" ? { backgroundColor: "#b42318" } : undefined} />
          </View>)}
        </View> : null}
      </Card>;
    })}
  </ScrollView></View>;
}

export default function ReturnsScreen() {
  return <RoleGuard permission="returns.read" title="إدارة المرتجعات"><ReturnsContent /></RoleGuard>;
}
