import { useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { RoleGuard } from "@/components/role-guard";
import { AppText, Card, Pill, PrimaryButton, SectionHeading } from "@/components/ui";
import { trpc } from "@/lib/trpc";

type Branch = { id: number; name: string };
type ZoneDraft = { localId: string; code: string; name: string; fee: string; branchId?: number; active: "unset" | "active" | "inactive" };
type SettingRow = { settingKey: string; value: unknown };
const inputStyle = { minHeight: 46, borderWidth: 1, borderColor: "#e7e3db", borderRadius: 12, paddingHorizontal: 12, backgroundColor: "#ffffff", color: "#0f172a", textAlign: "right" as const, fontFamily: "Cairo_400Regular" };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
function getRows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  return Array.isArray(record?.zones) ? record.zones : [];
}
function zoneRows(value: unknown): ZoneDraft[] {
  return getRows(value).map((zoneValue, index) => {
    const zone = asRecord(zoneValue) ?? {};
    const active = zone.isActive === true ? "active" : zone.isActive === false ? "inactive" : "unset";
    return {
      localId: `saved-${index}`,
      code: typeof zone.code === "string" ? zone.code : "",
      name: typeof zone.name === "string" ? zone.name : "",
      fee: zone.fee === undefined || zone.fee === null ? "" : String(zone.fee),
      branchId: Number.isInteger(Number(zone.branchId)) && Number(zone.branchId) > 0 ? Number(zone.branchId) : undefined,
      active,
    };
  });
}

