import type { Metrics } from "react-native-safe-area-context";

type SafeAreaCallback = (metrics: Metrics) => void;
export function subscribeSafeAreaInsets(_callback: SafeAreaCallback): () => void {
  return () => undefined;
}
