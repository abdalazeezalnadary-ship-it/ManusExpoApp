import { Platform } from "react-native";

export const SESSION_TOKEN_KEY = "dreamcity.session.v1";
export const USER_INFO_KEY = "dreamcity.user.v1";
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? "";

export function getApiBaseUrl(): string {
  if (configuredApiUrl) return configuredApiUrl.replace(/\/+$/, "");
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    if ((hostname === "localhost" || hostname === "127.0.0.1") && port === "8081") {
      return `${protocol}//${hostname}:3000`;
    }
    const apiHost = hostname.replace(/^8081-/, "3000-");
    return `${protocol}//${apiHost}${port && apiHost === hostname ? `:${port}` : ""}`;
  }
  // Android emulator host alias; physical phones need EXPO_PUBLIC_API_URL set to a reachable URL.
  if (Platform.OS === "android") return "http://10.0.2.2:3000";
  return "http://localhost:3000";
}
