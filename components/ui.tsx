import React from "react";
import { ActivityIndicator, Pressable, Text, View, type PressableProps, type TextProps, type ViewProps } from "react-native";

const fontByWeight = {
  regular: "Cairo_400Regular",
  semibold: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
} as const;

export function AppText({ weight = "regular", style, ...props }: TextProps & { weight?: keyof typeof fontByWeight }) {
  return <Text {...props} style={[{ color: "#0f172a", fontFamily: fontByWeight[weight], writingDirection: "rtl", textAlign: "right" }, style]} />;
}

export function Card({ style, ...props }: ViewProps) {
  return <View {...props} style={[{ backgroundColor: "#ffffff", borderRadius: 20, borderWidth: 1, borderColor: "#eee9e1", padding: 16 }, style]} />;
}

export function PrimaryButton({ title, icon, loading, disabled, style, textStyle, ...props }: PressableProps & {
  title: string;
  icon?: React.ReactNode;
  loading?: boolean;
  textStyle?: object;
}) {
  return (
    <Pressable
      {...props}
      disabled={disabled || loading}
      style={({ pressed }) => [
        { minHeight: 50, paddingHorizontal: 18, borderRadius: 15, backgroundColor: disabled ? "#cbd0d7" : "#d97706", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, opacity: pressed ? 0.86 : 1 },
        style as object,
      ]}
    >
      {loading ? <ActivityIndicator color="#ffffff" /> : icon}
      {!loading && <Text style={[{ color: "#ffffff", fontFamily: "Cairo_700Bold", fontSize: 15 }, textStyle]}>{title}</Text>}
    </Pressable>
  );
}

export function SectionHeading({ title, caption, action }: { title: string; caption?: string; action?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <View style={{ flex: 1 }}>
        <AppText weight="bold" style={{ fontSize: 18 }}>{title}</AppText>
        {caption ? <AppText style={{ color: "#667085", fontSize: 12, marginTop: 2 }}>{caption}</AppText> : null}
      </View>
      {action}
    </View>
  );
}

export function Pill({ title, selected = false, onPress }: { title: string; selected?: boolean; onPress?: () => void }) {
  const content = <AppText weight="semibold" style={{ color: selected ? "#ffffff" : "#475467", fontSize: 12 }}>{title}</AppText>;
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: selected ? "#0f172a" : "#ffffff", borderWidth: 1, borderColor: selected ? "#0f172a" : "#e7e3db", marginLeft: 8 }}>
      {content}
    </Pressable>
  );
}

export function OfflineBadge({ online }: { online: boolean }) {
  return (
    <View style={{ alignSelf: "flex-start", flexDirection: "row-reverse", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: online ? "#edf7f0" : "#fff5e8" }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: online ? "#15803d" : "#d97706" }} />
      <AppText weight="semibold" style={{ color: online ? "#166534" : "#9a5300", fontSize: 11 }}>{online ? "متصل" : "غير متصل"}</AppText>
    </View>
  );
}
