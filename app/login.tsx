import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { BrandMark } from "@/components/brand-mark";
import { AppText, Card, PrimaryButton } from "@/components/ui";
import * as Auth from "@/lib/_core/auth";
import { trpc } from "@/lib/trpc";

export default function LoginScreen() {
  const [registerMode, setRegisterMode] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const login = trpc.auth.login.useMutation();
  const register = trpc.auth.register.useMutation();
  const busy = login.isPending || register.isPending;

  const submit = async () => {
    setError("");
    if (!phone.trim() || !password) {
      setError("أدخل رقم الهاتف وكلمة المرور.");
      return;
    }
    if (registerMode && !name.trim()) {
      setError("أدخل الاسم لإكمال إنشاء الحساب.");
      return;
    }
    try {
      const result = (registerMode
        ? await register.mutateAsync({ name: name.trim(), phone: phone.trim(), password })
        : await login.mutateAsync({ phone: phone.trim(), password })) as unknown as { token?: string; user?: Record<string, unknown> };
      if (!result.token || !result.user) throw new Error("تعذر إنشاء جلسة آمنة. تحقق من إعداد المصادقة.");
      const user = result.user;
      const authUser: Auth.User = {
        id: Number(user.id),
        openId: typeof user.openId === "string" ? user.openId : null,
        name: typeof user.name === "string" ? user.name : null,
        email: typeof user.email === "string" ? user.email : null,
        loginMethod: typeof user.loginMethod === "string" ? user.loginMethod : "phone",
        lastSignedIn: user.lastSignedIn ? new Date(String(user.lastSignedIn)) : new Date(),
        phone: typeof user.phone === "string" ? user.phone : phone.trim(),
        role: typeof user.role === "string" ? user.role : "customer",
        branchCode: typeof user.branchCode === "string" ? user.branchCode : null,
        mustChangePassword: Boolean(user.mustChangePassword),
        points: Number(user.points ?? 0),
      };
      await Auth.setSessionToken(result.token);
      await Auth.setUserInfo(authUser);
      if (registerMode) {
        setError("تم إنشاء الحساب. يمكنك الآن متابعة الطلبات من حسابك.");
      }
      router.replace(authUser.mustChangePassword ? "/change-password" : "/(tabs)/account");
    } catch (cause) {
      const raw = cause instanceof Error ? cause.message : "تعذر تسجيل الدخول.";
      setError(raw.includes("مصادقة التطبيق غير مهيأة")
        ? "تسجيل الدخول غير مهيأ حالياً. يُرجى التواصل مع إدارة المطعم."
        : raw.includes("بيانات الدخول") ? "رقم الهاتف أو كلمة المرور غير صحيحين." : raw);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, backgroundColor: "#fffdf8", padding: 20, justifyContent: "center" }} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: "center", marginBottom: 22 }}>
        <BrandMark size={76} />
        <AppText weight="bold" style={{ fontSize: 24, marginTop: 13 }}>مرحباً بك في دريم سيتي</AppText>
        <AppText style={{ color: "#667085", fontSize: 13, marginTop: 4 }}>{registerMode ? "إنشاء حساب عميل" : "سجّل الدخول لمتابعة طلباتك"}</AppText>
      </View>
      <Card style={{ padding: 18, borderRadius: 21, gap: 12 }}>
        {registerMode ? <View>
          <AppText weight="semibold" style={{ marginBottom: 5 }}>الاسم</AppText>
          <TextInput value={name} onChangeText={setName} placeholder="الاسم الكامل" placeholderTextColor="#98a2b3" style={inputStyle} />
        </View> : null}
        <View>
          <AppText weight="semibold" style={{ marginBottom: 5 }}>رقم الهاتف</AppText>
          <TextInput value={phone} onChangeText={setPhone} placeholder="رقم الهاتف" placeholderTextColor="#98a2b3" keyboardType="phone-pad" autoComplete="tel" style={inputStyle} />
        </View>
        <View>
          <AppText weight="semibold" style={{ marginBottom: 5 }}>كلمة المرور</AppText>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", borderWidth: 1, borderColor: "#e7e3db", borderRadius: 12, paddingHorizontal: 10, backgroundColor: "#ffffff" }}>
            <TextInput value={password} onChangeText={setPassword} placeholder={registerMode ? "10 أحرف على الأقل" : "أدخل كلمة المرور"} placeholderTextColor="#98a2b3" secureTextEntry={!showPassword} autoComplete={registerMode ? "new-password" : "current-password"} style={[inputStyle, { flex: 1, borderWidth: 0 }]} />
            <Pressable onPress={() => setShowPassword((value) => !value)} accessibilityLabel={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}><Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#667085" /></Pressable>
          </View>
        </View>
        {error ? <AppText style={{ color: error.startsWith("تم إنشاء") ? "#15803d" : "#b42318", fontSize: 12, lineHeight: 20 }}>{error}</AppText> : null}
        <PrimaryButton title={registerMode ? "إنشاء حساب" : "تسجيل الدخول"} loading={busy} onPress={() => void submit()} style={{ marginTop: 4 }} />
        <AppText style={{ color: "#667085", textAlign: "center", fontSize: 11, lineHeight: 18 }}>تُحفظ كلمة المرور بصورة hash على الخادم؛ لا تُخزّن في الجهاز. حسابات الطاقم محددة الصلاحية حسب الدور والفرع.</AppText>
      </Card>
      <Pressable onPress={() => { setRegisterMode((value) => !value); setError(""); }} style={{ alignSelf: "center", padding: 16, flexDirection: "row-reverse", gap: 5 }}>
        <AppText style={{ color: "#667085" }}>{registerMode ? "لديك حساب؟" : "عميل جديد؟"}</AppText>
        <AppText weight="bold" style={{ color: "#d97706" }}>{registerMode ? "تسجيل الدخول" : "إنشاء حساب"}</AppText>
      </Pressable>
      <Pressable onPress={() => router.back()} style={{ alignSelf: "center", padding: 9, flexDirection: "row-reverse", gap: 5, alignItems: "center" }}><Ionicons name="arrow-forward" size={16} color="#667085" /><AppText style={{ color: "#667085", fontSize: 12 }}>العودة للتصفح</AppText></Pressable>
    </ScrollView>
  );
}

const inputStyle = { minHeight: 48, borderWidth: 1, borderColor: "#e7e3db", borderRadius: 12, paddingHorizontal: 12, backgroundColor: "#ffffff", color: "#0f172a", textAlign: "right" as const, fontFamily: "Cairo_400Regular" };