function SettingsContent() {
  const settingsQuery = trpc.admin.settings.useQuery(undefined as never, { retry: false });
  const branchesQuery = trpc.branches.list.useQuery(undefined as never, { retry: false });
  const saveSetting = trpc.admin.setSetting.useMutation();
  const branches = (branchesQuery.data ?? []) as unknown as Branch[];
  const settings = (settingsQuery.data ?? []) as unknown as SettingRow[];
  const [zones, setZones] = useState<ZoneDraft[] | null>(null);
  const [redemptionPoints, setRedemptionPoints] = useState<string | null>(null);
  const [redemptionValue, setRedemptionValue] = useState<string | null>(null);
  const [earningSpend, setEarningSpend] = useState<string | null>(null);
  const [earningPoints, setEarningPoints] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const nextZoneId = useRef(0);
  const delivery = settings.find((row) => row.settingKey === "delivery_zones");
  const redemption = asRecord(settings.find((row) => row.settingKey === "loyalty_redemption")?.value);
  const earning = asRecord(settings.find((row) => row.settingKey === "loyalty_earning")?.value);
  const savedZones = zoneRows(delivery?.value);
  const currentZones = zones ?? savedZones;
  const savedRedemptionPoints = Number.isInteger(redemption?.pointsPerUnit) ? String(redemption?.pointsPerUnit) : "";
  const savedRedemptionValue = Number.isInteger(redemption?.valuePerPoint) ? String(redemption?.valuePerPoint) : "";
  const savedEarningSpend = Number.isInteger(earning?.spendPerPoint) ? String(earning?.spendPerPoint) : "";
  const savedEarningPoints = Number.isInteger(earning?.pointsPerThreshold) ? String(earning?.pointsPerThreshold) : "";
  const currentRedemptionPoints = redemptionPoints ?? savedRedemptionPoints;
  const currentRedemptionValue = redemptionValue ?? savedRedemptionValue;
  const currentEarningSpend = earningSpend ?? savedEarningSpend;
  const currentEarningPoints = earningPoints ?? savedEarningPoints;

  const addZone = () => {
    nextZoneId.current += 1;
    setZones((current) => [...(current ?? savedZones), { localId: `new-${nextZoneId.current}`, code: "", name: "", fee: "", active: "unset" }]);
    setError(""); setNotice("");
  };
  const updateZone = (localId: string, patch: Partial<ZoneDraft>) => setZones((current) => (current ?? savedZones).map((zone) => zone.localId === localId ? { ...zone, ...patch } : zone));
  const persist = async (key: "delivery_zones" | "loyalty_redemption" | "loyalty_earning", value: unknown, successMessage: string) => {
    setError(""); setNotice("");
    if (settingsQuery.isLoading || settingsQuery.isError || settingsQuery.data === undefined) { setError("حمّل الإعدادات الحالية بنجاح قبل حفظ أي تغيير."); return; }
    try { await saveSetting.mutateAsync({ key, value } as never); setNotice(successMessage); await settingsQuery.refetch(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر حفظ الإعداد على الخادم."); }
  };
  const saveZones = () => {
    const payload: { code: string; name: string; fee: number; branchId?: number; isActive?: boolean }[] = [];
    for (const zone of currentZones) {
      const code = zone.code.trim(); const name = zone.name.trim(); const feeText = zone.fee.trim();
      if (!code || !/^[A-Za-z0-9_-]+$/.test(code) || !name || feeText === "") { setError("أدخل رمزاً رسمياً صالحاً واسم المنطقة ورسومها لكل صف، أو احذف الصف غير المكتمل."); setNotice(""); return; }
      const fee = Number(feeText);
      if (!Number.isSafeInteger(fee) || fee < 0) { setError("رسوم التوصيل يجب أن تكون مبلغاً صحيحاً غير سالب كما اعتمده المدير."); setNotice(""); return; }
      const entry: { code: string; name: string; fee: number; branchId?: number; isActive?: boolean } = { code, name, fee };
      if (zone.branchId) entry.branchId = zone.branchId;
      if (zone.active !== "unset") entry.isActive = zone.active === "active";
      payload.push(entry);
    }
    if (new Set(payload.map((zone) => zone.code.toLowerCase())).size !== payload.length) { setError("يجب أن يكون رمز كل منطقة فريداً."); setNotice(""); return; }
    void persist("delivery_zones", { zones: payload }, "حُفظت مناطق التوصيل على الخادم.");
  };
  const saveRedemption = () => {
    const pointsPerUnit = Number(currentRedemptionPoints.trim()); const valuePerPoint = Number(currentRedemptionValue.trim());
    if (!Number.isSafeInteger(pointsPerUnit) || pointsPerUnit < 1 || !Number.isSafeInteger(valuePerPoint) || valuePerPoint < 1) { setError("أدخل القيم الرسمية الصحيحة للنقاط وقيمة الاستبدال قبل التفعيل."); setNotice(""); return; }
    void persist("loyalty_redemption", { pointsPerUnit, valuePerPoint }, "حُفظ إعداد استبدال الولاء.");
  };
  const saveEarning = () => {
    const spendPerPoint = Number(currentEarningSpend.trim()); const pointsPerThreshold = Number(currentEarningPoints.trim());
    if (!Number.isSafeInteger(spendPerPoint) || spendPerPoint < 1 || !Number.isSafeInteger(pointsPerThreshold) || pointsPerThreshold < 1) { setError("أدخل القيم الرسمية الصحيحة للإنفاق والنقاط قبل التفعيل."); setNotice(""); return; }
    void persist("loyalty_earning", { spendPerPoint, pointsPerThreshold }, "حُفظ إعداد اكتساب الولاء.");
  };
  const redeemEnabled = settings.some((row) => row.settingKey === "loyalty_redemption" && !!asRecord(row.value) && Number.isInteger(asRecord(row.value)?.pointsPerUnit) && Number.isInteger(asRecord(row.value)?.valuePerPoint));
  const earnEnabled = settings.some((row) => row.settingKey === "loyalty_earning" && !!asRecord(row.value) && Number.isInteger(asRecord(row.value)?.spendPerPoint) && Number.isInteger(asRecord(row.value)?.pointsPerThreshold));

  return <View style={{ flex: 1, backgroundColor: "#fffdf8" }}><ScrollView contentContainerStyle={{ padding: 17, paddingTop: 20, paddingBottom: 34 }}>
    <AppText weight="bold" style={{ fontSize: 24 }}>إعدادات المطعم</AppText>
    <AppText style={{ color: "#667085", fontSize: 12, marginTop: 3, marginBottom: 14 }}>أدخل القيم الرسمية المعتمدة فقط؛ لا توجد مناطق أو رسوم أو قيم ولاء افتراضية.</AppText>
    {settingsQuery.isLoading ? <Card style={{ marginBottom: 12 }}><AppText style={{ color: "#667085" }}>جارٍ تحميل الإعدادات الرسمية...</AppText></Card> : null}
    {settingsQuery.isError ? <Card style={{ backgroundColor: "#fff5f5", marginBottom: 12 }}><AppText style={{ color: "#b42318" }}>تعذر تحميل إعدادات الإدارة من الخادم.</AppText><PrimaryButton title="إعادة المحاولة" onPress={() => void settingsQuery.refetch()} style={{ marginTop: 9 }} /></Card> : null}
    {branchesQuery.isError ? <Card style={{ backgroundColor: "#fff5f5", marginBottom: 12 }}><AppText style={{ color: "#b42318" }}>تعذر تحميل الفروع الرسمية؛ لا يمكن ربط منطقة بفرع حتى تتوفر القائمة.</AppText></Card> : null}
    {error ? <Card style={{ backgroundColor: "#fff5f5", marginBottom: 10 }}><AppText style={{ color: "#b42318" }}>{error}</AppText></Card> : null}
    {notice ? <AppText style={{ color: "#15803d", marginBottom: 10 }}>{notice}</AppText> : null}
    <Card style={{ gap: 10, marginBottom: 14 }}>
      <SectionHeading title="مناطق التوصيل" caption="رمز واسم ورسوم معتمدة؛ ربط الفرع والحالة اختياريان" />
      {currentZones.length === 0 ? <AppText style={{ color: "#667085", lineHeight: 22 }}>لا توجد مناطق مضافة في النموذج. أضف منطقة ثم أدخل بياناتها الرسمية، أو اترك القائمة فارغة حتى ترد القيم المعتمدة.</AppText> : null}
      {currentZones.map((zone, index) => <View key={zone.localId} style={{ borderTopWidth: 1, borderTopColor: "#eee9e1", paddingTop: 12, gap: 8 }}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}><AppText weight="semibold">منطقة {index + 1}</AppText><Pressable accessibilityRole="button" onPress={() => setZones((current) => (current ?? savedZones).filter((item) => item.localId !== zone.localId))} style={{ padding: 7 }}><AppText weight="semibold" style={{ color: "#b42318" }}>حذف</AppText></Pressable></View>
        <AppText weight="semibold" style={{ fontSize: 12 }}>الرمز الرسمي</AppText><TextInput value={zone.code} onChangeText={(code) => updateZone(zone.localId, { code })} autoCapitalize="none" placeholder="أدخله من السجل الرسمي" placeholderTextColor="#98a2b3" style={inputStyle} />
        <AppText weight="semibold" style={{ fontSize: 12 }}>اسم المنطقة</AppText><TextInput value={zone.name} onChangeText={(name) => updateZone(zone.localId, { name })} placeholder="الاسم المعتمد" placeholderTextColor="#98a2b3" style={inputStyle} />
        <AppText weight="semibold" style={{ fontSize: 12 }}>رسوم التوصيل</AppText><TextInput value={zone.fee} onChangeText={(fee) => updateZone(zone.localId, { fee })} keyboardType="number-pad" placeholder="أدخل المبلغ المعتمد" placeholderTextColor="#98a2b3" style={inputStyle} />
        <AppText weight="semibold" style={{ fontSize: 12 }}>الفرع (اختياري)</AppText><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse" }}><Pill title="كل الفروع" selected={!zone.branchId} onPress={() => updateZone(zone.localId, { branchId: undefined })} />{branches.map((entry) => <Pill key={entry.id} title={entry.name} selected={zone.branchId === entry.id} onPress={() => updateZone(zone.localId, { branchId: entry.id })} />)}</ScrollView>
        <AppText weight="semibold" style={{ fontSize: 12 }}>حالة المنطقة</AppText><View style={{ flexDirection: "row-reverse", flexWrap: "wrap" }}><Pill title="غير محددة" selected={zone.active === "unset"} onPress={() => updateZone(zone.localId, { active: "unset" })} /><Pill title="فعالة" selected={zone.active === "active"} onPress={() => updateZone(zone.localId, { active: "active" })} /><Pill title="متوقفة" selected={zone.active === "inactive"} onPress={() => updateZone(zone.localId, { active: "inactive" })} /></View>
      </View>)}
      <Pressable accessibilityRole="button" onPress={addZone} style={{ minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderColor: "#d97706", borderRadius: 12 }}><AppText weight="semibold" style={{ color: "#b45309" }}>＋ إضافة منطقة رسمية</AppText></Pressable>
      <PrimaryButton title="حفظ مناطق التوصيل" loading={saveSetting.isPending} onPress={saveZones} disabled={settingsQuery.isLoading || settingsQuery.isError} />
    </Card>
    <Card style={{ gap: 9, marginBottom: 14 }}>
      <SectionHeading title="استبدال نقاط الولاء" caption={redeemEnabled ? "مفعّل وفق القيم المسجلة" : "غير مفعّل حتى تُدخل القيم الرسمية"} />
      <AppText weight="semibold" style={{ fontSize: 12 }}>النقاط المطلوبة لكل وحدة استبدال</AppText><TextInput value={currentRedemptionPoints} onChangeText={setRedemptionPoints} keyboardType="number-pad" placeholder="أدخل العدد الرسمي" placeholderTextColor="#98a2b3" style={inputStyle} />
      <AppText weight="semibold" style={{ fontSize: 12 }}>قيمة كل نقطة</AppText><TextInput value={currentRedemptionValue} onChangeText={setRedemptionValue} keyboardType="number-pad" placeholder="أدخل القيمة الرسمية" placeholderTextColor="#98a2b3" style={inputStyle} />
      <PrimaryButton title="حفظ إعداد الاستبدال" loading={saveSetting.isPending} onPress={saveRedemption} disabled={settingsQuery.isLoading || settingsQuery.isError} />
      <Pressable accessibilityRole="button" disabled={saveSetting.isPending || settingsQuery.isLoading || settingsQuery.isError} onPress={() => void persist("loyalty_redemption", {}, "أُوقف استبدال نقاط الولاء.")} style={{ minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#f2f4f7" }}><AppText weight="semibold" style={{ color: "#475467" }}>إيقاف الاستبدال</AppText></Pressable>
    </Card>
    <Card style={{ gap: 9, marginBottom: 14 }}>
      <SectionHeading title="اكتساب نقاط الولاء" caption={earnEnabled ? "مفعّل وفق القيم المسجلة" : "غير مفعّل حتى تُدخل القيم الرسمية"} />
      <AppText weight="semibold" style={{ fontSize: 12 }}>الإنفاق المطلوب لكل حد نقاط</AppText><TextInput value={currentEarningSpend} onChangeText={setEarningSpend} keyboardType="number-pad" placeholder="أدخل المبلغ الرسمي" placeholderTextColor="#98a2b3" style={inputStyle} />
      <AppText weight="semibold" style={{ fontSize: 12 }}>النقاط لكل حد</AppText><TextInput value={currentEarningPoints} onChangeText={setEarningPoints} keyboardType="number-pad" placeholder="أدخل العدد الرسمي" placeholderTextColor="#98a2b3" style={inputStyle} />
      <PrimaryButton title="حفظ إعداد الاكتساب" loading={saveSetting.isPending} onPress={saveEarning} disabled={settingsQuery.isLoading || settingsQuery.isError} />
      <Pressable accessibilityRole="button" disabled={saveSetting.isPending || settingsQuery.isLoading || settingsQuery.isError} onPress={() => void persist("loyalty_earning", {}, "أُوقف اكتساب نقاط الولاء.")} style={{ minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#f2f4f7" }}><AppText weight="semibold" style={{ color: "#475467" }}>إيقاف الاكتساب</AppText></Pressable>
    </Card>
  </ScrollView></View>;
}

export default function AdminSettingsScreen() {
  return <RoleGuard permission="admin.manage" title="إعدادات الإدارة"><SettingsContent /></RoleGuard>;
}
