import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { RoleGuard } from "@/components/role-guard";
import { AppText, Card, Pill, PrimaryButton } from "@/components/ui";
import { trpc } from "@/lib/trpc";

const ROLES = ["admin"] as const;
type Branch = { id: number; name: string };

function downloadInBrowser(filename: string, contents: string, mimeType: string) {
  if (typeof document === "undefined") return false;
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}

async function saveAndShareJson(filename: string, contents: string) {
  if (Platform.OS === "web" && downloadInBrowser(filename, contents, "application/json;charset=utf-8")) return;
  const base = FileSystem.cacheDirectory;
  if (!base) throw new Error("مسار التخزين المؤقت غير متاح على هذا الجهاز.");
  const uri = `${base}${filename}`;
  await FileSystem.writeAsStringAsync(uri, contents, { encoding: FileSystem.EncodingType.UTF8 });
  if (!(await Sharing.isAvailableAsync())) throw new Error(`حُفظ الملف مؤقتاً على الجهاز: ${uri}`);
  await Sharing.shareAsync(uri, { mimeType: "application/json", dialogTitle: "نسخة Dream City الاحتياطية" });
}

function BackupContent() {
  const [branchId, setBranchId] = useState<number | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const branchesQuery = trpc.branches.list.useQuery(undefined as never, { retry: false });
  const branches = (branchesQuery.data ?? []) as unknown as Branch[];
  const exportMutation = trpc.admin.exportBackup.useMutation();

  const runExport = async () => {
    setConfirmVisible(false);
    setMessage("");
    setError("");
    try {
      const backup = await exportMutation.mutateAsync(branchId ? { branchId } : undefined as never);
      const contents = JSON.stringify(backup, null, 2);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `dreamcity-backup-${stamp}.json`;
      await saveAndShareJson(filename, contents);
      const data = (backup as { data?: Record<string, unknown> }).data ?? {};
      const counts = Object.entries(data).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.length : 0}`).join(" · ");
      setMessage(`اكتمل إنشاء النسخة ${filename}. ${counts}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تصدير النسخة الاحتياطية.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fffdf8" }}>
      <ScrollView contentContainerStyle={{ padding: 17, paddingTop: 20, paddingBottom: 34 }}>
        <AppText weight="bold" style={{ fontSize: 24 }}>النسخ الاحتياطي</AppText>
        <AppText style={{ color: "#667085", fontSize: 12, lineHeight: 20, marginTop: 4, marginBottom: 14 }}>تصدير JSON يبدأه المشرف فقط. تُحذف كلمات المرور وحقول التوقيع ولا تتضمن النسخة أسرار البيئة.</AppText>
        <Card style={{ backgroundColor: "#0f172a", borderColor: "#0f172a", marginBottom: 14 }}>
          <AppText weight="bold" style={{ color: "#fff", fontSize: 16 }}>نطاق النسخة</AppText>
          {branchesQuery.isLoading ? <AppText style={{ color: "#d0d5dd", marginTop: 7 }}>جارٍ تحميل الفروع...</AppText> : null}
          {branchesQuery.isError ? <AppText style={{ color: "#fecaca", marginTop: 7 }}>تعذر تحميل الفروع؛ النسخة الكاملة متاحة فقط دون تحديد فرع.</AppText> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse", marginTop: 8 }}>
            <Pill title="كل الفروع" selected={branchId === null} onPress={() => setBranchId(null)} />
            {branches.map((branch) => <Pill key={branch.id} title={branch.name} selected={branchId === branch.id} onPress={() => setBranchId(branch.id)} />)}
          </ScrollView>
        </Card>
        {error ? <Card style={{ backgroundColor: "#fff5f5", marginBottom: 10 }}><AppText style={{ color: "#b42318" }}>{error}</AppText></Card> : null}
        {message ? <Card style={{ backgroundColor: "#edf7f0", marginBottom: 10 }}><AppText weight="semibold" style={{ color: "#166534", fontSize: 12, lineHeight: 20 }}>{message}</AppText></Card> : null}
        <Card style={{ gap: 8, marginBottom: 14 }}>
          <AppText weight="bold">تتضمن النسخة</AppText>
          <AppText style={{ color: "#475467", fontSize: 12, lineHeight: 20 }}>الفروع والمنيو والطلبات وعناصرها ومخزون الفرع والموظفين ببيانات آمنة دون كلمة المرور، الكوبونات والمرتجعات والورديات والصناديق والمصروفات والقيود وسجل التدقيق ومواقع GPS وإعدادات المناطق والولاء.</AppText>
          <AppText weight="semibold" style={{ color: "#9a5300", fontSize: 11, lineHeight: 18 }}>قد تتضمن عناوين العملاء وبيانات تشغيلية حساسة. احفظ الملف في مكان خاص ولا ترسله إلى جهة غير مخولة.</AppText>
        </Card>
        <PrimaryButton title="إنشاء نسخة JSON احتياطية" loading={exportMutation.isPending} onPress={() => setConfirmVisible(true)} />
        <Card style={{ marginTop: 14, backgroundColor: "#f8f9fb" }}><AppText style={{ color: "#667085", fontSize: 11, lineHeight: 18 }}>صلاحية الخادم مقصورة على المشرف؛ لا تتضمن النسخة قيم أسرار الخادم أو bcrypt hashes، وتُنزّل إلى جهاز المستخدم بطلب صريح.</AppText></Card>
      </ScrollView>
      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.55)", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <Card style={{ width: "100%", maxWidth: 420, padding: 20 }}>
            <AppText weight="bold" style={{ fontSize: 18 }}>تأكيد تصدير البيانات</AppText>
            <AppText style={{ color: "#475467", fontSize: 13, lineHeight: 22, marginTop: 8 }}>ستُنشأ نسخة على الجهاز تتضمن سجلات مالية وبيانات طلبات/عملاء ضمن النطاق المحدد. هل تريد المتابعة؟</AppText>
            <View style={{ gap: 8, marginTop: 15 }}>
              <PrimaryButton title="نعم، صدّر النسخة" loading={exportMutation.isPending} onPress={() => void runExport()} />
              <Pressable onPress={() => setConfirmVisible(false)} style={{ alignItems: "center", padding: 12 }}><AppText weight="semibold" style={{ color: "#475467" }}>إلغاء</AppText></Pressable>
            </View>
          </Card>
        </View>
      </Modal>
    </View>
  );
}

export default function BackupScreen() {
  return <RoleGuard roles={ROLES} title="النسخ الاحتياطي"><BackupContent /></RoleGuard>;
}
