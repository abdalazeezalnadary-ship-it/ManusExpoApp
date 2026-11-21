import { useState } from "react";
import { Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { RoleGuard } from "@/components/role-guard";
import { AppText, Card, Pill, PrimaryButton, SectionHeading } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { CUSTOMER_SERVICE_PHONES, DELIVERY_PHONES } from "@/constants/restaurant";
import { trpc } from "@/lib/trpc";
import { formatYER, shortDate } from "@/lib/format";

type Branch = { id: number; branchCode: string; name: string; address?: string };
type Report = Record<string, any>;
const inputStyle = { minHeight: 46, borderWidth: 1, borderColor: "#e7e3db", borderRadius: 12, paddingHorizontal: 12, backgroundColor: "#ffffff", color: "#0f172a", textAlign: "right" as const, fontFamily: "Cairo_400Regular" };
const REPORT_FIELDS = ["salesTotal", "cashSales", "electronicSales", "unclassifiedSales", "completedOrders", "expenses", "expectedNetCash", "driverSettlements"] as const;

function labelFor(key: string) {
  const labels: Record<string, string> = { salesTotal: "إجمالي المبيعات", cashSales: "المبيعات النقدية", electronicSales: "المدفوعات الإلكترونية المصنفة", unclassifiedSales: "مبيعات غير مصنفة", completedOrders: "الطلبات المكتملة", expenses: "المصروفات", expectedNetCash: "صافي النقد المتوقع بالدرج", driverSettlements: "تحصيل عهدة الموصلين" };
  return labels[key] ?? key;
}
function reportValue(report: Report, key: string) {
  const value = report[key];
  if (value === undefined || value === null) return "غير وارد في التقرير";
  return key === "completedOrders" ? String(value) : formatYER(Number(value));
}
function csvCell(value: unknown) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }
function browserDownload(filename: string, contents: string, mimeType: string) {
  if (typeof document === "undefined") return false;
  const blob = new Blob([contents], { type: mimeType }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); return true;
}
async function shareTextFile(filename: string, contents: string, mimeType: string) {
  if (Platform.OS === "web" && browserDownload(filename, contents, `${mimeType};charset=utf-8`)) return;
  const base = FileSystem.cacheDirectory; if (!base) throw new Error("مسار حفظ الملف غير متاح.");
  const uri = `${base}${filename}`; await FileSystem.writeAsStringAsync(uri, contents, { encoding: FileSystem.EncodingType.UTF8 });
  if (!(await Sharing.isAvailableAsync())) throw new Error(`حُفظ الملف مؤقتاً: ${uri}`);
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: "مشاركة تقرير Dream City" });
}
function reportRows(report: Report, boxes: Report[], branchName: string) {
  const period = `${report.from ? shortDate(report.from) : "—"} إلى ${report.to ? shortDate(report.to) : "—"}`;
  const rows: unknown[][] = [
    ["Dream City Restaurants Pro Max — Z-Report"],
    ["الفرع", branchName],
    ["الفترة", period],
    ["أرقام التوصيل", DELIVERY_PHONES.join(" / ")],
    ["خدمة العملاء", CUSTOMER_SERVICE_PHONES.join(" / ")],
    ["البند", "القيمة"],
    ...REPORT_FIELDS.map((key) => [labelFor(key), reportValue(report, key)]),
    ["الصناديق النشطة", boxes.length ? boxes.map((box) => Object.entries(box).map(([key, value]) => `${key}: ${value ?? "غير مسجل"}`).join(" | ")).join(" / ") : "لا توجد صناديق نشطة في بيانات التقرير"],
  ];
  return rows;
}
function escapeHtml(value: unknown) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char] ?? char); }

