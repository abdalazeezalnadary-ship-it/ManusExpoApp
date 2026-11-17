import { Image, View } from "react-native";
import type { ImageSourcePropType } from "react-native";
import type { BranchCode } from "@/constants/restaurant";

const branchLogos: Record<BranchCode, ImageSourcePropType> = {
  "dream-city-main": require("../assets/images/brand-assets/dream-city-main.jpg"),
  "crispy-meals": require("../assets/images/brand-assets/crispy-meals.jpg"),
};

type BranchLogoProps = {
  branchCode: BranchCode;
  size?: number;
};

export function BranchLogo({ branchCode, size = 46 }: BranchLogoProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.24),
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fffdf8",
        borderWidth: 1,
        borderColor: "#ece6db",
      }}
    >
      <Image source={branchLogos[branchCode]} resizeMode="contain" style={{ width: "100%", height: "100%" }} />
    </View>
  );
}
