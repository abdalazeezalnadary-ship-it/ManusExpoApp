import Svg, { Path, Ellipse, Circle } from "react-native-svg";
import { View, type ViewStyle } from "react-native";

export function BrandMark({ size = 48, style }: { size?: number; style?: ViewStyle }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size * 0.27, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center" }, style]}>
      <Svg width={size * 0.78} height={size * 0.78} viewBox="0 0 100 100">
        <Path d="M18 65V43a32 32 0 0 1 64 0v22" fill="none" stroke="#d97706" strokeWidth="5" strokeLinecap="round" />
        <Path d="M32 42a18 18 0 0 1 36 0v20" fill="none" stroke="#e7a443" strokeWidth="2.5" strokeLinecap="round" />
        <Path d="M36 56c-4-5-4-9 0-14m14 14c-4-5-4-9 0-14m14 14c-4-5-4-9 0-14" fill="none" stroke="#fff7e8" strokeWidth="3" strokeLinecap="round" />
        <Ellipse cx="50" cy="68" rx="31" ry="10" fill="none" stroke="#fff7e8" strokeWidth="4" />
        <Ellipse cx="50" cy="68" rx="23" ry="5" fill="none" stroke="#d97706" strokeWidth="2" />
        <Circle cx="50" cy="68" r="2" fill="#d97706" />
      </Svg>
    </View>
  );
}
