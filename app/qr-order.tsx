import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import { AppText, Card, PrimaryButton } from "@/components/ui";
import { useRestaurant } from "@/lib/restaurant-context";

export default function QrOrderScreen() {
  const { setOrderType, setTableNumber: saveTableNumber } = useRestaurant();
  const [permission, requestPermission] = useCameraPermissions();
  const [tableNumber, setTableNumber] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const acceptCode = (raw: string) => {
    const value = raw.trim();
    try {
      const parsed = new URL(value);
      const table = parsed.searchParams.get("table") ?? parsed.searchParams.get("tableNumber");
      setTableNumber(table ?? value);
    } catch {
      const match = value.match(/(?:table|طاولة)[=:\s/-]*([\p{L}\p{N}-]+)/iu);
      setTableNumber(match?.[1] ?? value);
    }
    setScanning(false);
    setError("");
  };
  const continueToCart = () => {
    if (!tableNumber.trim()) {
      setError("أدخل رقم الطاولة أو امسح رمزها أولاً.");
      return;
    }
    setOrderType("table");
    saveTableNumber(tableNumber.trim());
    router.replace({ pathname: "/cart", params: { orderType: "table", tableNumber: tableNumber.trim() } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fffdf8", padding: 18, paddingTop: 24 }}>
      <Pressable onPress={() => router.back()} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 7, marginBottom: 18 }}><Ionicons name="arrow-forward" size={20} color="#0f172a" /><AppText weight="semibold">رجوع</AppText></Pressable>
      <AppText weight="bold" style={{ fontSize: 24 }}>طلب الصالة</AppText>
      <AppText style={{ color: "#667085", fontSize: 13, marginTop: 4, marginBottom: 18 }}>امسح رمز الطاولة أو أدخل رقمها للمتابعة.</AppText>

      {scanning && Platform.OS !== "web" ? <View style={{ height: 300, borderRadius: 20, overflow: "hidden", marginBottom: 16 }}>
        <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={({ data }) => acceptCode(data)} />
        <View pointerEvents="none" style={{ position: "absolute", top: 40, left: 40, right: 40, bottom: 40, borderWidth: 2, borderColor: "#f0a43a", borderRadius: 20 }} />
      </View> : <Card style={{ alignItems: "center", paddingVertical: 25, marginBottom: 15 }}>
        <View style={{ width: 60, height: 60, borderRadius: 19, backgroundColor: "#fff3e2", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><Ionicons name="qr-code-outline" size={29} color="#d97706" /></View>
        <AppText weight="bold" style={{ fontSize: 16 }}>امسح رمز الطاولة</AppText>
        <AppText style={{ color: "#667085", textAlign: "center", marginTop: 5 }}>لا نطلب إذن الكاميرا إلا عند بدء المسح.</AppText>
      </Card>}

      {!scanning ? <PrimaryButton title={Platform.OS === "web" ? "المسح متاح على الهاتف" : "فتح الكاميرا للمسح"} disabled={Platform.OS === "web"} icon={<Ionicons name="camera-outline" size={19} color="#ffffff" />} onPress={async () => {
        if (!permission?.granted) {
          const result = await requestPermission();
          if (!result.granted) { setError("لم يُمنح إذن الكاميرا؛ استخدم الإدخال اليدوي أدناه."); return; }
        }
        setScanning(true);
      }} /> : <Pressable onPress={() => setScanning(false)} style={{ alignItems: "center", marginBottom: 12 }}><AppText weight="semibold" style={{ color: "#d97706" }}>إغلاق الكاميرا</AppText></Pressable>}

      <Card style={{ marginTop: 16 }}>
        <AppText weight="bold" style={{ fontSize: 14, marginBottom: 8 }}>أو أدخل رقم الطاولة</AppText>
        <TextInput value={tableNumber} onChangeText={setTableNumber} placeholder="رقم أو اسم الطاولة" placeholderTextColor="#98a2b3" style={{ height: 48, borderWidth: 1, borderColor: "#e7e3db", borderRadius: 12, backgroundColor: "#ffffff", paddingHorizontal: 12, textAlign: "right", fontFamily: "Cairo_400Regular", color: "#0f172a" }} />
        {error ? <AppText style={{ color: "#b42318", fontSize: 12, marginTop: 7 }}>{error}</AppText> : null}
        {tableNumber ? <AppText style={{ color: "#15803d", fontSize: 12, marginTop: 7 }}>تم اختيار: {tableNumber}</AppText> : null}
        <PrimaryButton title="متابعة إلى السلة" style={{ marginTop: 14 }} onPress={continueToCart} />
      </Card>
      {Platform.OS === "web" ? <AppText style={{ color: "#667085", fontSize: 11, textAlign: "center", marginTop: 12 }}>لأسباب توافق المتصفح، استخدم إدخال رقم الطاولة أو افتح التطبيق على الهاتف لمسح الرمز.</AppText> : null}
    </View>
  );
}
