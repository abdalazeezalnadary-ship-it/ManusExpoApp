import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const GOLD = "#d97706";
const MUTED = "#7b8494";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 8);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: GOLD,
        tabBarInactiveTintColor: MUTED,
        tabBarStyle: {
          height: 58 + bottomPadding,
          paddingTop: 6,
          paddingBottom: bottomPadding,
          backgroundColor: "#ffffff",
          borderTopColor: "#e7e3db",
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontFamily: "Cairo_600SemiBold", fontSize: 10 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "الرئيسية", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="menu" options={{ title: "المنيو", tabBarIcon: ({ color, size }) => <Ionicons name="restaurant-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="cart" options={{ title: "السلة", tabBarIcon: ({ color, size }) => <Ionicons name="bag-handle-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="orders" options={{ title: "طلباتي", tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: "حسابي", tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}