function ShiftsContent() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const branchesQuery = trpc.branches.list.useQuery(undefined as never, { retry: false });
  const branches = (branchesQuery.data ?? []) as unknown as Branch[];
  const ownBranch = branches.find((branch) => branch.id === Number(user?.branchId)) ?? null;
  const [branchId, setBranchId] = useState<number | null>(null);
  const [openingCash, setOpeningCash] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const isAdmin = user?.role === "admin";
  const canManageShift = can("shifts.manage");

  const utils = trpc.useUtils();
  const currentFetcher = (utils.shifts as unknown as { current?: { fetch: () => Promise<unknown> } }).current;
  const currentQuery = useQuery({ queryKey: ["optional-current-shift", user?.id], queryFn: async () => currentFetcher ? currentFetcher.fetch() : null, enabled: Boolean(currentFetcher), refetchInterval: 15_000, retry: false });
  const currentData = currentQuery.data as any;
  const openShift: Report | null = Array.isArray(currentData) ? currentData.find((shift) => shift?.status === "open") ?? null : currentData?.shift ?? currentData ?? null;
  const effectiveBranch = isAdmin ? branchId : ownBranch?.id ?? null;
  const reportQuery = trpc.shifts.zReport.useQuery(effectiveBranch ? { branchId: effectiveBranch } : undefined as never, { enabled: Boolean(effectiveBranch), refetchInterval: 30_000, retry: false });
  const start = trpc.shifts.start.useMutation();
  const end = trpc.shifts.end.useMutation();
  const report = reportQuery.data as unknown as Report | undefined;
  const boxes = Array.isArray(report?.activeCashBoxes) ? report.activeCashBoxes as Report[] : [];
  const branch = branches.find((entry) => entry.id === Number(report?.branchId ?? effectiveBranch));
  const branchName = branch?.name ?? "فرع غير محدد";
  const reportKeys = report ? Object.keys(report).filter((key) => /(fee|unknown|unclassified)/i.test(key) && key !== "unclassifiedSales") : [];

  const open = async () => {
    setError(""); setMessage("");
    if (!effectiveBranch) { setError("اختر فرعاً حقيقياً قبل فتح الوردية."); return; }
    const cash = openingCash.trim() === "" ? undefined : Number(openingCash);
    if (cash !== undefined && (!Number.isInteger(cash) || cash < 0)) { setError("الرصيد الافتتاحي يجب أن يكون رقماً صحيحاً غير سالب."); return; }
    try { await start.mutateAsync({ branchId: effectiveBranch, openingCash: cash, notes: notes.trim() || undefined }); setMessage("تم إرسال طلب فتح الوردية إلى الخادم. حدّث الحالة للتحقق من الوردية المفتوحة."); await currentQuery.refetch(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر فتح الوردية."); }
  };
  const close = async () => {
    setError(""); setMessage(""); const cash = Number(closingCash);
    if (!openShift?.id) { setError("لا توجد وردية مفتوحة بمعرّف أعاده الخادم لإغلاقها."); return; }
    if (closingCash.trim() === "" || !Number.isInteger(cash) || cash < 0) { setError("أدخل النقد المعدود فعلياً كعدد صحيح غير سالب."); return; }
    try { await end.mutateAsync({ shiftId: Number(openShift.id), closingCash: cash, notes: notes.trim() || undefined }); setMessage("تم إرسال إغلاق الوردية إلى الخادم."); setClosingCash(""); await currentQuery.refetch(); await reportQuery.refetch(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر إغلاق الوردية."); }
  };
  const printPdf = async () => {
    if (!report) return;
    setError(""); setMessage(""); setExporting(true);
    try {
      const rows = REPORT_FIELDS.map((key) => `<tr><th>${escapeHtml(labelFor(key))}</th><td>${escapeHtml(reportValue(report, key))}</td></tr>`).join("");
      const boxesHtml = boxes.map((box) => `<li>${escapeHtml(Object.entries(box).map(([key, value]) => `${key}: ${value ?? "غير مسجل"}`).join(" · "))}</li>`).join("") || "<li>لا توجد صناديق نشطة في بيانات التقرير.</li>";
      const period = `${report.from ? shortDate(report.from) : "—"} إلى ${report.to ? shortDate(report.to) : "—"}`;
      const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#0f172a;padding:24px}h1{color:#0f172a;font-size:22px}p{color:#475467;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #d0d5dd;padding:10px;text-align:right;font-size:13px}th{background:#f8f9fb;width:55%}footer{margin-top:24px;border-top:2px solid #d97706;padding-top:10px;color:#475467;font-size:11px}</style></head><body><h1>Dream City Restaurants Pro Max — تقرير إغلاق اليوم Z-Report</h1><p>الفرع: ${escapeHtml(branchName)}</p><p>الفترة: ${escapeHtml(period)}</p><table><tbody>${rows}</tbody></table><h2>الصناديق النشطة</h2><ul>${boxesHtml}</ul><footer>أرقام التوصيل: ${escapeHtml(DELIVERY_PHONES.join("، "))}<br>خدمة العملاء: ${escapeHtml(CUSTOMER_SERVICE_PHONES.join("، "))}<br>${escapeHtml(branch?.address ?? "")}</footer></body></html>`;
      await Print.printAsync({ html }); setMessage("أُرسل Z-Report الحقيقي إلى نافذة الطباعة/حفظ PDF.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذرت طباعة التقرير."); }
    finally { setExporting(false); }
  };
  const exportExcel = async () => {
    if (!report) return;
    setError(""); setMessage(""); setExporting(true);
    try {
      const csv = `\uFEFF${reportRows(report, boxes, branchName).map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
      const filename = `dreamcity-z-report-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
      await shareTextFile(filename, csv, "text/csv"); setMessage(`تم تصدير التقرير بصيغة CSV متوافقة مع Excel: ${filename}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تصدير ملف Excel/CSV."); }
    finally { setExporting(false); }
  };

  return <View style={{ flex: 1, backgroundColor: "#fffdf8" }}><ScrollView contentContainerStyle={{ padding: 17, paddingTop: 20, paddingBottom: 34 }}>
    <AppText weight="bold" style={{ fontSize: 24 }}>الورديات والتقارير</AppText>
    <AppText style={{ color: "#667085", fontSize: 12, marginTop: 3, marginBottom: 14 }}>حالة الوردية وZ-Report تُقرأ من الخادم فقط.</AppText>
    {isAdmin ? <Card style={{ marginBottom: 12 }}><AppText weight="semibold">فرع الوردية والتقرير</AppText><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse", marginTop: 8 }}>{branches.map((entry) => <Pill key={entry.id} title={entry.name} selected={branchId === entry.id} onPress={() => setBranchId(entry.id)} />)}</ScrollView></Card> : null}
    {error ? <Card style={{ backgroundColor: "#fff5f5", marginBottom: 10 }}><AppText style={{ color: "#b42318" }}>{error}</AppText></Card> : null}
    {message ? <AppText style={{ color: "#15803d", marginBottom: 10 }}>{message}</AppText> : null}
    <Card style={{ marginBottom: 16 }}>
      <SectionHeading title="الوردية الحالية" caption="الحالة والمعرّف من shifts.current" />
      {!currentFetcher ? <AppText style={{ color: "#9a5300", fontSize: 12, lineHeight: 19 }}>إجراء shifts.current غير مهيأ؛ لا يمكن إغلاق وردية دون معرّف أعاده الخادم.</AppText> : currentQuery.isLoading ? <AppText style={{ color: "#667085" }}>جارٍ التحقق من الوردية...</AppText> : currentQuery.isError ? <AppText style={{ color: "#b42318" }}>تعذر تحميل الوردية الحالية من الخادم.</AppText> : openShift?.id ? <View style={{ gap: 5 }}><AppText weight="bold" style={{ color: "#15803d" }}>وردية مفتوحة · رقم {openShift.id}</AppText>{openShift.startedAt || openShift.createdAt ? <AppText style={{ color: "#667085", fontSize: 11 }}>بدأت: {shortDate(openShift.startedAt ?? openShift.createdAt)}</AppText> : null}{openShift.openingCash !== null && openShift.openingCash !== undefined ? <AppText style={{ fontSize: 12 }}>النقد الافتتاحي: {formatYER(Number(openShift.openingCash))}</AppText> : <AppText style={{ color: "#667085", fontSize: 11 }}>الرصيد الافتتاحي غير مسجل.</AppText>}</View> : <AppText style={{ color: "#667085" }}>لا توجد وردية مفتوحة في نتيجة الخادم الحالية.</AppText>}
      {canManageShift ? <><AppText style={{ marginTop: 12, fontSize: 12 }}>الرصيد الافتتاحي الفعلي (اختياري)</AppText><TextInput value={openingCash} onChangeText={setOpeningCash} keyboardType="number-pad" placeholder="اتركه فارغاً إذا لم يُسجل" placeholderTextColor="#98a2b3" style={[inputStyle, { marginTop: 5 }]} /><AppText style={{ marginTop: 9, fontSize: 12 }}>ملاحظات</AppText><TextInput value={notes} onChangeText={setNotes} placeholder="ملاحظات الوردية الفعلية" placeholderTextColor="#98a2b3" style={[inputStyle, { marginTop: 5 }]} /><PrimaryButton title="فتح الوردية" loading={start.isPending} disabled={!effectiveBranch} onPress={() => void open()} style={{ marginTop: 10 }} />{openShift?.id ? <><AppText style={{ marginTop: 10, fontSize: 12 }}>النقد المعدود فعلياً عند الإغلاق</AppText><TextInput value={closingCash} onChangeText={setClosingCash} keyboardType="number-pad" placeholder="أدخل النقد الذي تم عده" placeholderTextColor="#98a2b3" style={[inputStyle, { marginTop: 5 }]} /><PrimaryButton title="إغلاق الوردية" loading={end.isPending} onPress={() => void close()} style={{ marginTop: 9, backgroundColor: "#0f172a" }} /></> : null}</> : <AppText style={{ color: "#667085", fontSize: 12, marginTop: 10 }}>صلاحية المحاسب قراءة التقرير فقط؛ فتح/إغلاق الوردية يحتاج دور تشغيل مخولاً.</AppText>}
    </Card>
    <SectionHeading title="Z-Report" caption="قيم أعادها shifts.zReport لهذا اليوم" />
    {!effectiveBranch ? <Card><AppText style={{ color: "#667085" }}>اختر الفرع أو اربط الحساب بفرع لطلب التقرير.</AppText></Card> : reportQuery.isLoading ? <Card><AppText style={{ color: "#667085" }}>جارٍ تحميل التقرير الحقيقي...</AppText></Card> : reportQuery.isError ? <Card style={{ backgroundColor: "#fff5f5" }}><AppText style={{ color: "#b42318" }}>تعذر تحميل Z-Report من الخادم.</AppText><PrimaryButton title="إعادة المحاولة" onPress={() => void reportQuery.refetch()} style={{ marginTop: 9 }} /></Card> : !report ? <Card><AppText style={{ color: "#667085" }}>لم يُعِد الخادم تقريراً لعرضه؛ لن تُنشأ أرقام بديلة.</AppText></Card> : <>
      <Card style={{ gap: 10, marginBottom: 11 }}>
        {report.from || report.to ? <AppText style={{ color: "#667085", fontSize: 10 }}>الفترة: {report.from ? shortDate(report.from) : "—"} إلى {report.to ? shortDate(report.to) : "—"}</AppText> : null}
        {REPORT_FIELDS.map((key) => <View key={key} style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", borderBottomWidth: key === "driverSettlements" ? 0 : 1, borderBottomColor: "#f2f4f7", paddingBottom: 7 }}><AppText weight={key === "unclassifiedSales" ? "bold" : "regular"} style={{ color: key === "unclassifiedSales" ? "#9a5300" : "#475467", fontSize: 12 }}>{labelFor(key)}</AppText><AppText weight="bold" style={{ color: key === "unclassifiedSales" ? "#9a5300" : "#0f172a", fontSize: 12 }}>{reportValue(report, key)}</AppText></View>)}
        {report.unclassifiedSales === undefined ? <AppText weight="semibold" style={{ color: "#9a5300", fontSize: 11 }}>حقل المبيعات غير المصنفة غير وارد؛ لم يُخفَ أو يُعامل كصفر.</AppText> : null}
      </Card>
      <View style={{ gap: 8, marginBottom: 11 }}><PrimaryButton title="طباعة / حفظ Z-Report بصيغة PDF" loading={exporting} onPress={() => void printPdf()} /><Pressable onPress={() => void exportExcel()} disabled={exporting} style={{ minHeight: 46, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#d97706", alignItems: "center", justifyContent: "center", opacity: exporting ? 0.6 : 1 }}><AppText weight="bold" style={{ color: "#9a5300" }}>تصدير Excel (CSV متوافق)</AppText></Pressable><Pressable onPress={() => void reportQuery.refetch()} style={{ alignItems: "center", padding: 9 }}><AppText weight="semibold" style={{ color: "#475467" }}>تحديث التقرير</AppText></Pressable></View>
      {reportKeys.length ? <Card style={{ backgroundColor: "#fff5e8", marginBottom: 11 }}><AppText weight="bold" style={{ color: "#9a5300" }}>رسوم أو بنود غير معروفة أعادها الخادم</AppText>{reportKeys.map((key) => <AppText key={key} style={{ color: "#9a5300", fontSize: 12, marginTop: 6 }}>{labelFor(key)}: {typeof report[key] === "object" ? JSON.stringify(report[key]) : String(report[key])}</AppText>)}</Card> : null}
      <Card style={{ marginBottom: 11 }}><AppText weight="bold">الصناديق النشطة</AppText>{boxes.length ? boxes.map((box, index) => <AppText key={String(box.id ?? index)} style={{ color: "#475467", fontSize: 11, lineHeight: 18, marginTop: 5 }}>{Object.entries(box).map(([key, value]) => `${key}: ${value === null ? "غير مسجل" : String(value)}`).join(" · ")}</AppText>) : <AppText style={{ color: "#667085", fontSize: 11, marginTop: 5 }}>لا توجد صناديق نشطة في بيانات التقرير.</AppText>}</Card>
      <Card style={{ backgroundColor: "#f8f9fb" }}><AppText style={{ color: "#667085", fontSize: 11, lineHeight: 18 }}>يتضمن الملف عناوين الفرع وأرقام الاتصال الرسمية. لا تظهر بيانات تقديرية؛ PDF عبر نافذة طباعة الجهاز وCSV يفتح في Excel. لم يُختبر الطبع على طابعة حرارية فعلية.</AppText></Card>
    </>}
  </ScrollView></View>;
}

export default function ShiftsScreen() {
  return <RoleGuard permission="shifts.manage" title="الورديات والتقارير"><ShiftsContent /></RoleGuard>;
}
