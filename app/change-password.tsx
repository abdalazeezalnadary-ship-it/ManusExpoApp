import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { AppText, Card, PrimaryButton } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

export default function ChangePasswordScreen() {
  const { user, isAuthenticated, refresh } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const mutation = trpc.auth.changePassword.useMutation();
  const submit = async () => {
    setMessage("");
    if (newPassword.length < 10) { setMessage("كلمة المرور الجديدة يجب أن تكون 10 أحرف على الأقل."); return; }
    if (newPassword !== confirmPassword) { setMessage("تأكيد كلمة المرور غير مطابق."); return; }
    try {
      await mutation.mutateAsync({ currentPassword, newPassword });
      setMessage("تم تحديث كلمة المرور.");
      await refresh();
      router.replace("/(tabs)/account");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحديث كلمة المرور.");
    }
  };
  if (!isAuthenticated) return <View style={{ flex: 1, backgroundColor: "#fffdf8", justifyContent: "center", padding: 20 }}><Card><AppText weight="bold">سجّل الدخول أولاً لتغيير كلمة المرور.</AppText><PrimaryButton title="تسجيل الدخول" style={{ marginTop: 14 }} onPress={() => router.replace("/login")} /></Card></View>;
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 18, backgroundColor: "#fffdf8", justifyContent: "center" }} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, marginBottom: 18 }}><Ionicons name="arrow-forward" size={19} color="#0f172a" /><AppText weight="semibold">رجوع</AppText></Pressable>
      <AppText weight="bold" style={{ fontSize: 24 }}>تغيير كلمة المرور</AppText>
      <AppText style={{ color: "#667085", marginTop: 4, marginBottom: 16 }}>{user?.mustChangePassword ? "هذه كلمة مرور أولية؛ غيّرها الآن قبل متابعة التشغيل." : "أدخل كلمة المرور الحالية للتحقق من هويتك."}</AppText>
      <Card style={{ gap: 12 }}>
        <View><AppText weight="semibold" style={{ marginBottom: 5 }}>كلمة المرور الحالية</AppText><TextInput value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry placeholder="كلمة المرور الحالية" placeholderTextColor="#98a2b3" style={inputStyle} /></View>
        <View><AppText weight="semibold" style={{ marginBottom: 5 }}>كلمة المرور الجديدة</AppText><TextInput value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="10 أحرف على الأقل" placeholderTextColor="#98a2b3" style={inputStyle} /></View>
        <View><AppText weight="semibold" style={{ marginBottom: 5 }}>تأكيد كلمة المرور الجديدة</AppText><TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="أعد كتابة كلمة المرور الجديدة" placeholderTextColor="#98a2b3" style={inputStyle} /></View>
        {message ? <AppText style={{ color: message.startsWith("تم") ? "#15803d" : "#b42318", fontSize: 12 }}>{message}</AppText> : null}
        <PrimaryButton title="حفظ كلمة المرور" loading={mutation.isPending} onPress={() => void submit()} />
      </Card>
    </ScrollView>
  );
}

const inputStyle = { minHeight: 48, borderWidth: 1, borderColor: "#e7e3db", borderRadius: 12, paddingHorizontal: 12, backgroundColor: "#fffdf8", color: "#0f172a", textAlign: "right" as const, fontFamily: "Cairo_400Regular" };
