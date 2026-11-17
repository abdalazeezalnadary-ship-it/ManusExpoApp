import { useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { RoleGuard } from "@/components/role-guard";
import { AppText, Card, PrimaryButton, SectionHeading } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { formatYER, shortDate } from "@/lib/format";

const EXPENSE_ROLES = ["admin", "manager", "cashier", "chef", "waiter", "driver", "inventory", "accountant"] as const;
const CREATE_ROLES = ["admin", "manager", "cashier", "chef", "waiter", "driver", "inventory"] as const;
const inputStyle = {
  minHeight: 46,
  borderWidth: 1,
  borderColor: "#e7e3db",
  borderRadius: 12,
  paddingHorizontal: 12,
  backgroundColor: "#ffffff",
  color: "#0f172a",
  textAlign: "right" as const,
  fontFamily: "Cairo_400Regular",
};

type Expense = {
  id?: number;
  amount: number | string;
  reason: string;
  shiftId?: number | null;
  userId?: number | null;
  createdAt?: string | Date | null;
};
type OpenShift = { id?: number; branchId?: number; status?: string };

function normalizeDigits(value: string) {
  return value.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function ExpensesContent() {
  const { user } = useAuth();
  const numericBranchId = Number(user?.branchId);
  const branchId = Number.isSafeInteger(numericBranchId) && numericBranchId > 0 ? numericBranchId : null;
  const canCreateByRole = CREATE_ROLES.includes(user?.role as (typeof CREATE_ROLES)[number]);
  const [amountText, setAmountText] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const expensesQuery = trpc.expenses.list.useQuery(branchId ? { branchId } : undefined, {
    enabled: Boolean(branchId),
    retry: false,
    refetchInterval: 30_000,
  });
  const shiftQuery = trpc.shifts.current.useQuery(undefined, {
    enabled: Boolean(branchId),
    retry: false,
    refetchInterval: 15_000,
  });
  const createExpense = trpc.expenses.create.useMutation();
  const shift = shiftQuery.data as OpenShift | null | undefined;
  const openShiftId = shift?.status === "open"
    && Number(shift.branchId) === branchId
    && Number.isSafeInteger(Number(shift.id))
    && Number(shift.id) > 0
    ? Number(shift.id)
    : null;
  const expenses = (expensesQuery.data ?? []) as unknown as Expense[];

  const submit = async () => {
    setError("");
    setMessage("");
    if (!branchId) {
      setError("لا يمكن تسجيل مصروف قبل ربط الحساب بفرع حقيقي.");
      return;
    }
    if (!canCreateByRole) {
      setError("صلاحية الحساب الحالية تتيح مراجعة المصروفات فقط، ولا تسمح API بتسجيلها لهذا الدور.");
      return;
    }
    if (shiftQuery.isLoading || shiftQuery.isError) {
      setError("تعذر التحقق من الوردية المفتوحة؛ لم يُسجّل أي مصروف.");
      return;
    }
    if (!openShiftId) {
      setError("لا يمكن تسجيل المصروف دون وردية مفتوحة تخص حسابك في هذا الفرع.");
      return;
    }
    const amount = Number(normalizeDigits(amountText.trim()));
    const cleanReason = reason.trim();
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setError("أدخل مبلغاً صحيحاً موجباً بالأعداد الصحيحة.");
      return;
    }
    if (!cleanReason || cleanReason.length > 2000) {
      setError("اكتب سبب المصروف (حتى ٢٠٠٠ حرف).");
      return;
    }
    try {
      await createExpense.mutateAsync({ amount, reason: cleanReason, shiftId: openShiftId });
      setAmountText("");
      setReason("");
      setMessage("تم تسجيل المصروف على الوردية المفتوحة.");
      await expensesQuery.refetch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تسجيل المصروف.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fffdf8" }}>
      <ScrollView contentContainerStyle={{ padding: 17, paddingTop: 20, paddingBottom: 34 }}>
        <AppText weight="bold" style={{ fontSize: 24 }}>مصروفات الفرع</AppText>
        <AppText style={{ color: "#667085", fontSize: 12, marginTop: 3, marginBottom: 14 }}>
          المصروفات والوردية مرتبطة ببيانات الخادم وحسابك الحالي.
        </AppText>

        {!branchId ? (
          <Card style={{ backgroundColor: "#fff5e8", marginBottom: 12 }}>
            <AppText weight="semibold" style={{ color: "#9a5300", lineHeight: 22 }}>
              هذا الحساب غير مرتبط بفرع. لا يمكن تحميل مصروفات فرع أو تسجيل مصروف، بما في ذلك حساب admin غير المرتبط بفرع.
            </AppText>
          </Card>
        ) : null}

        {branchId ? (
          <Card style={{ marginBottom: 14 }}>
            <SectionHeading title="تسجيل مصروف" caption="يتطلب فرع الحساب ووردية مفتوحة تخص المستخدم نفسه" />
            {shiftQuery.isLoading ? <AppText style={{ color: "#667085", marginBottom: 9 }}>جارٍ التحقق من الوردية المفتوحة...</AppText> : null}
            {shiftQuery.isError ? <AppText style={{ color: "#b42318", marginBottom: 9 }}>تعذر التحقق من الوردية؛ التسجيل متوقف حتى نجاح التحقق.</AppText> : null}
            {!shiftQuery.isLoading && !shiftQuery.isError && openShiftId ? (
              <AppText weight="semibold" style={{ color: "#166534", fontSize: 12, marginBottom: 9 }}>وردية مفتوحة · رقم {openShiftId}</AppText>
            ) : null}
            {!shiftQuery.isLoading && !shiftQuery.isError && !openShiftId ? (
              <AppText style={{ color: "#9a5300", fontSize: 12, lineHeight: 20, marginBottom: 9 }}>لا توجد وردية مفتوحة لهذا الحساب والفرع؛ لن يُرسل طلب إنشاء مصروف.</AppText>
            ) : null}
            {!canCreateByRole ? (
              <AppText style={{ color: "#9a5300", fontSize: 12, lineHeight: 20, marginBottom: 9 }}>
                دور المحاسب يستطيع مراجعة المصروفات، لكن صلاحيات API الحالية لا تسمح له بإنشاء مصروف.
              </AppText>
            ) : null}
            <AppText style={{ fontSize: 12, marginBottom: 5 }}>المبلغ (ر.ي)</AppText>
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="number-pad"
              placeholder="أدخل مبلغاً صحيحاً موجباً"
              placeholderTextColor="#98a2b3"
              style={inputStyle}
              editable={canCreateByRole && Boolean(openShiftId) && !shiftQuery.isLoading && !shiftQuery.isError}
            />
            <AppText style={{ fontSize: 12, marginTop: 10, marginBottom: 5 }}>سبب المصروف</AppText>
            <TextInput
              value={reason}
              onChangeText={setReason}
              maxLength={2000}
              multiline
              placeholder="اكتب السبب كما حدث فعلياً"
              placeholderTextColor="#98a2b3"
              style={[inputStyle, { minHeight: 88, textAlignVertical: "top", paddingTop: 11 }]}
              editable={canCreateByRole && Boolean(openShiftId) && !shiftQuery.isLoading && !shiftQuery.isError}
            />
            <PrimaryButton
              title="تسجيل المصروف"
              loading={createExpense.isPending}
              disabled={!canCreateByRole || !branchId || !openShiftId || shiftQuery.isLoading || shiftQuery.isError}
              onPress={() => void submit()}
              style={{ marginTop: 11 }}
            />
          </Card>
        ) : null}

        {error ? <Card style={{ backgroundColor: "#fff5f5", marginBottom: 10 }}><AppText style={{ color: "#b42318", lineHeight: 20 }}>{error}</AppText></Card> : null}
        {message ? <AppText style={{ color: "#15803d", marginBottom: 10 }}>{message}</AppText> : null}

        <SectionHeading title="سجل المصروفات" caption="أحدث السجلات التي أعادها الخادم لهذا الفرع" />
        {!branchId ? null : expensesQuery.isLoading ? (
          <Card><AppText style={{ color: "#667085" }}>جارٍ تحميل المصروفات...</AppText></Card>
        ) : expensesQuery.isError ? (
          <Card style={{ backgroundColor: "#fff5f5" }}>
            <AppText style={{ color: "#b42318", lineHeight: 20 }}>تعذر تحميل مصروفات الفرع.</AppText>
            <PrimaryButton title="إعادة المحاولة" onPress={() => void expensesQuery.refetch()} style={{ marginTop: 9 }} />
          </Card>
        ) : expenses.length === 0 ? (
          <Card><AppText style={{ color: "#667085", lineHeight: 20 }}>لا توجد مصروفات في نتيجة الخادم لهذا الفرع.</AppText></Card>
        ) : expenses.map((expense, index) => (
          <Card key={String(expense.id ?? `expense-${index}`)} style={{ marginBottom: 9, paddingVertical: 13 }}>
            <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <AppText weight="semibold" style={{ lineHeight: 21 }}>{expense.reason}</AppText>
                <AppText style={{ color: "#667085", fontSize: 11, marginTop: 5 }}>
                  {expense.createdAt ? shortDate(expense.createdAt) : "التاريخ غير متاح"}
                  {expense.shiftId ? ` · الوردية ${expense.shiftId}` : " · دون رقم وردية وارد"}
                </AppText>
              </View>
              <AppText weight="bold" style={{ color: "#9a5300", fontSize: 13 }}>{formatYER(Number(expense.amount))}</AppText>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

export default function ExpensesScreen() {
  return <RoleGuard roles={EXPENSE_ROLES} title="مصروفات الفرع"><ExpensesContent /></RoleGuard>;
}
